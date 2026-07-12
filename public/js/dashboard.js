import {
  getDashboardGuilds,
  getDashboardServer,
  getImageAccess,
  addImageAccessUser,
  removeImageAccessUser,
  getServerSettings,
  saveServerSettings,
  getGuildRoles,
  getLevelRewards,
  saveLevelReward,
  deleteLevelReward,
  searchGuildUsers,
  getModerationAccess,
  addModerationAccessUser,
  removeModerationAccessUser,
  requestDashboardPreview,
  simulateDashboardEvent,
} from './api.js';
import { escapeHtml, formatNumber } from './utils.js';
import { showStatusToast } from './toast.js';
import { emptyState, errorCard, loadingCard } from './components/feedback.js';
import { switchField, textField, numberField, textareaField, variableButtons, saveBtn, channelSelectField, roleSelectField, textChannels, guildRoles, normalizeChannelValue } from './components/forms.js';
import { userAccessForm, renderAccessList, userSuggestionRow } from './components/accessList.js';
import { getActiveUser } from './auth.js';
import { DEMO_LEVELING, isDemoRoute } from './demoData.js';
import { applyTheme as applyStoredTheme, setStoredTheme } from './components/theme.js';

const els = {
  home: document.querySelector('[data-dashboard-home]'),
  detail: document.querySelector('[data-server-detail]'),
  detailContent: document.querySelector('[data-server-detail-content]'),
};

const OWNER_VIEW_STORAGE_KEY = 'meowzDashboardViewMode';
const SETTINGS_STORAGE_KEY = 'meowzServerSettings';
const DASHBOARD_PREFS_KEY = 'meowzDashboardPreferences';
const VALID_THEMES = new Set(['dark', 'light']);
const VALID_LANGUAGES = new Set(['en', 'pt', 'es', 'de', 'fr']);
const VALID_SECTIONS = new Set(['overview', 'welcome', 'leveling', 'ai-image-access', 'logs', 'moderation']);
let viewMode = localStorage.getItem(OWNER_VIEW_STORAGE_KEY) === 'owner' ? 'owner' : 'user';
const serverPageCache = new Map();
const tabDataCache = new Map();
let serverRenderNonce = 0;
let activeServerShellId = null;
const DASHBOARD_SERVER_SNAPSHOT_KEY = 'meowzDashboardServerSnapshots';


function normalizeSection(section = 'overview') {
  const raw = String(section || 'overview').replace(/^#/, '').trim() || 'overview';
  if (raw === 'ai') return 'ai-image-access';
  return VALID_SECTIONS.has(raw) ? raw : 'overview';
}

function storeServerSnapshots(data) {
  const installed = Array.isArray(data?.installed) ? data.installed : [];
  if (!installed.length) return;
  try {
    sessionStorage.setItem(DASHBOARD_SERVER_SNAPSHOT_KEY, JSON.stringify({
      at: Date.now(),
      servers: installed.map((server) => ({ ...server })),
    }));
  } catch {
    // Session storage is an enhancement only.
  }
}

function readServerSnapshot(guildId) {
  const key = String(guildId || '');
  if (!key) return null;

  for (const payload of serverPageCache.values()) {
    if (payload?.server?.id === key) return { ...payload.server, settings: { ...(payload.server.settings || {}) } };
  }

  try {
    const parsed = JSON.parse(sessionStorage.getItem(DASHBOARD_SERVER_SNAPSHOT_KEY) || '{}');
    const servers = Array.isArray(parsed?.servers) ? parsed.servers : [];
    const server = servers.find((item) => String(item.id) === key);
    return server ? { ...server, channels: Array.isArray(server.channels) ? server.channels : [], settings: { ...(server.settings || {}) } } : null;
  } catch {
    return null;
  }
}

async function fetchServerSnapshot(guildId) {
  let snapshot = readServerSnapshot(guildId);
  if (snapshot) return snapshot;

  try {
    const data = await getDashboardGuilds(viewMode);
    storeServerSnapshots(data);
    snapshot = readServerSnapshot(guildId);
    return snapshot;
  } catch {
    return null;
  }
}

function syncDashTabs(root = document) {
  const tabs = root?.querySelector?.('.dash-tabs');
  if (!tabs) return;

  requestAnimationFrame(() => {
    const active = tabs.querySelector('a.is-active');
    if (!active) {
      tabs.scrollLeft = 0;
      return;
    }

    const isMobile = window.matchMedia?.('(max-width: 900px)').matches ?? window.innerWidth <= 900;
    if (!isMobile) {
      tabs.scrollLeft = 0;
      return;
    }

    const nearStart = active.offsetLeft < tabs.clientWidth * 0.45;
    const target = nearStart ? 0 : Math.max(0, active.offsetLeft - 12);
    tabs.scrollTo({ left: target, behavior: 'auto' });
  });
}

const serverDraftCache = new Map();

function serverDraftState(guildId) {
  const key = String(guildId || 'unknown');
  if (!serverDraftCache.has(key)) {
    serverDraftCache.set(key, { originals: new Map(), drafts: new Map(), dirty: new Set(), errors: new Map() });
  }
  return serverDraftCache.get(key);
}
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function rememberOriginal(guildId, section, values) {
  const state = serverDraftState(guildId);
  if (!state.originals.has(section)) state.originals.set(section, structuredClone(values || {}));
}
function currentDraft(guildId, section) {
  return serverDraftState(guildId).drafts.get(section) || null;
}
function setDraft(guildId, section, values) {
  const state = serverDraftState(guildId);
  const draft = structuredClone(values || {});
  state.drafts.set(section, draft);
  const original = state.originals.get(section) || {};
  if (stableStringify(original) === stableStringify(draft)) state.dirty.delete(section);
  else state.dirty.add(section);
  state.errors.delete(section);
  renderGlobalSaveBar(guildId);
}
function clearDraft(guildId, section, savedValues) {
  const state = serverDraftState(guildId);
  const clean = structuredClone(savedValues || state.drafts.get(section) || {});
  state.originals.set(section, clean);
  state.drafts.delete(section);
  state.dirty.delete(section);
  state.errors.delete(section);
  renderGlobalSaveBar(guildId);
}
function discardDrafts(guildId) {
  const state = serverDraftState(guildId);
  state.drafts.clear();
  state.dirty.clear();
  state.errors.clear();
  renderGlobalSaveBar(guildId);
}
function globalSaveBarHtml(guildId) {
  const state = serverDraftState(guildId);
  const count = state.dirty.size;
  if (!count) return '';
  const names = Array.from(state.dirty).map(sectionTitle).join(', ');
  return `<div class="dash-save-bar" data-global-save-bar data-guild-id="${escapeHtml(guildId)}"><div><strong>You have unsaved changes</strong><span>${count} section${count === 1 ? '' : 's'} changed${names ? `: ${escapeHtml(names)}` : ''}</span></div><div><button type="button" class="dash-secondary-btn" data-discard-drafts>Discard</button><button type="button" class="dash-save-btn" data-save-drafts>Save Changes</button></div></div>`;
}
function renderGlobalSaveBar(guildId) {
  const host = document.querySelector('[data-server-save-host]');
  if (!host) return;
  host.innerHTML = globalSaveBarHtml(guildId);
}
function syncSectionStatus(form, section) {
  if (!form) return;
  const status = form.querySelector('.dash-card-head .status');
  if (!status) return;
  const enabledInput = section === 'welcome'
    ? form.querySelector('input[name="welcomeEnabled"]')
    : form.querySelector('input[name="enabled"]');
  const enabled = enabledInput ? Boolean(enabledInput.checked) : status.classList.contains('enabled');
  status.textContent = enabled ? 'Enabled' : 'Disabled';
  status.classList.toggle('enabled', enabled);
  status.classList.toggle('disabled', !enabled);
}

function isDemoMode() { return isDemoRoute(); }
function dashboardBase() { return isDemoMode() ? '/demo/dashboard' : '/dashboard'; }
function settingsPath() { return isDemoMode() ? '/demo/settings' : '/dashboard/settings'; }
function demoBadge() { return isDemoMode() ? '<div class="demo-banner" role="status"><strong>Demo Mode</strong><span>Read-only preview using fake data. Real changes are disabled.</span></div>' : ''; }
function readOnlyDemoToast() { showStatusToast('info', 'Demo mode is read-only', 'Real changes are disabled in preview mode.'); }

function readDashboardPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(DASHBOARD_PREFS_KEY) || '{}');
    return {
      theme: VALID_THEMES.has(prefs.theme) ? prefs.theme : (localStorage.getItem('meowzTheme') || 'dark'),
      language: VALID_LANGUAGES.has(prefs.language) ? prefs.language : 'en',
      compactCards: Boolean(prefs.compactCards),
    };
  } catch {
    return { theme: localStorage.getItem('meowzTheme') || 'dark', language: 'en', compactCards: false };
  }
}
function writeDashboardPrefs(next) {
  const prefs = { ...readDashboardPrefs(), ...next };
  localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(prefs));
  setStoredTheme(prefs.theme);
  return prefs;
}
function applyTheme(theme = readDashboardPrefs().theme) {
  return applyStoredTheme(theme);
}
applyTheme();

function hashSection(defaultSection = 'overview') {
  const raw = String(window.location.hash || '').replace(/^#/, '').trim();
  return raw ? normalizeSection(raw) : normalizeSection(defaultSection);
}
function routeInfo() {
  if (isDemoMode()) {
    const path = window.location.pathname;
    if (/^\/demo\/settings\/?$/.test(path)) return { settings: true };
    if (/^\/demo(?:\/dashboard)?\/?$/.test(path)) return { home: true };
    const demoServerMatch = path.match(/^\/demo\/server\/([^/]+)(?:\/([^/]+))?\/?$/);
    if (demoServerMatch) {
      const fallback = decodeURIComponent(demoServerMatch[2] || 'overview');
      return { id: decodeURIComponent(demoServerMatch[1]), section: hashSection(normalizeSection(fallback)) };
    }
    return { home: true };
  }
  const base = 'dashboard';
  const settingsRe = new RegExp(`^/${base}/settings/?$`);
  if (settingsRe.test(window.location.pathname)) return { settings: true };
  const serverRe = new RegExp(`^/${base}/server/([^/]+)(?:/([^/]+))?/?$`);
  const match = window.location.pathname.match(serverRe);
  if (!match) return null;
  const fallback = decodeURIComponent(match[2] || 'overview');
  return { id: decodeURIComponent(match[1]), section: hashSection(normalizeSection(fallback)) };
}

function activeUser() { return getActiveUser?.() || null; }
function isAuthenticated() { return Boolean(activeUser()) && !isDemoMode(); }
function canAccessProtected() { return isDemoMode() || isAuthenticated(); }
function activeName() { const u = activeUser(); return u?.globalName || u?.username || 'Rafa'; }
function activeUsername() { const u = activeUser(); return u?.username ? `@${u.username}` : '@atuaprima_'; }
function userAvatarUrl(user = activeUser(), size = 96) {
  if (!user?.id || !user?.avatar) return null;
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}
function avatarHtml(className = 'dash-user-avatar') {
  const u = activeUser();
  const img = userAvatarUrl(u, 128);
  const letter = escapeHtml(activeName().slice(0, 1).toUpperCase() || 'U');
  return img ? `<span class="${className}"><img src="${escapeHtml(img)}" alt="" /></span>` : `<span class="${className}">${letter}</span>`;
}
function initial(name = 'M') { return escapeHtml(String(name || 'M').trim().charAt(0).toUpperCase() || 'M'); }

const previewResponseCache = new Map();
const previewTimers = new Map();
const previewControllers = new Map();
const MAX_PREVIEW_CACHE = 24;

function livePreviewShell(kind, alt, label = 'Generating preview…') {
  return `<div class="dash-live-preview is-loading" data-live-preview="${escapeHtml(kind)}"><img alt="${escapeHtml(alt)}" loading="lazy" hidden /><div class="dash-live-preview-state"><strong>${escapeHtml(label)}</strong><span>Updates live while you edit.</span></div></div>`;
}
function previewCacheKey(kind, payload) {
  return `${kind}:${stableStringify(payload)}`;
}
function setPreviewState(host, state, message, detail) {
  if (!host) return;
  host.classList.toggle('is-loading', state === 'loading');
  host.classList.toggle('is-error', state === 'error');
  const stateBox = host.querySelector('.dash-live-preview-state');
  if (stateBox) stateBox.innerHTML = `<strong>${escapeHtml(message || 'Preview')}</strong><span>${escapeHtml(detail || '')}</span>`;
}
function cachePreviewUrl(key, url) {
  previewResponseCache.set(key, url);
  while (previewResponseCache.size > MAX_PREVIEW_CACHE) {
    const oldestKey = previewResponseCache.keys().next().value;
    const oldestUrl = previewResponseCache.get(oldestKey);
    previewResponseCache.delete(oldestKey);
    if (oldestUrl) URL.revokeObjectURL(oldestUrl);
  }
}
function cancelLivePreview(kind) {
  const timer = previewTimers.get(kind);
  if (timer) clearTimeout(timer);
  previewTimers.delete(kind);
  previewControllers.get(kind)?.abort?.();
  previewControllers.delete(kind);
}
async function runLivePreview(host, kind, payload) {
  if (!host?.isConnected || !payload) return;
  const key = previewCacheKey(kind, payload);
  const cached = previewResponseCache.get(key);
  const img = host.querySelector('img');
  if (cached && img) {
    img.src = cached;
    img.hidden = false;
    setPreviewState(host, 'ready', 'Preview ready', '');
    return;
  }

  previewControllers.get(kind)?.abort?.();
  const controller = new AbortController();
  previewControllers.set(kind, controller);
  setPreviewState(host, 'loading', 'Generating preview…', 'Updates live while you edit.');

  try {
    const blob = await requestDashboardPreview(kind, payload, { signal: controller.signal });
    if (controller.signal.aborted || !host.isConnected) return;
    const imageUrl = URL.createObjectURL(blob);
    cachePreviewUrl(key, imageUrl);
    if (img) {
      img.src = imageUrl;
      img.hidden = false;
    }
    setPreviewState(host, 'ready', 'Preview ready', '');
  } catch (err) {
    if (controller.signal.aborted || !host.isConnected) return;
    setPreviewState(host, 'error', 'Preview unavailable', err.message || 'The live preview could not be generated.');
  } finally {
    if (previewControllers.get(kind) === controller) previewControllers.delete(kind);
  }
}
function scheduleLivePreview(host, kind, payload, delay = 320) {
  if (!host || !payload) return;
  const existing = previewTimers.get(kind);
  if (existing) clearTimeout(existing);
  const timeout = setTimeout(() => {
    previewTimers.delete(kind);
    runLivePreview(host, kind, payload);
  }, delay);
  previewTimers.set(kind, timeout);
}
function buildWelcomePreviewPayload(server, settings, kind = 'welcome') {
  return {
    kind,
    serverName: String(server?.name || '').trim() || 'PERSONAL',
    guildName: String(server?.name || '').trim() || 'PERSONAL',
    userName: activeName(),
    avatarUrl: userAvatarUrl(activeUser(), 256),
    memberCount: Number(server?.memberCount || 11),
    showMember: settings.showMember !== false,
    showAvatar: settings.showAvatar !== false,
    message: kind === 'goodbye'
      ? 'GOODBYE\n{user}'
      : 'WELCOME\n{user}',
    messageTemplate: kind === 'goodbye'
      ? 'GOODBYE\n{user}'
      : 'WELCOME\n{user}',
  };
}
function hydrateWelcomePreview(server, settings) {
  const welcomeHost = document.querySelector('[data-live-preview="welcome"]');
  const goodbyeHost = document.querySelector('[data-live-preview="goodbye"]');
  if (welcomeHost && settings.welcomeStyle !== 'Text only') scheduleLivePreview(welcomeHost, 'welcome', buildWelcomePreviewPayload(server, settings, 'welcome'));
  else cancelLivePreview('welcome');
  if (goodbyeHost && settings.goodbyeStyle !== 'Text only') scheduleLivePreview(goodbyeHost, 'goodbye', buildWelcomePreviewPayload(server, settings, 'goodbye'));
  else cancelLivePreview('goodbye');
}
function levelPreviewStats(settings = {}) {
  if (isDemoMode()) {
    const progress = Math.min(100, Math.round((DEMO_LEVELING.xp / DEMO_LEVELING.nextLevelXp) * 100));
    return {
      level: DEMO_LEVELING.level,
      nextLevel: DEMO_LEVELING.level + 1,
      currentXp: DEMO_LEVELING.xp,
      requiredXp: DEMO_LEVELING.nextLevelXp,
      totalXp: DEMO_LEVELING.xp + 10600,
      progress,
    };
  }
  const xpPerMessage = Math.max(1, Number(settings.xpPerMessage || settings.xp || 15));
  const level = 10;
  const requiredXp = 999;
  const currentXp = Math.min(requiredXp - 1, Math.max(30, xpPerMessage * 32));
  return {
    level,
    nextLevel: level + 1,
    currentXp,
    requiredXp,
    totalXp: currentXp + 10240,
    progress: Math.min(100, Math.round((currentXp / requiredXp) * 100)),
  };
}
function buildLevelPreviewPayload(server, settings) {
  const stats = levelPreviewStats(settings);
  return {
    serverName: String(server?.name || '').trim() || 'PERSONAL',
    guildName: String(server?.name || '').trim() || 'PERSONAL',
    userName: activeName(),
    avatarUrl: userAvatarUrl(activeUser(), 256),
    ...stats,
    neededXp: stats.requiredXp,
  };
}
function hydrateLevelPreview(server, settings, host = document.querySelector('[data-live-preview="level-up"]')) {
  if (!host) return;
  scheduleLivePreview(host, 'level-up', buildLevelPreviewPayload(server, settings));
}
function serverIcon(server, className = 'dash-server-icon') {
  if (server?.iconUrl) return `<span class="${className}"><img src="${escapeHtml(server.iconUrl)}" alt="" loading="lazy" /></span>`;
  return `<span class="${className} ${className}-fallback">${initial(server?.name || 'M')}</span>`;
}
function sectionTitle(section) {
  return ({ overview: 'Overview', welcome: 'Welcome Messages', leveling: 'Leveling System', 'ai-image-access': 'AI Image Access', logs: 'Logs', moderation: 'Moderation', settings: 'Settings' })[normalizeSection(section)] || 'Overview';
}
function sectionPath(server, section = 'overview') {
  const base = `${dashboardBase()}/server/${encodeURIComponent(server.id)}`;
  return `${base}#${encodeURIComponent(normalizeSection(section))}`;
}
function readSettings(guildId, section, defaults = {}, server = null) {
  let resolved = { ...defaults };
  const live = server?.settings?.[section];
  if (live) resolved = { ...resolved, ...live };
  else {
    try {
      const all = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
      resolved = { ...resolved, ...(all[guildId]?.[section] || {}) };
    } catch { /* keep defaults */ }
  }
  rememberOriginal(guildId, section, payloadForSection(section, resolved));
  const draft = currentDraft(guildId, section);
  return draft ? { ...resolved, ...draft } : resolved;
}
function writeSettings(guildId, section, values) {
  const all = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
  all[guildId] ||= {};
  all[guildId][section] = { ...(all[guildId][section] || {}), ...values };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(all));
}

function shell({ server = null, active = 'Dashboard', section = 'dashboard', content = '', showOwnerToggle = false, isOwner = false }) {
  return `
    <div class="dash-shell" ${server ? `data-dashboard-server-shell="${escapeHtml(server.id)}"` : ''}>${demoBadge()}
      <aside class="dash-sidebar" aria-label="Dashboard navigation">
        <div class="dash-brand-row">
          <a class="dash-brand" href="${dashboardBase()}"><span class="dash-brand-mark">M</span><strong>Meowz</strong></a>
          <a class="dash-round-action" href="/">+</a>
        </div>
        ${server ? currentServerCard(server) : dashboardCard()}
        ${sidebarNav(server, section)}
        <div class="dash-help-card"><strong>Need help?</strong><span>Open the documentation while the support server is being prepared.</span><a href="/docs">View docs</a></div>
      </aside>
      <div class="dash-main">
        ${topbar(server, active, showOwnerToggle, isOwner)}
        ${mobileBreadcrumb(server, active)}
        <div class="dash-content">
          ${content}
        </div>
      </div>
    </div>
  `;
}

function dashboardCard() {
  return `<a class="dash-current-server" href="${dashboardBase()}"><span class="dash-current-icon">M</span><span><strong>Meowz Dashboard</strong><small>Server manager</small></span></a>`;
}
function currentServerCard(server) {
  return `<a class="dash-current-server" href="${escapeHtml(sectionPath(server))}">${serverIcon(server, 'dash-current-icon')}<span><strong>${escapeHtml(server.name)}</strong><small>Server Settings</small></span><em>⌄</em></a>`;
}
function navLink(href, key, active, label) {
  return `<a class="${key === active ? 'is-active' : ''}" href="${escapeHtml(href)}"><span></span>${escapeHtml(label)}</a>`;
}
function sidebarNav(server, active) {
  if (server) {
    const settings = [
      ['overview', 'Overview'], ['welcome', 'Welcome / Goodbye'], ['leveling', 'Leveling System'], ['ai-image-access', 'AI Image Access'], ['logs', 'Logs'], ['moderation', 'Moderation'],
    ].map(([key, label]) => navLink(sectionPath(server, key), key, active, label)).join('');
    const resources = `${navLink('/docs', 'docs', active, 'Documentation')}${navLink('/changelog', 'changelog', active, 'Changelog')}`;
    const account = navLink(settingsPath(), 'settings', active, 'Settings');
    return `<nav class="dash-side-nav"><small>Dashboard</small>${settings}</nav><nav class="dash-side-nav muted"><small>Resources</small>${resources}</nav><nav class="dash-side-nav muted"><small>Account</small>${account}</nav>`;
  }
  const dashboard = `${navLink(dashboardBase(), 'dashboard', active, 'Overview')}${navLink(settingsPath(), 'settings', active, 'Settings')}`;
  const resources = `${navLink('/docs', 'docs', active, 'Documentation')}${navLink('/changelog', 'changelog', active, 'Changelog')}`;
  return `<nav class="dash-side-nav"><small>Dashboard</small>${dashboard}</nav><nav class="dash-side-nav muted"><small>Resources</small>${resources}</nav>`;
}
function topbar(server, active, showOwnerToggle, isOwner) {
  return `
    <header class="dash-topbar">
      <div class="dash-breadcrumb"><a href="${dashboardBase()}">Servers</a>${server ? `<span>›</span><a href="${escapeHtml(sectionPath(server))}">${escapeHtml(server.name)}</a><span data-dashboard-active-separator ${active === 'Overview' ? 'hidden' : ''}>›</span><strong data-dashboard-active-crumb ${active === 'Overview' ? 'hidden' : ''}>${escapeHtml(active)}</strong>` : ''}</div>
      <div class="dash-top-actions">
        ${showOwnerToggle && isOwner ? ownerToggle() : ''}
        ${server ? `<a class="dash-primary-small" href="/">View Bot</a>` : ''}
        <a class="dash-user-pill" href="${settingsPath()}">${avatarHtml()}<span><strong>${escapeHtml(activeName())}</strong><small>${escapeHtml(activeUsername())}</small></span><em>OWNER</em></a>
      </div>
    </header>`;
}
function ownerToggle() {
  return `<div class="dash-owner-toggle" role="group" aria-label="Dashboard view mode"><button type="button" data-owner-mode="user" class="${viewMode === 'user' ? 'is-active' : ''}">User View</button><button type="button" data-owner-mode="owner" class="${viewMode === 'owner' ? 'is-active' : ''}">Owner View</button></div>`;
}
function mobileBar(server, active = 'Dashboard', showOwnerToggle = false, isOwner = false) {
  const dashboardLinks = server ? [
    ['Overview', sectionPath(server)],
    ['Welcome/Goodbye', sectionPath(server, 'welcome')],
    ['Leveling', sectionPath(server, 'leveling')],
    ['AI Image Access', sectionPath(server, 'ai-image-access')],
    ['Logs', sectionPath(server, 'logs')],
    ['Moderation', sectionPath(server, 'moderation')],
  ] : [['Overview', dashboardBase()]];
  const resourceLinks = [['Documentation', '/docs'], ['Changelog', '/changelog']];
  const accountLinks = [['Settings', settingsPath()]];
  const activeLabel = server ? server.name : 'Dashboard';
  const renderGroup = (title, links) => `<div class="dash-drawer-group"><small>${escapeHtml(title)}</small>${links.map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('')}</div>`;
  return `<header class="dash-mobile-bar"><a class="dash-brand" href="${dashboardBase()}"><span class="dash-brand-mark">M</span><strong>Meowz</strong></a><button type="button" class="dash-menu-btn" data-dash-menu aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button><div class="dash-mobile-backdrop" data-dash-backdrop hidden></div><aside class="dash-mobile-drawer" data-dash-drawer hidden><div class="dash-drawer-head"><span>${server ? serverIcon(server, 'dash-current-icon') : '<span class="dash-current-icon">M</span>'}</span><div><strong>${escapeHtml(activeLabel)}</strong><small>${escapeHtml(active)}</small></div></div>${showOwnerToggle && isOwner ? `<div class="dash-drawer-toggle">${ownerToggle()}</div>` : ''}<nav>${renderGroup('Dashboard', dashboardLinks)}${renderGroup('Resources', resourceLinks)}${renderGroup('Account', accountLinks)}${isDemoMode() ? '<div class="dash-drawer-group"><a href="/">Exit Demo</a></div>' : '<div class="dash-drawer-group"><a href="/auth/logout" class="danger">Logout</a></div>'}</nav></aside></header>`;
}
function mobileBreadcrumb(server, active = 'Dashboard') {
  return `<div class="dash-mobile-breadcrumb"><a href="${dashboardBase()}">Dashboard</a>${server ? `<span>›</span><a href="${escapeHtml(sectionPath(server))}">${escapeHtml(server.name)}</a><span data-dashboard-active-separator ${active === 'Overview' ? 'hidden' : ''}>›</span><strong data-dashboard-active-crumb ${active === 'Overview' ? 'hidden' : ''}>${escapeHtml(active)}</strong>` : ''}</div>`;
}
function closeDashDrawer(bar = document) {
  const scope = bar?.querySelector ? bar : document;
  scope.querySelectorAll('[data-dash-drawer]').forEach((drawer) => {
    drawer.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
  });
  scope.querySelectorAll('[data-dash-backdrop]').forEach((backdrop) => {
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
  });
  scope.querySelectorAll('[data-dash-menu]').forEach((btn) => {
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  });
  document.body.classList.remove('dash-drawer-open');
}

function openDashDrawer(bar, btn) {
  closeDashDrawer(document);
  const drawer = bar?.querySelector('[data-dash-drawer]');
  const backdrop = bar?.querySelector('[data-dash-backdrop]');
  if (!drawer) return;
  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  if (backdrop) {
    backdrop.hidden = false;
    backdrop.setAttribute('aria-hidden', 'false');
  }
  btn?.classList.add('is-open');
  btn?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('dash-drawer-open');
}

function wireShell(root = document) {
  closeDashDrawer(document);
  root.querySelectorAll('[data-dash-menu]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const bar = btn.closest('.dash-mobile-bar');
      const drawer = bar?.querySelector('[data-dash-drawer]');
      if (!drawer) return;
      if (drawer.hidden) openDashDrawer(bar, btn);
      else closeDashDrawer(bar);
    });
  });

  root.querySelectorAll('[data-dash-backdrop]').forEach((backdrop) => {
    backdrop.addEventListener('click', () => closeDashDrawer(document));
  });

  root.querySelectorAll('.dash-mobile-drawer a, .dash-mobile-drawer button[data-owner-mode]').forEach((el) => {
    el.addEventListener('click', () => setTimeout(() => closeDashDrawer(document), 80));
  });

  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDashDrawer(document); }, { once: true });
  window.addEventListener('resize', () => closeDashDrawer(document), { once: true });
  window.addEventListener('pagehide', () => closeDashDrawer(document), { once: true });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDashDrawer(document);
  }, { once: true });

  root.querySelectorAll('[data-owner-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.ownerMode === 'owner' ? 'owner' : 'user';
      if (mode === viewMode) return;
      viewMode = mode;
      localStorage.setItem(OWNER_VIEW_STORAGE_KEY, viewMode);
      closeDashDrawer(document);
      showStatusToast('success', 'View mode changed', mode === 'owner' ? 'Owner view enabled.' : 'User preview enabled.');
      const route = routeInfo();
      if (route?.settings) renderSettingsPage();
      else if (route?.id) renderServerPage(route.id, route.section);
      else renderDashboardHome();
    });
  });
}

function serverRow(server, type = 'installed') {
  const installed = type === 'installed';
  const href = installed ? (server.manageUrl || `${dashboardBase()}/server/${encodeURIComponent(server.id)}`) : (server.inviteUrl || '#');
  const subtitle = typeof server.memberCount === 'number' ? `${formatNumber(server.memberCount)} members` : (installed ? 'Meowz installed' : 'Ready to invite');
  return `<a class="dash-server-row" href="${escapeHtml(href)}" ${installed ? '' : 'target="_blank" rel="noopener noreferrer"'}>${serverIcon(server, 'dash-list-icon')}<span><strong>${escapeHtml(server.name)}</strong><small>${escapeHtml(subtitle)}</small>${server.accessLabel ? `<em>${escapeHtml(server.accessLabel)}</em>` : ''}</span><b>${installed ? 'Open' : 'Invite'}</b></a>`;
}
function dashboardHomeContent(data) {
  const installed = Array.isArray(data.installed) ? data.installed : [];
  const available = Array.isArray(data.available) ? data.available : [];
  return `
    <section class="dash-page-title">
      <span>Dashboard</span>
      <h1>Welcome back, ${escapeHtml(activeName())}</h1>
      <p>${isDemoMode() ? 'Preview the protected dashboard with safe fake data. Demo mode is read-only and never changes Discord.' : 'Choose a server below to manage Meowz. Use owner view to preview every server Meowz is installed in.'}</p>
      ${data.isOwner ? `<div class="dash-owner-inline">${ownerToggle()}</div>` : ''}
    </section>
    <section id="servers" class="dash-grid two">
      <article class="dash-card"><div class="dash-card-head"><div><span>Servers with Meowz</span><h2>${viewMode === 'owner' ? 'All installed servers' : 'Manage installed servers'}</h2><p>Choose a server to open its settings.</p></div><b>${installed.length} server${installed.length === 1 ? '' : 's'}</b></div><div class="dash-list">${installed.length ? installed.map((s) => serverRow(s, 'installed')).join('') : emptyState('No installed servers found.', 'Servers visible in this mode will appear here.')}</div></article>
      <article class="dash-card"><div class="dash-card-head"><div><span>Available servers</span><h2>Invite Meowz</h2><p>Servers where you can add Meowz will appear here.</p></div><b>${available.length} server${available.length === 1 ? '' : 's'}</b></div><div class="dash-list">${available.length ? available.map((s) => serverRow(s, 'available')).join('') : emptyState('No available servers found.', 'Meowz is already installed in all servers available to this view.')}</div></article>
    </section>`;
}
async function renderDashboardHome() {
  if (!els.home) return;
  document.body.classList.remove('has-dashboard-unsaved', 'has-dashboard-status');
  activeServerShellId = null;
  els.home.hidden = false;
  if (els.detail) els.detail.hidden = true;
  document.title = 'Dashboard — Meowz';
  els.home.innerHTML = shell({ content: loadingCard('Loading dashboard...') });
  try {
    const data = await getDashboardGuilds(viewMode);
    storeServerSnapshots(data);
    els.home.innerHTML = shell({ active: 'Dashboard', section: 'dashboard', showOwnerToggle: true, isOwner: Boolean(data.isOwner), content: dashboardHomeContent(data) });
    wireShell(els.home);
  } catch (err) {
    showStatusToast('error', 'Dashboard failed to load', err.message || 'Could not load servers.');
    els.home.innerHTML = shell({ active: 'Dashboard', content: errorCard('Could not load dashboard.', err.message || 'Try again later.') });
    wireShell(els.home);
  }
}

function pillRow(server) {
  const members = typeof server.memberCount === 'number' ? `${formatNumber(server.memberCount)} members` : 'Members unavailable';
  return `<div class="dash-pills"><span>${escapeHtml(members)}</span><span>${escapeHtml(server.accessLabel || 'Manage Server')}</span><span>Bot Installed</span></div>`;
}
function serverHeader(server, active) {
  const tabs = [['overview','Overview'],['welcome','Welcome / Goodbye'],['leveling','Leveling'],['ai-image-access','AI Image Access'],['logs','Logs'],['moderation','Moderation']];
  return `<section class="dash-server-title">${serverIcon(server, 'dash-title-icon')}<div><span>Server Dashboard</span><h1>${escapeHtml(server.name)}</h1><p>Manage Meowz features for this server.</p>${pillRow(server)}</div></section><nav class="dash-tabs">${tabs.map(([key,label]) => `<a class="${key===active?'is-active':''}" href="${escapeHtml(sectionPath(server,key))}">${escapeHtml(label)}</a>`).join('')}</nav>`;
}
function infoRow(label, value) { return `<div class="dash-info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`; }

function simulationPanel(title, description, events = []) {
  const buttons = events.map(({ event, label, primary = false }) => `<button type="button" class="${primary ? 'dash-save-btn' : 'dash-secondary-btn'} dash-simulation-btn" data-simulation-event="${escapeHtml(event)}">${escapeHtml(label)}</button>`).join('');
  return `<article class="dash-card dash-simulation-card" data-simulation-panel><span>Simulation</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><div class="dash-simulation-actions">${buttons}</div><div class="dash-simulation-result" data-simulation-result hidden aria-live="polite"></div><small class="preview-note">Discord simulations use the last saved settings and never grant XP, roles, warnings or punishments.</small></article>`;
}

function overviewPage(server) {
  return `<section class="dash-grid two"><article class="dash-card"><span>Information</span><h2>Server information</h2><div class="dash-info-list">${infoRow('Name',server.name)}${infoRow('Server ID',server.id)}${infoRow('Members',typeof server.memberCount === 'number' ? formatNumber(server.memberCount) : 'Unavailable')}${infoRow('Status','Meowz installed')}</div></article><article class="dash-card"><span>Permissions</span><h2>Dashboard access</h2><div class="dash-info-list">${infoRow('Your access',server.accessLabel || 'Manage Server')}${infoRow('Dashboard access','Allowed')}${infoRow('View mode',server.ownerView ? 'Owner View' : 'User View')}</div></article></section><section class="dash-card"><span>Server tools</span><h2>Configure Meowz</h2><div class="dash-feature-grid">${[['welcome','Welcome / Goodbye','Member join and leave messages.'],['leveling','Leveling System','XP, cooldowns and level rewards.'],['ai-image-access','AI Image Access','Control who can use image editing.'],['logs','Logs','Server activity and audit events.'],['moderation','Moderation','Warnings and automod settings.']].map(([key,title,desc]) => `<a href="${escapeHtml(sectionPath(server,key))}" class="dash-feature-card"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc)}</span></a>`).join('')}</div></section>${simulationPanel('Test bot connection', 'Verify that the website can reach Meowz and that the bot can see this server.', [{ event: 'connection', label: 'Test Connection', primary: true }])}`;
}

function welcomePage(server) {
  const s = readSettings(server.id, 'welcome', {
    welcomeEnabled: true,
    welcomeChannelId: 'demo-ch-welcome',
    welcomeStyle: 'Custom Card (Modern)',
    welcomeMessage: 'Welcome {user} to {server}!\n\nWe hope you have fun and enjoy!',
    goodbyeEnabled: false,
    goodbyeChannelId: 'demo-ch-goodbye',
    goodbyeStyle: 'Text only',
    goodbyeMessage: 'Goodbye {user}, hope you had fun!',
    showMember: true,
    showAvatar: true,
  }, server);
  s.welcomeChannelId = s.welcomeChannelId ?? s.welcomeChannel ?? s.channel ?? 'demo-ch-welcome';
  s.goodbyeChannelId = s.goodbyeChannelId ?? s.goodbyeChannel ?? 'demo-ch-goodbye';
  s.welcomeStyle = s.welcomeStyle ?? 'Custom Card (Modern)';
  s.goodbyeStyle = s.goodbyeStyle ?? 'Text only';

  return `<form class="dash-designer dash-designer-wide dash-welcome-layout" data-settings-form="welcome" data-guild-id="${escapeHtml(server.id)}">
    <div class="dash-welcome-settings-stack">
      <article class="dash-card dash-form-card">
        <div class="dash-card-head"><div><span>Welcome Messages</span><h2>Welcome Messages</h2><p>Configure the Discord message Meowz sends when someone joins ${escapeHtml(server.name)}.</p></div><b class="status ${s.welcomeEnabled?'enabled':''}">${s.welcomeEnabled?'Enabled':'Disabled'}</b></div>
        ${switchField('welcomeEnabled',s.welcomeEnabled,'Enable welcome messages','Send a message when someone joins the server.')}
        <hr/>
        ${channelSelectField(server,'welcomeChannelId','Welcome Channel',s.welcomeChannelId,'welcome')}
        <label class="dash-field"><span>Welcome Style</span><select name="welcomeStyle"><option ${s.welcomeStyle === 'Custom Card (Modern)' ? 'selected' : ''}>Custom Card (Modern)</option><option ${s.welcomeStyle === 'Text only' ? 'selected' : ''}>Text only</option></select></label>
        ${variableButtons('welcomeMessage')}
        ${textareaField('welcomeMessage','Welcome Message',s.welcomeMessage,200)}
        <div class="dash-option-list">${switchField('showMember',s.showMember,'Show member number on the card','Display the member position in the server.')}${switchField('showAvatar',s.showAvatar,'Show avatar on the card','Display the member avatar on the profile card.')}</div>
      </article>

      <article class="dash-card dash-form-card">
        <div class="dash-card-head"><div><span>Goodbye Messages</span><h2>Goodbye Messages</h2><p>Configure the separate leave message and destination channel.</p></div><b class="status ${s.goodbyeEnabled?'enabled':''}">${s.goodbyeEnabled?'Enabled':'Disabled'}</b></div>
        ${switchField('goodbyeEnabled',s.goodbyeEnabled,'Enable goodbye messages','Send a message when someone leaves the server.')}
        <hr/>
        ${channelSelectField(server,'goodbyeChannelId','Goodbye Channel',s.goodbyeChannelId,'bye')}
        <label class="dash-field"><span>Goodbye Style</span><select name="goodbyeStyle"><option ${s.goodbyeStyle === 'Text only' ? 'selected' : ''}>Text only</option><option ${s.goodbyeStyle === 'Custom Card (Modern)' ? 'selected' : ''}>Custom Card (Modern)</option></select></label>
        ${variableButtons('goodbyeMessage')}
        ${textareaField('goodbyeMessage','Goodbye Message',s.goodbyeMessage,200)}
        <small class="preview-note">The message text stays in Discord. Custom cards are compact profile cards with avatar, username and optional member number.</small>
        ${saveBtn()}
      </article>
    </div>
    <aside class="dash-welcome-preview-column dash-sticky-column">
      ${welcomePreview(server,s)}
      ${simulationPanel('Send test events', 'Send safe welcome and goodbye simulations to the saved Discord channels.', [{ event: 'welcome', label: 'Simulate Join', primary: true }, { event: 'goodbye', label: 'Simulate Leave' }])}
    </aside>
  </form>`;
}
function renderTemplate(template, server) {
  return String(template || '').replaceAll('{user}', 'Rafa').replaceAll('{server}', server.name).replaceAll('{memberCount}', '11');
}
function messagePreviewLine(server, template, fallback) {
  return renderTemplate(template || fallback, server).split('\n').map(x => x.trim()).filter(Boolean).join(' ');
}
function selectedChannelName(server, channelId, fallback) {
  const channels = textChannels(server);
  const found = channels.find((channel) => channel.id === String(channelId) || normalizeChannelValue(channel.name) === normalizeChannelValue(channelId));
  return `#${escapeHtml((found?.name || fallback || 'channel').replace(/^#\s*/, ''))}`;
}
function welcomePreview(server, settings) {
  const welcomeText = messagePreviewLine(server, settings.welcomeMessage, `Welcome {user} to {server}!`);
  const goodbyeText = messagePreviewLine(server, settings.goodbyeMessage, `Goodbye {user}.`);
  const welcomeCardMarkup = settings.welcomeStyle === 'Text only' ? '' : livePreviewShell('welcome', 'Welcome card preview');
  const goodbyeCardMarkup = settings.goodbyeStyle === 'Text only' ? '' : livePreviewShell('goodbye', 'Goodbye card preview');
  return `<article class="dash-card dash-preview" data-welcome-preview><span>Live Preview</span><h2>Discord preview</h2><p>The Discord message remains fully editable. The attached image is a compact profile card that avoids long-text wrapping.</p><div class="dash-discord-stack"><div class="dash-discord-message"><div class="bot-avatar">M</div><div><div class="msg-head"><strong>Meowz</strong><em>APP</em><small>${selectedChannelName(server, settings.welcomeChannelId, 'welcome')}</small></div><p>${escapeHtml(welcomeText)}</p>${welcomeCardMarkup}</div></div><div class="dash-discord-message goodbye"><div class="bot-avatar">M</div><div><div class="msg-head"><strong>Meowz</strong><em>APP</em><small>${selectedChannelName(server, settings.goodbyeChannelId, 'bye')}</small></div><p>${escapeHtml(goodbyeText)}</p>${goodbyeCardMarkup}</div></div></div><small class="preview-note">These previews regenerate live and do not require saving first.</small></article>`;
}
function updateWelcomePreview(server, form) {
  const preview = document.querySelector('[data-welcome-preview]');
  if (!preview) return;
  const settings = getFormValues(form);
  preview.outerHTML = welcomePreview(server, settings);
  hydrateWelcomePreview(server, settings);
}

function levelingPage(server) {
  const s = readSettings(server.id, 'leveling', { enabled:true, xpPerMessage:15, cooldownSeconds:60, channelId:'demo-ch-level-up', stackRoles:true }, server);
  const rewards = Array.isArray(server?.settings?.levelRewards) ? server.settings.levelRewards : [];
  const firstRole = guildRoles(server)[0]?.id || '';
  const previewStats = levelPreviewStats(s);
  return `<form class="dash-designer" data-settings-form="leveling" data-guild-id="${escapeHtml(server.id)}"><article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Leveling System</span><h2>Leveling</h2><p>Configure XP, cooldowns and level-up messages.</p></div><b class="status ${s.enabled?'enabled':''}">${s.enabled?'Enabled':'Disabled'}</b></div>${switchField('enabled',s.enabled,'Enable leveling','Members earn XP when they chat.')}<hr/>${numberField('xpPerMessage','XP per message',s.xpPerMessage ?? s.xp,1)}${numberField('cooldownSeconds','Cooldown seconds',s.cooldownSeconds ?? s.cooldown,5)}${channelSelectField(server,'channelId','Level-up channel',s.channelId ?? s.channel,'level-up')}${switchField('stackRoles',s.stackRoles !== false,'Keep previous level roles','Do not remove older rewards when members level up.')}${saveBtn()}</article><div class="dash-section-stack dash-sticky-column"><article class="dash-card"><span>Preview</span><h2>Level rewards</h2><p>A live preview of the level-up card using the current unsaved values.</p>${livePreviewShell('level-up', 'Level up card preview')}<div class="dash-level-meta" data-level-preview-meta><strong>Level ${formatNumber(previewStats.level)} → ${formatNumber(previewStats.nextLevel)}</strong><span>${formatNumber(previewStats.currentXp)} / ${formatNumber(previewStats.requiredXp)} XP · ${previewStats.progress}% progress</span></div><div class="dash-role-table" data-level-rewards><div class="dash-role-table-head"><strong>Reward roles</strong></div><div class="dash-inline-form dash-reward-editor">${numberField('rewardLevel','Reward level',5,1)}${roleSelectField(server,'rewardRoleId','Reward role',firstRole)}<button type="button" class="dash-save-btn" data-add-level-reward>Add Role</button></div>${rewards.length ? rewards.map((r) => `<div class="dash-role-row"><span>Level ${escapeHtml(r.level)}</span><strong>@${escapeHtml(r.roleName || r.role || r.roleId)}</strong><button type="button" data-remove-level-reward="${escapeHtml(r.level)}">Remove</button></div>`).join('') : emptyState('No reward roles configured.', 'Add a level and role above to make level rewards real.')}</div><small class="preview-note">Reward roles are loaded from and saved through the bot API.</small></article>${simulationPanel('Simulate level-up', 'Send a level-up card without changing XP or granting reward roles.', [{ event: 'level-up', label: 'Simulate Level Up', primary: true }])}</div></form>`;
}
function updateLevelingPreview(server, form) {
  const host = document.querySelector('[data-live-preview="level-up"]');
  const meta = document.querySelector('[data-level-preview-meta]');
  if (!host || !meta) return;
  const settings = getFormValues(form);
  const stats = levelPreviewStats(settings);
  meta.innerHTML = `<strong>Level ${escapeHtml(formatNumber(stats.level))} → ${escapeHtml(formatNumber(stats.nextLevel))}</strong><span>${escapeHtml(formatNumber(stats.currentXp))} / ${escapeHtml(formatNumber(stats.requiredXp))} XP · ${escapeHtml(stats.progress)}% progress</span>`;
  hydrateLevelPreview(server, settings, host);
}

function logsPage(server) {
  const s = readSettings(server.id, 'logs', { enabled:false, channelId:'demo-ch-logs', messageEvents:true, memberEvents:true, moderationEvents:true, voiceEvents:false }, server);
  return `<form class="dash-designer" data-settings-form="logs" data-guild-id="${escapeHtml(server.id)}"><article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Logs</span><h2>Logs</h2><p>Configure real bot log channels and event tracking for ${escapeHtml(server.name)}.</p></div><b class="status ${s.enabled?'enabled':''}">${s.enabled?'Enabled':'Disabled'}</b></div>${switchField('enabled',s.enabled,'Enable logs','Send selected events to a log channel.')}<hr/>${channelSelectField(server,'channelId','Log channel',s.channelId ?? s.channel,'logs')}${switchField('messageEvents',s.messageEvents ?? s.messages,'Message logs','Track message delete and edit events.')}${switchField('memberEvents',s.memberEvents ?? s.members,'Member logs','Track joins and leaves.')}${switchField('moderationEvents',s.moderationEvents ?? s.moderation,'Moderation logs','Track warnings, bans and automod actions.')}${switchField('voiceEvents',s.voiceEvents ?? s.voice,'Voice logs','Track voice channel joins and leaves.')}${saveBtn()}</article><div class="dash-section-stack"><article class="dash-card"><span>Live examples</span><h2>Tracked activity</h2><div class="dash-log-status-grid">${logStatus('Message Logs', s.messageEvents ?? s.messages)}${logStatus('Member Logs', s.memberEvents ?? s.members)}${logStatus('Voice Logs', s.voiceEvents ?? s.voice)}${logStatus('Moderation Logs', s.moderationEvents ?? s.moderation)}</div>${logExample('Member joined','A real member join event can be logged by the bot.','success')}${logExample('Message deleted','Deleted and edited messages are logged when enabled.','warn')}${logExample('Moderation action','Automod actions are sent to logs when enabled.','mod')}</article>${simulationPanel('Send log examples', 'Send safe sample embeds for each saved log category.', [{ event: 'log-member', label: 'Member Join' }, { event: 'log-message', label: 'Message Delete' }, { event: 'log-moderation', label: 'Moderation' }, { event: 'log-voice', label: 'Voice Activity' }])}</div></form>`;
}
function logStatus(label, enabled) { return `<div class="dash-log-status ${enabled ? 'on' : 'off'}"><span>${escapeHtml(label)}</span><strong>${enabled ? 'Enabled' : 'Disabled'}</strong></div>`; }
function logExample(title, text, type) { return `<div class="dash-log-example ${type}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`; }
function moderationPage(server) {
  const s = readSettings(server.id, 'moderation', { enabled:false, warningsEnabled:true, automodEnabled:false, antiSpam:false, linkFilter:false, inviteFilter:false, modLogChannelId:'demo-ch-mod-logs', blockedWords:'' }, server);
  return `<section class="dash-designer dash-moderation-layout" data-moderation-page>
    <form class="dash-card dash-form-card dash-moderation-settings" data-settings-form="moderation" data-guild-id="${escapeHtml(server.id)}">
      <div class="dash-card-head"><div><span>Moderation</span><h2>Moderation Tools</h2><p>Configure warnings, filters and moderation controls used by the bot.</p></div><b class="status ${s.enabled?'enabled':''}">${s.enabled?'Enabled':'Disabled'}</b></div>
      ${switchField('enabled',s.enabled,'Enable moderation tools','Turn on configurable moderation features.')}<hr/>
      ${channelSelectField(server,'modLogChannelId','Mod log channel',s.modLogChannelId ?? s.channel,'mod-logs')}
      ${switchField('warningsEnabled',s.warningsEnabled ?? s.warnings,'Warning system','Allow moderators to warn users.')}
      ${switchField('automodEnabled',s.automodEnabled,'Blocked words','Enable blocked word checks.')}
      ${switchField('antiSpam',s.antiSpam,'Anti-spam','Detect repeated messages automatically.')}
      ${switchField('linkFilter',s.linkFilter ?? s.antiLinks,'Link filter','Block links from non-trusted users.')}
      ${switchField('inviteFilter',s.inviteFilter ?? s.antiInvites,'Invite filter','Block Discord invite links.')}
      ${textareaField('blockedWords','Blocked words',s.blockedWords || '',500)}
      ${saveBtn()}
    </form>
    <article class="dash-card dash-form-card dash-moderation-access-card" data-moderation-access>
      <span>Bypass Access</span><h2>Trusted users</h2><p>Bot owner and users with Manage Server bypass moderation filters by default. Add extra trusted users by username search or Discord ID.</p>
      ${userAccessForm('moderation', 'Search user or paste ID')}
      <div data-moderation-access-list aria-live="polite">${emptyState('Loading bypass list...', 'Please wait.')}</div>
    </article>
    <div class="dash-section-stack"><article class="dash-card dash-automation-card"><span>Rules</span><h2>Automation</h2><div class="dash-feature-grid compact">${['Warnings','Anti-spam','Link filter','Invite filter','Mod logs'].map(x => `<div class="dash-feature-card"><strong>${x}</strong><span>Connected to bot API.</span></div>`).join('')}</div></article>${simulationPanel('Simulate automod', 'Send a safe automod test embed. It does not delete a message or punish a member.', [{ event: 'moderation', label: 'Simulate Automod', primary: true }])}</div>
  </section>`;
}
function aiPage(server) {
  return `<section class="dash-designer" data-ai-page><article class="dash-card dash-form-card"><span>AI Image Access</span><h2>Allowed users</h2><p>Control who can use the image editing command in ${escapeHtml(server.name)}.</p>${userAccessForm('ai', 'Search user or paste ID')}<small class="preview-note">Bot owner and users with Manage Server permission have access by default. Manual users can be added by username search or Discord ID.</small></article><div class="dash-section-stack"><article class="dash-card"><span>Current Access</span><h2>People allowed</h2><div data-ai-access-list>${emptyState('Loading access list...', 'Please wait.')}</div></article>${simulationPanel('Test your access', 'Ask the bot whether your current Discord account can use AI image editing in this server.', [{ event: 'image-access', label: 'Test AI Access', primary: true }])}</div></section>`;
}
async function loadAiAccess(guildId) {
  const holder = document.querySelector('[data-ai-access-list]');
  if (!holder) return;
  holder.innerHTML = emptyState('Loading access list...', 'Please wait.');
  try {
    const data = await getImageAccess(guildId);
    holder.innerHTML = renderAccessList(data, 'No manually added users.');
  } catch (err) {
    holder.innerHTML = errorCard('Could not load access list.', err.message || 'Try again later.');
  }
}
async function loadModerationAccess(guildId, holder = document.querySelector('[data-moderation-access-list]')) {
  if (!holder) return;
  const requestId = `${guildId}:${Date.now()}:${Math.random()}`;
  holder.dataset.moderationRequestId = requestId;
  holder.innerHTML = emptyState('Loading bypass list...', 'Fetching trusted users from the bot API.');
  try {
    const data = await getModerationAccess(guildId);
    if (!holder.isConnected || holder.dataset.moderationRequestId !== requestId) return;
    holder.innerHTML = renderAccessList(data || {}, 'No manual moderation bypass users.');
  } catch (err) {
    if (!holder.isConnected || holder.dataset.moderationRequestId !== requestId) return;
    holder.innerHTML = renderAccessList({ ok: true, defaultUsers: [], users: [], fallback: true, error: err.message }, 'No manual moderation bypass users.');
    showStatusToast('error', 'Moderation bypass loaded with fallback', err.message || 'The bot API did not respond in time.');
  }
}
function attachUserSearch(form, server) {
  const input = form.querySelector('[data-user-search]');
  const hidden = form.querySelector('[data-user-id]');
  const results = form.querySelector('[data-user-search-results]');
  if (!input || !hidden || !results) return;
  let timer = null;
  input.addEventListener('input', () => {
    const value = String(input.value || '').trim();
    hidden.value = /^\d{15,25}$/.test(value) ? value : '';
    clearTimeout(timer);
    if (value.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      try {
        const data = await searchGuildUsers(server.id, value, 8);
        const users = Array.isArray(data.users) ? data.users : [];
        results.innerHTML = users.length ? users.map(userSuggestionRow).join('') : '<div class="dash-user-search-empty">No users found. You can paste a Discord ID manually.</div>';
        results.hidden = false;
      } catch (err) {
        results.innerHTML = `<div class="dash-user-search-empty">${escapeHtml(err.message || 'Search failed.')}</div>`;
        results.hidden = false;
      }
    }, 220);
  });
  results.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-user-suggestion]');
    if (!btn) return;
    hidden.value = btn.dataset.userId || '';
    input.value = btn.dataset.userLabel ? `${btn.dataset.userLabel} (${hidden.value})` : hidden.value;
    results.hidden = true;
  });
  document.addEventListener('click', (event) => {
    if (!form.contains(event.target)) results.hidden = true;
  });
}
function readUserIdFromAccessForm(form) {
  const hidden = form.querySelector('input[name="userId"]');
  const raw = String(hidden?.value || form.querySelector('input[name="userSearch"]')?.value || '').trim();
  const match = raw.match(/\d{15,25}/);
  return match ? match[0] : raw;
}
function attachAiPage(server) {
  const page = document.querySelector('[data-ai-page]');
  if (!page) return;
  loadAiAccess(server.id);
  const form = page.querySelector('[data-access-form="ai"]');
  if (form) attachUserSearch(form, server);
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = readUserIdFromAccessForm(e.currentTarget);
    if (!/^\d{15,25}$/.test(userId)) return showStatusToast('error', 'Invalid user ID', 'Search a user or paste a valid Discord user ID.');
    const btn = e.currentTarget.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Adding...';
    try { await addImageAccessUser(server.id, userId); e.currentTarget.reset(); e.currentTarget.querySelector('input[name="userId"]').value = ''; showStatusToast('success', 'Access updated', 'User was added.'); await loadAiAccess(server.id); }
    catch (err) { showStatusToast('error', 'Could not add user', err.message || 'Try again later.'); }
    finally { btn.disabled = false; btn.textContent = 'Add user'; }
  });
  page.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove-ai-user]');
    if (!btn) return;
    const userId = btn.dataset.removeAiUser;
    if (!confirm(`Remove access from ${btn.dataset.removeAiLabel || userId}?`)) return;
    btn.disabled = true; btn.textContent = 'Removing...';
    try { await removeImageAccessUser(server.id, userId); showStatusToast('success', 'Access updated', 'User was removed.'); await loadAiAccess(server.id); }
    catch (err) { showStatusToast('error', 'Could not remove user', err.message || 'Try again later.'); btn.disabled = false; btn.textContent = 'Remove'; }
  });
}
function attachModerationAccess(server) {
  const page = document.querySelector('[data-moderation-page]');
  const holder = page?.querySelector('[data-moderation-access-list]');
  if (!page || !holder) return;
  loadModerationAccess(server.id, holder);
  const form = page.querySelector('[data-access-form="moderation"]');
  if (!form) {
    holder.innerHTML = errorCard('Could not initialize trusted users.', 'The moderation access form is unavailable.');
    return;
  }
  attachUserSearch(form, server);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isDemoMode()) { readOnlyDemoToast(); return; }
    const userId = readUserIdFromAccessForm(e.currentTarget);
    if (!/^\d{15,25}$/.test(userId)) return showStatusToast('error', 'Invalid user ID', 'Search a user or paste a valid Discord user ID.');
    const btn = e.currentTarget.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Adding...';
    try { await addModerationAccessUser(server.id, userId); e.currentTarget.reset(); e.currentTarget.querySelector('input[name="userId"]').value = ''; showStatusToast('success', 'Moderation bypass updated', 'User was added.'); await loadModerationAccess(server.id, holder); }
    catch (err) { showStatusToast('error', 'Could not add user', err.message || 'Try again later.'); }
    finally { btn.disabled = false; btn.textContent = 'Add user'; }
  });
  holder.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove-ai-user]');
    if (!btn) return;
    const userId = btn.dataset.removeAiUser;
    if (!confirm(`Remove moderation bypass from ${btn.dataset.removeAiLabel || userId}?`)) return;
    btn.disabled = true; btn.textContent = 'Removing...';
    try { await removeModerationAccessUser(server.id, userId); showStatusToast('success', 'Moderation bypass updated', 'User was removed.'); await loadModerationAccess(server.id, holder); }
    catch (err) { showStatusToast('error', 'Could not remove user', err.message || 'Try again later.'); btn.disabled = false; btn.textContent = 'Remove'; }
  });
}
function getFormValues(form) {
  const values = {};
  new FormData(form).forEach((value, key) => { values[key] = value; });
  form.querySelectorAll('input[type="checkbox"]').forEach(input => { values[input.name] = input.checked; });
  return values;
}

function updateLogsPreview(form) {
  const grid = form?.querySelector('.dash-log-status-grid');
  if (!grid) return;
  const isOn = (name) => Boolean(form.querySelector(`[name="${CSS.escape(name)}"]`)?.checked);
  grid.innerHTML = `${logStatus('Message Logs', isOn('messageEvents'))}${logStatus('Member Logs', isOn('memberEvents'))}${logStatus('Voice Logs', isOn('voiceEvents'))}${logStatus('Moderation Logs', isOn('moderationEvents'))}`;
}
function payloadForSection(section, values) {
  if (section === 'welcome') {
    return {
      welcomeEnabled: Boolean(values.welcomeEnabled),
      goodbyeEnabled: Boolean(values.goodbyeEnabled),
      welcomeChannelId: values.welcomeChannelId || null,
      goodbyeChannelId: values.goodbyeChannelId || null,
      welcomeMessage: values.welcomeMessage || '',
      goodbyeMessage: values.goodbyeMessage || '',
      welcomeStyle: values.welcomeStyle || 'Custom Card (Modern)',
      goodbyeStyle: values.goodbyeStyle || 'Text only',
      showMember: Boolean(values.showMember),
      showAvatar: Boolean(values.showAvatar),
    };
  }
  if (section === 'leveling') {
    return {
      enabled: Boolean(values.enabled),
      channelId: values.channelId || null,
      xpPerMessage: Number(values.xpPerMessage || values.xp || 15),
      cooldownSeconds: Number(values.cooldownSeconds || values.cooldown || 60),
      stackRoles: Boolean(values.stackRoles),
    };
  }
  if (section === 'logs') {
    return {
      enabled: Boolean(values.enabled),
      channelId: values.channelId || null,
      messageEvents: Boolean(values.messageEvents),
      memberEvents: Boolean(values.memberEvents),
      moderationEvents: Boolean(values.moderationEvents),
      voiceEvents: Boolean(values.voiceEvents),
    };
  }
  if (section === 'moderation') {
    return {
      enabled: Boolean(values.enabled),
      warningsEnabled: Boolean(values.warningsEnabled),
      automodEnabled: Boolean(values.automodEnabled),
      antiSpam: Boolean(values.antiSpam),
      linkFilter: Boolean(values.linkFilter),
      inviteFilter: Boolean(values.inviteFilter),
      modLogChannelId: values.modLogChannelId || null,
      blockedWords: values.blockedWords || '',
    };
  }
  return values;
}
function attachSettingsForm(server, section) {
  const form = document.querySelector(`[data-settings-form="${section}"]`);
  if (!form) return;
  const refreshFormPreview = () => {
    form.querySelectorAll('textarea[maxlength]').forEach((textarea) => {
      const counter = form.querySelector(`[data-count-for="${textarea.name}"]`);
      if (counter) counter.textContent = textarea.value.length;
    });
    const values = getFormValues(form);
    setDraft(server.id, section, payloadForSection(section, values));
    syncSectionStatus(form, section);
    if (section === 'welcome') updateWelcomePreview(server, form);
    if (section === 'leveling') updateLevelingPreview(server, form);
    if (section === 'logs') updateLogsPreview(form);
    syncSectionStatus(form, section);
  };
  syncSectionStatus(form, section);
  form.addEventListener('input', refreshFormPreview);
  form.addEventListener('change', refreshFormPreview);
  form.querySelectorAll('[data-insert-variable]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.insertTarget || 'welcomeMessage';
      const textarea = form.querySelector(`textarea[name="${CSS.escape(target)}"]`);
      if (!textarea) return;
      const v = btn.dataset.insertVariable || '';
      const start = textarea.selectionStart || textarea.value.length;
      const end = textarea.selectionEnd || textarea.value.length;
      textarea.value = `${textarea.value.slice(0,start)}${v}${textarea.value.slice(end)}`;
      textarea.focus(); textarea.selectionStart = textarea.selectionEnd = start + v.length;
      textarea.dispatchEvent(new Event('input', { bubbles:true }));
    });
  });
  form.querySelector('[data-add-level-reward]')?.addEventListener('click', async () => {
    if (isDemoMode()) { readOnlyDemoToast(); return; }
    const level = form.querySelector('input[name="rewardLevel"]')?.value;
    const roleId = form.querySelector('select[name="rewardRoleId"]')?.value;
    if (!level || !roleId) return showStatusToast('error', 'Missing reward data', 'Choose a level and an editable role.');
    try {
      await saveLevelReward(server.id, level, roleId);
      showStatusToast('success', 'Reward role saved', 'The level reward was updated.');
      renderServerPage(server.id, 'leveling');
    } catch (err) {
      showStatusToast('error', 'Reward save failed', err.message || 'Could not save reward role.');
    }
  });
  form.querySelectorAll('[data-remove-level-reward]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (isDemoMode()) { readOnlyDemoToast(); return; }
      try {
        await deleteLevelReward(server.id, btn.dataset.removeLevelReward);
        showStatusToast('success', 'Reward role removed', 'The level reward was removed.');
        renderServerPage(server.id, 'leveling');
      } catch (err) {
        showStatusToast('error', 'Remove failed', err.message || 'Could not remove reward role.');
      }
    });
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveDirtyTabs(server.id);
  });
  refreshFormPreview();
}


async function saveDirtyTabs(guildId) {
  const state = serverDraftState(guildId);
  const dirty = Array.from(state.dirty);
  if (!dirty.length) return;
  if (isDemoMode()) { readOnlyDemoToast(); return; }
  const bar = document.querySelector('[data-global-save-bar]');
  const save = bar?.querySelector('[data-save-drafts]');
  if (save) { save.disabled = true; save.textContent = 'Saving...'; }
  const failed = [];
  for (const section of dirty) {
    const draft = state.drafts.get(section) || {};
    try {
      await saveServerSettings(guildId, section, payloadForSection(section, draft));
      writeSettings(guildId, section, draft);
      clearDraft(guildId, section, payloadForSection(section, draft));
      const cached = tabDataCache.get(`${guildId}:${section}`) || { settings: {} };
      cached.settings ||= {};
      cached.settings[section] = { ...(cached.settings[section] || {}), ...payloadForSection(section, draft) };
      tabDataCache.set(`${guildId}:${section}`, cached);
    } catch (err) {
      state.errors.set(section, err);
      failed.push(sectionTitle(section));
    }
  }
  if (failed.length) showStatusToast('error', 'Some settings failed to save', failed.join(', '));
  else showStatusToast('success', 'Server settings saved', 'All pending changes were saved.');
  if (save) { save.disabled = false; save.textContent = 'Save Changes'; }
  renderGlobalSaveBar(guildId);
}
function attachGlobalSaveBar(server) {
  const host = document.querySelector('[data-server-save-host]');
  host?.addEventListener('click', async (event) => {
    const save = event.target.closest('[data-save-drafts]');
    const discard = event.target.closest('[data-discard-drafts]');
    if (save) await saveDirtyTabs(server.id);
    if (discard) { discardDrafts(server.id); renderServerPage(server.id, hashSection('overview')); }
  });
}
function settingsPage(data = {}) {
  const prefs = readDashboardPrefs();
  const isOwner = Boolean(data.isOwner);
  const authenticated = Boolean(data.authenticated || activeUser());
  const demo = isDemoMode();
  const languageOptions = [
    ['en', 'English'], ['pt', 'Português'], ['es', 'Español'], ['de', 'Deutsch'], ['fr', 'Français'],
  ].map(([value, label]) => `<option value="${value}" ${prefs.language === value ? 'selected' : ''}>${label}</option>`).join('');

  const viewModeCard = authenticated ? `<article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Dashboard Preferences</span><h2>View mode</h2><p>Choose how the dashboard lists servers.</p></div></div>${isOwner ? `<div class="dash-setting-block"><strong>Owner/User view</strong><p>Owner View shows every server Meowz is installed in. User View shows the same list a normal manager sees.</p>${ownerToggle()}</div>` : `<div class="dash-note"><strong>User View</strong><span>Owner View is only available to the bot owner.</span></div>`}</article>` : '';

  return `<section class="dash-page-title"><span>Account</span><h1>Settings</h1><p>Control dashboard preferences. Theme and language preferences are saved locally on this browser, even when you are not logged in.</p></section>${demo ? '<div class="dash-note demo-note"><strong>Demo Mode</strong><span>This page is a read-only preview. Visual preferences can be changed locally, but server/account changes are disabled.</span></div>' : ''}<form class="dash-settings-page" data-dashboard-settings>${viewModeCard}<article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Appearance</span><h2>Theme</h2><p>Choose the dashboard theme for this browser.</p></div></div><div class="dash-segmented" data-theme-toggle><button type="button" data-theme-choice="dark" class="${prefs.theme === 'dark' ? 'is-active' : ''}">Dark</button><button type="button" data-theme-choice="light" class="${prefs.theme === 'light' ? 'is-active' : ''}">Light</button></div></article><article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Language</span><h2>Language</h2><p>The selector is ready for future translations. English remains the active dashboard copy for now.</p></div></div><label class="dash-field"><span>Dashboard language</span><select name="language">${languageOptions}</select></label></article><article class="dash-card"><span>Coming soon</span><h2>Future settings</h2><div class="dash-feature-grid compact"><div class="dash-feature-card"><strong>Notifications</strong><span>Control dashboard alerts and reminders.</span></div><div class="dash-feature-card"><strong>Privacy</strong><span>Manage account visibility and saved preferences.</span></div><div class="dash-feature-card"><strong>Experiments</strong><span>Try new dashboard features early.</span></div></div></article></form>`;
}

function attachDashboardSettings() {
  const form = document.querySelector('[data-dashboard-settings]');
  if (!form) return;
  form.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = VALID_THEMES.has(btn.dataset.themeChoice) ? btn.dataset.themeChoice : 'dark';
      writeDashboardPrefs({ theme });
      form.querySelectorAll('[data-theme-choice]').forEach((item) => item.classList.toggle('is-active', item === btn));
      showStatusToast('success', 'Theme updated', `${theme === 'dark' ? 'Dark' : 'Light'} mode selected.`);
    });
  });
  form.querySelector('select[name="language"]')?.addEventListener('change', (event) => {
    const language = VALID_LANGUAGES.has(event.target.value) ? event.target.value : 'en';
    writeDashboardPrefs({ language });
    showStatusToast('success', 'Language saved', 'Translations can be connected later.');
  });
}
async function renderSettingsPage() {
  if (!els.home) return;
  els.home.hidden = false;
  if (els.detail) els.detail.hidden = true;
  document.title = isDemoMode() ? 'Demo Settings — Meowz' : 'Settings — Meowz';
  const authenticated = isAuthenticated();
  els.home.innerHTML = shell({ active: 'Settings', section: 'settings', content: loadingCard('Loading settings...') });

  if (isDemoMode()) {
    const data = await getDashboardGuilds(viewMode);
    els.home.innerHTML = shell({ active: 'Settings', section: 'settings', showOwnerToggle: false, isOwner: Boolean(data.isOwner), content: settingsPage({ ...data, authenticated: true }) });
    wireShell(els.home);
    attachDashboardSettings();
    return;
  }

  if (!authenticated) {
    els.home.innerHTML = shell({ active: 'Settings', section: 'settings', content: settingsPage({ authenticated: false, isOwner: false }) });
    wireShell(els.home);
    attachDashboardSettings();
    return;
  }

  try {
    const data = await getDashboardGuilds(viewMode);
    els.home.innerHTML = shell({ active: 'Settings', section: 'settings', showOwnerToggle: false, isOwner: Boolean(data.isOwner), content: settingsPage({ ...data, authenticated: true }) });
    wireShell(els.home);
    attachDashboardSettings();
  } catch (err) {
    els.home.innerHTML = shell({ active: 'Settings', section: 'settings', content: settingsPage({ authenticated: true, isOwner: false }) });
    wireShell(els.home);
    attachDashboardSettings();
    showStatusToast('error', 'Settings loaded with limited access', err.message || 'Could not verify owner mode.');
  }
}
async function hydrateServerForSection(server, section) {
  const cacheKey = `${server.id}:${section}`;
  if (tabDataCache.has(cacheKey)) return { ...server, ...tabDataCache.get(cacheKey), settings: { ...(server.settings || {}), ...(tabDataCache.get(cacheKey).settings || {}) } };
  const copy = { ...server, settings: { ...(server.settings || {}) } };
  if (['welcome', 'leveling', 'logs', 'moderation'].includes(section)) {
    try {
      const data = await getServerSettings(server.id, section);
      copy.settings[section] = data.settings || {};
    } catch (err) {
      showStatusToast('error', `${sectionTitle(section)} settings unavailable`, err.message || 'Using local preview values.');
    }
  }
  if (section === 'leveling') {
    try {
      const [roles, rewards] = await Promise.all([getGuildRoles(server.id), getLevelRewards(server.id)]);
      copy.roles = Array.isArray(roles.roles) ? roles.roles : [];
      copy.settings.levelRewards = Array.isArray(rewards.rewards) ? rewards.rewards : [];
    } catch (err) {
      showStatusToast('error', 'Role data unavailable', err.message || 'Reward role editing may be limited.');
    }
  }
  tabDataCache.set(cacheKey, { roles: copy.roles, settings: copy.settings });
  return copy;
}
function serverSectionBody(server, section) {
  const active = normalizeSection(section);
  if (active === 'welcome') return welcomePage(server);
  if (active === 'leveling') return levelingPage(server);
  if (active === 'ai-image-access') return aiPage(server);
  if (active === 'logs') return logsPage(server);
  if (active === 'moderation') return moderationPage(server);
  return overviewPage(server);
}
function serverContent(server, section, { includeHeader = true } = {}) {
  const active = normalizeSection(section);
  const saveHost = `<div data-server-save-host>${globalSaveBarHtml(server.id)}</div>`;
  return `${includeHeader ? serverHeader(server, active) : ''}<div class="dash-tab-content" data-server-tab-content data-active-section="${escapeHtml(active)}">${serverSectionBody(server, active)}</div>${saveHost}`;
}
function updatePersistentServerChrome(server, section) {
  const active = normalizeSection(section);
  document.querySelectorAll('.dash-tabs a, .dash-side-nav a').forEach((link) => {
    if (!link.href || !link.href.includes('/server/')) return;
    const url = new URL(link.href, window.location.origin);
    const linkSection = normalizeSection((url.hash || '#overview').slice(1));
    link.classList.toggle('is-active', linkSection === active);
  });
  document.querySelectorAll('[data-dashboard-active-crumb]').forEach((crumb) => {
    crumb.textContent = sectionTitle(active);
    crumb.hidden = active === 'overview';
  });
  document.querySelectorAll('[data-dashboard-active-separator]').forEach((separator) => {
    separator.hidden = active === 'overview';
  });
}
function attachSimulationControls(server) {
  const host = document.querySelector('[data-server-tab-content]');
  if (!host || host.dataset.simulationsAttached === 'true') return;
  host.dataset.simulationsAttached = 'true';
  host.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-simulation-event]');
    if (!button || !host.contains(button)) return;
    if (isDemoMode()) { readOnlyDemoToast(); return; }
    const panel = button.closest('[data-simulation-panel]');
    const result = panel?.querySelector('[data-simulation-result]');
    const simulationEvent = button.dataset.simulationEvent;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Running...';
    panel?.querySelectorAll('[data-simulation-event]').forEach((item) => { if (item !== button) item.disabled = true; });
    try {
      const state = serverDraftState(server.id);
      if (state.dirty.size) showStatusToast('info', 'Using saved settings', 'Save pending changes first when you want the Discord simulation to use them.');
      const data = await simulateDashboardEvent(server.id, simulationEvent);
      if (result) {
        result.hidden = false;
        result.className = 'dash-simulation-result is-success';
        result.textContent = data.message || 'Simulation completed.';
      }
      showStatusToast('success', 'Simulation completed', data.message || 'The bot completed the test.');
    } catch (err) {
      if (result) {
        result.hidden = false;
        result.className = 'dash-simulation-result is-error';
        result.textContent = err.message || 'Simulation failed.';
      }
      showStatusToast('error', 'Simulation failed', err.message || 'Could not run the test event.');
    } finally {
      button.textContent = original;
      panel?.querySelectorAll('[data-simulation-event]').forEach((item) => { item.disabled = false; });
    }
  });
}

function attachActiveSection(server, active) {
  attachSettingsForm(server, active);
  attachGlobalSaveBar(server);
  attachSimulationControls(server);
  if (active === 'ai-image-access') attachAiPage(server);
  if (active === 'moderation') attachModerationAccess(server);
  const form = document.querySelector(`[data-settings-form="${CSS.escape(active)}"]`);
  if (form) syncSectionStatus(form, active);
}

async function renderServerPage(id, section = 'overview') {
  if (!els.detailContent || !els.detail) return;
  if (els.home) els.home.hidden = true;
  els.detail.hidden = false;
  const active = normalizeSection(section);
  const renderNonce = ++serverRenderNonce;
  let finishedFullLoad = false;
  const hasPersistentShell = activeServerShellId === id && Boolean(els.detailContent.querySelector('[data-server-tab-content]'));

  function renderSnapshot(snapshot) {
    if (!snapshot || renderNonce !== serverRenderNonce || finishedFullLoad || hasPersistentShell) return;
    activeServerShellId = snapshot.id;
    document.title = `${snapshot.name} — ${sectionTitle(active)} — Meowz`;
    els.detailContent.innerHTML = shell({
      server: snapshot,
      active: sectionTitle(active),
      section: active,
      content: `${serverHeader(snapshot, active)}<div class="dash-tab-content" data-server-tab-content data-active-section="${escapeHtml(active)}">${loadingCard(`Loading ${sectionTitle(active).toLowerCase()} settings...`)}</div><div data-server-save-host>${globalSaveBarHtml(snapshot.id)}</div>`,
    });
    wireShell(els.detailContent);
    syncDashTabs(els.detailContent);
  }

  if (hasPersistentShell) {
    updatePersistentServerChrome({ id }, active);
    const tabHost = els.detailContent.querySelector('[data-server-tab-content]');
    if (tabHost) {
      tabHost.dataset.activeSection = active;
      tabHost.innerHTML = loadingCard(`Loading ${sectionTitle(active).toLowerCase()} settings...`);
    }
  } else {
    const initialSnapshot = readServerSnapshot(id);
    if (initialSnapshot) renderSnapshot(initialSnapshot);
    else {
      activeServerShellId = null;
      els.detailContent.innerHTML = shell({ active: sectionTitle(active), section: active, content: loadingCard('Loading server...') });
      fetchServerSnapshot(id).then(renderSnapshot);
    }
  }

  try {
    let payload = serverPageCache.get(id);
    if (!payload) {
      payload = await getDashboardServer(id);
      serverPageCache.set(id, payload);
      if (payload?.server) storeServerSnapshots({ installed: [payload.server] });
    }
    const server = await hydrateServerForSection(payload.server, active);
    finishedFullLoad = true;
    if (renderNonce !== serverRenderNonce) return;
    document.title = `${server.name} — ${sectionTitle(active)} — Meowz`;

    const tabHost = els.detailContent.querySelector('[data-server-tab-content]');
    const sameShell = activeServerShellId === server.id && tabHost;
    if (sameShell) {
      updatePersistentServerChrome(server, active);
      tabHost.dataset.activeSection = active;
      tabHost.innerHTML = serverSectionBody(server, active);
      renderGlobalSaveBar(server.id);
      syncDashTabs(els.detailContent);
      attachActiveSection(server, active);
      return;
    }

    activeServerShellId = server.id;
    els.detailContent.innerHTML = shell({ server, active: sectionTitle(active), section: active, content: serverContent(server, active) });
    wireShell(els.detailContent);
    syncDashTabs(els.detailContent);
    attachActiveSection(server, active);
  } catch (err) {
    finishedFullLoad = true;
    activeServerShellId = null;
    if (renderNonce !== serverRenderNonce) return;
    showStatusToast('error', 'Server failed to load', err.message || 'Could not open server.');
    els.detailContent.innerHTML = shell({ active: 'Server unavailable', content: errorCard('Could not open this server.', err.message || 'Try again later.') });
    wireShell(els.detailContent);
  }
}
function handleHashTabNavigation(event) {
  const link = event.target.closest('a[href*="/server/"][href*="#"]');
  if (!link) return;
  const url = new URL(link.href, window.location.origin);
  if (url.pathname !== window.location.pathname) return;
  const next = normalizeSection(String(url.hash || '#overview').slice(1) || 'overview');
  event.preventDefault();
  if (window.location.hash !== `#${next}`) history.pushState(null, '', `#${next}`);
  const info = routeInfo();
  if (info?.id) renderServerPage(info.id, next);
}

export function initDashboard() {
  if (!els.home && !els.detail) return;
  document.removeEventListener('click', handleHashTabNavigation);
  document.addEventListener('click', handleHashTabNavigation);
  window.onpopstate = () => { const info = routeInfo(); if (info?.id) renderServerPage(info.id, info.section); else initDashboard(); };
  window.onhashchange = () => { const info = routeInfo(); if (info?.id) renderServerPage(info.id, info.section); };
  const route = routeInfo();
  if (route?.settings) {
    renderSettingsPage();
    return;
  }
  if (!canAccessProtected()) {
    if (els.home) els.home.hidden = true;
    if (els.detail) els.detail.hidden = true;
    return;
  }
  if (route?.id) renderServerPage(route.id, route.section);
  else renderDashboardHome();
}
