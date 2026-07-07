import {
  getDashboardGuilds,
  getDashboardServer,
  getImageAccess,
  addImageAccessUser,
  removeImageAccessUser,
} from './api.js';
import { escapeHtml, formatNumber } from './utils.js';
import { showStatusToast } from './toast.js';
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
const VALID_SECTIONS = new Set(['overview', 'welcome', 'leveling', 'ai', 'logs', 'moderation']);
let viewMode = localStorage.getItem(OWNER_VIEW_STORAGE_KEY) === 'owner' ? 'owner' : 'user';

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

function routeInfo() {
  if (isDemoMode()) {
    const path = window.location.pathname;
    if (/^\/demo\/settings\/?$/.test(path)) return { settings: true };
    if (/^\/demo(?:\/dashboard)?\/?$/.test(path)) return { home: true };
    const demoServerMatch = path.match(/^\/demo\/server\/([^/]+)(?:\/([^/]+))?\/?$/);
    if (demoServerMatch) return { id: decodeURIComponent(demoServerMatch[1]), section: decodeURIComponent(demoServerMatch[2] || 'overview') };
    return { home: true };
  }
  const base = 'dashboard';
  const settingsRe = new RegExp(`^/${base}/settings/?$`);
  if (settingsRe.test(window.location.pathname)) return { settings: true };
  const serverRe = new RegExp(`^/${base}/server/([^/]+)(?:/([^/]+))?/?$`);
  const match = window.location.pathname.match(serverRe);
  return match ? { id: decodeURIComponent(match[1]), section: decodeURIComponent(match[2] || 'overview') } : null;
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
function serverIcon(server, className = 'dash-server-icon') {
  if (server?.iconUrl) return `<span class="${className}"><img src="${escapeHtml(server.iconUrl)}" alt="" loading="lazy" /></span>`;
  return `<span class="${className} ${className}-fallback">${initial(server?.name || 'M')}</span>`;
}
function sectionTitle(section) {
  return ({ overview: 'Overview', welcome: 'Welcome Messages', leveling: 'Leveling System', ai: 'AI Image Access', logs: 'Logs', moderation: 'Moderation', settings: 'Settings' })[section] || 'Overview';
}
function sectionPath(server, section = 'overview') {
  const base = `${dashboardBase()}/server/${encodeURIComponent(server.id)}`;
  return section === 'overview' ? base : `${base}/${encodeURIComponent(section)}`;
}
function readSettings(guildId, section, defaults = {}) {
  try {
    const all = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    return { ...defaults, ...(all[guildId]?.[section] || {}) };
  } catch { return { ...defaults }; }
}
function writeSettings(guildId, section, values) {
  const all = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
  all[guildId] ||= {};
  all[guildId][section] = { ...(all[guildId][section] || {}), ...values };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(all));
}

function shell({ server = null, active = 'Dashboard', section = 'dashboard', content = '', showOwnerToggle = false, isOwner = false }) {
  return `
    <div class="dash-shell">${demoBadge()}
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
        <div class="dash-content">${content}</div>
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
      ['overview', 'Overview'], ['welcome', 'Welcome Messages'], ['leveling', 'Leveling System'], ['ai', 'AI Image Access'], ['logs', 'Logs'], ['moderation', 'Moderation'],
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
      <div class="dash-breadcrumb"><a href="${dashboardBase()}">Servers</a>${server ? `<span>›</span><a href="${escapeHtml(sectionPath(server))}">${escapeHtml(server.name)}</a>${active !== 'Overview' ? `<span>›</span><strong>${escapeHtml(active)}</strong>` : ''}` : ''}</div>
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
    ['Welcome Messages', sectionPath(server, 'welcome')],
    ['Leveling', sectionPath(server, 'leveling')],
    ['AI Image Access', sectionPath(server, 'ai')],
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
  return `<div class="dash-mobile-breadcrumb"><a href="${dashboardBase()}">Dashboard</a>${server ? `<span>›</span><a href="${escapeHtml(sectionPath(server))}">${escapeHtml(server.name)}</a>${active !== 'Overview' ? `<span>›</span><strong>${escapeHtml(active)}</strong>` : ''}` : ''}</div>`;
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
function emptyState(title, text) { return `<div class="dash-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`; }

async function renderDashboardHome() {
  if (!els.home) return;
  els.home.hidden = false;
  if (els.detail) els.detail.hidden = true;
  document.title = 'Dashboard — Meowz';
  els.home.innerHTML = shell({ content: loadingCard('Loading dashboard...') });
  try {
    const data = await getDashboardGuilds(viewMode);
    els.home.innerHTML = shell({ active: 'Dashboard', section: 'dashboard', showOwnerToggle: true, isOwner: Boolean(data.isOwner), content: dashboardHomeContent(data) });
    wireShell(els.home);
  } catch (err) {
    showStatusToast('error', 'Dashboard failed to load', err.message || 'Could not load servers.');
    els.home.innerHTML = shell({ active: 'Dashboard', content: errorCard('Could not load dashboard.', err.message || 'Try again later.') });
    wireShell(els.home);
  }
}

function loadingCard(text) { return `<div class="dash-card dash-loading">${escapeHtml(text)}</div>`; }
function errorCard(title, text) { return `<div class="dash-empty dash-error"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`; }
function pillRow(server) {
  const members = typeof server.memberCount === 'number' ? `${formatNumber(server.memberCount)} members` : 'Members unavailable';
  return `<div class="dash-pills"><span>${escapeHtml(members)}</span><span>${escapeHtml(server.accessLabel || 'Manage Server')}</span><span>Bot Installed</span></div>`;
}
function serverHeader(server, active) {
  const tabs = [['overview','Overview'],['welcome','Welcome Messages'],['leveling','Leveling'],['ai','AI Image Access'],['logs','Logs'],['moderation','Moderation']];
  return `<section class="dash-server-title">${serverIcon(server, 'dash-title-icon')}<div><span>Server Dashboard</span><h1>${escapeHtml(server.name)}</h1><p>Manage Meowz features for this server.</p>${pillRow(server)}</div></section><nav class="dash-tabs">${tabs.map(([key,label]) => `<a class="${key===active?'is-active':''}" href="${escapeHtml(sectionPath(server,key))}">${escapeHtml(label)}</a>`).join('')}</nav>`;
}
function infoRow(label, value) { return `<div class="dash-info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`; }

function overviewPage(server) {
  return `${serverHeader(server,'overview')}<section class="dash-grid two"><article class="dash-card"><span>Information</span><h2>Server information</h2><div class="dash-info-list">${infoRow('Name',server.name)}${infoRow('Server ID',server.id)}${infoRow('Members',typeof server.memberCount === 'number' ? formatNumber(server.memberCount) : 'Unavailable')}${infoRow('Status','Meowz installed')}</div></article><article class="dash-card"><span>Permissions</span><h2>Dashboard access</h2><div class="dash-info-list">${infoRow('Your access',server.accessLabel || 'Manage Server')}${infoRow('Dashboard access','Allowed')}${infoRow('View mode',server.ownerView ? 'Owner View' : 'User View')}</div></article></section><section class="dash-card"><span>Server tools</span><h2>Configure Meowz</h2><div class="dash-feature-grid">${[['welcome','Welcome Messages','Member join and leave messages.'],['leveling','Leveling System','XP, cooldowns and level rewards.'],['ai','AI Image Access','Control who can use image editing.'],['logs','Logs','Server activity and audit events.'],['moderation','Moderation','Warnings and automod settings.']].map(([key,title,desc]) => `<a href="${escapeHtml(sectionPath(server,key))}" class="dash-feature-card"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc)}</span></a>`).join('')}</div></section>`;
}

function switchField(name, checked, label, desc) { return `<label class="dash-switch"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''}/><i></i><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(desc)}</small></span></label>`; }
function textField(name, label, value, placeholder='') { return `<label class="dash-field"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}" /></label>`; }
function normalizeChannelValue(value) {
  return String(value ?? '').trim().replace(/^#\s*/, '').toLowerCase();
}
function textChannels(server) {
  const channels = Array.isArray(server?.channels) ? server.channels : [];
  return channels
    .filter((channel) => {
      const type = String(channel.type ?? channel.channelType ?? '').toUpperCase();
      return !type || type === '0' || type === 'GUILD_TEXT' || type === 'TEXT' || type === 'ANNOUNCEMENT' || type === 'GUILD_ANNOUNCEMENT';
    })
    .map((channel) => ({
      id: String(channel.id ?? channel.value ?? channel.name ?? ''),
      name: String(channel.name ?? channel.label ?? channel.id ?? 'channel').replace(/^#\s*/, ''),
    }))
    .filter((channel) => channel.id && channel.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}
function channelSelectField(server, name, label, value, fallbackName = 'general') {
  const channels = textChannels(server);
  const current = normalizeChannelValue(value || fallbackName);
  if (!channels.length) {
    return `<label class="dash-field"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}" disabled><option>Channel list unavailable</option></select><small>Channel dropdowns need the bot channel API for this server.</small></label>`;
  }
  const hasCurrent = channels.some((channel) => channel.id === String(value) || normalizeChannelValue(channel.name) === current);
  const options = channels.map((channel) => {
    const selected = channel.id === String(value) || normalizeChannelValue(channel.name) === current;
    return `<option value="${escapeHtml(channel.id)}" ${selected ? 'selected' : ''}>#${escapeHtml(channel.name)}</option>`;
  }).join('');
  const custom = hasCurrent || !value ? '' : `<option value="${escapeHtml(String(value))}" selected>${escapeHtml(String(value))}</option>`;
  return `<label class="dash-field"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}">${custom}${options}</select></label>`;
}
function numberField(name, label, value, min=0) { return `<label class="dash-field"><span>${escapeHtml(label)}</span><input type="number" min="${Number(min)}" name="${escapeHtml(name)}" value="${escapeHtml(String(value ?? ''))}" /></label>`; }
function textareaField(name, label, value, max=200) { return `<label class="dash-field"><span>${escapeHtml(label)}</span><textarea name="${escapeHtml(name)}" maxlength="${Number(max)}">${escapeHtml(value ?? '')}</textarea><small><b data-count-for="${escapeHtml(name)}">${String(value ?? '').length}</b>/${Number(max)}</small></label>`; }
function variableButtons() { return `<div class="dash-variable-row"><span>Insert Variable</span><div>${['{user}','{server}','{memberCount}'].map(v => `<button type="button" data-insert-variable="${v}">${v}</button>`).join('')}</div></div>`; }
function saveBtn() { return `<button class="dash-save-btn" type="submit">Save Changes</button>`; }

function welcomePage(server) {
  const s = readSettings(server.id, 'welcome', { enabled:true, channel:'demo-ch-welcome', style:'Custom Card (Modern)', welcomeMessage:'WELCOME {user}\nTO\n{server}', leaveMessage:'Goodbye {user}. We hope to see you again soon.', showMember:true, showAvatar:true });
  return `${serverHeader(server,'welcome')}<form class="dash-designer" data-settings-form="welcome" data-guild-id="${escapeHtml(server.id)}"><article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Welcome Messages</span><h2>Welcome Messages</h2><p>Customize how Meowz welcomes new members to ${escapeHtml(server.name)}.</p></div><b class="status ${s.enabled?'enabled':''}">${s.enabled?'Enabled':'Disabled'}</b></div>${switchField('enabled',s.enabled,'Enable welcome messages','Send a message when someone joins the server.')}<hr/>${channelSelectField(server,'channel','Welcome Channel',s.channel,'welcome')}<label class="dash-field"><span>Message Style</span><select name="style"><option ${s.style === 'Custom Card (Modern)' ? 'selected' : ''}>Custom Card (Modern)</option><option ${s.style === 'Text only' ? 'selected' : ''}>Text only</option></select></label>${variableButtons()}${textareaField('welcomeMessage','Welcome Message',s.welcomeMessage,200)}${textField('leaveMessage','Leave Message (Optional)',s.leaveMessage,'Goodbye {user}')}<div class="dash-option-list">${switchField('showMember',s.showMember,'Show member number on the card','Display the member position in the server.')}${switchField('showAvatar',s.showAvatar,'Show avatar on the card','Display the member avatar on the welcome card.')}</div>${saveBtn()}</article>${welcomePreview(server,s)}</form>`;
}
function renderTemplate(template, server) {
  return String(template || '').replaceAll('{user}', 'Rafa').replaceAll('{server}', server.name).replaceAll('{memberCount}', '11');
}
function welcomeCard(server, settings) {
  const text = renderTemplate(settings.welcomeMessage, server).split('\n').map(x => x.trim()).filter(Boolean);
  const first = text[0] || 'WELCOME RAFA';
  const second = text[1] || 'TO';
  const third = text[2] || server.name;
  return `<div class="dash-discord-card"><div class="bg"></div>${settings.showMember ? `<div class="member">MEMBER #11</div>` : ''}${settings.showAvatar ? `<div class="big-avatar">R</div>` : ''}<div class="card-text"><strong>${escapeHtml(first.toUpperCase())}</strong><span>${escapeHtml(second.toUpperCase())}</span><b>${escapeHtml(third.toUpperCase())}</b></div></div>`;
}
function welcomePreview(server, settings) {
  return `<article class="dash-card dash-preview" data-welcome-preview><span>Live Preview</span><h2>Discord preview</h2><p>This is how the welcome message will look in Discord.</p><div class="dash-discord-message"><div class="bot-avatar">M</div><div><div class="msg-head"><strong>Meowz</strong><em>APP</em><small>Today at 9:30 PM</small></div><p>Welcome <mark>@Rafa</mark> to <strong>${escapeHtml(server.name)}</strong>!</p>${welcomeCard(server, settings)}</div></div><small class="preview-note">This is a preview. The actual Discord message can look slightly different depending on device size.</small></article>`;
}
function updateWelcomePreview(server, form) {
  const preview = document.querySelector('[data-welcome-preview]');
  if (!preview) return;
  const settings = getFormValues(form);
  preview.outerHTML = welcomePreview(server, settings);
}

function levelingPage(server) {
  const s = readSettings(server.id, 'leveling', { enabled:true, xp:15, cooldown:60, channel:'demo-ch-level-up', stackRoles:true });
  const roles = [
    { level: 5, role: 'Lv5' },
    { level: 10, role: 'Lv10' },
    { level: 20, role: 'Lv20' },
  ];
  return `${serverHeader(server,'leveling')}<form class="dash-designer" data-settings-form="leveling" data-guild-id="${escapeHtml(server.id)}"><article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Leveling System</span><h2>Leveling</h2><p>Configure XP, cooldowns and level-up messages.</p></div><b class="status ${s.enabled?'enabled':''}">${s.enabled?'Enabled':'Disabled'}</b></div>${switchField('enabled',s.enabled,'Enable leveling','Members earn XP when they chat.')}<hr/>${numberField('xp','XP per message',s.xp,1)}${numberField('cooldown','Cooldown seconds',s.cooldown,5)}${channelSelectField(server,'channel','Level-up channel',s.channel,'level-up')}${switchField('stackRoles',s.stackRoles,'Keep previous level roles','Do not remove older rewards when members level up.')}${saveBtn()}</article><article class="dash-card"><span>Preview</span><h2>Level rewards</h2><div class="dash-level-preview"><strong>${isDemoMode() ? `Demo rank #${DEMO_LEVELING.rank} · Level ${DEMO_LEVELING.level}` : 'Rafa reached Level 12'}</strong><span>${isDemoMode() ? `${formatNumber(DEMO_LEVELING.xp)} / ${formatNumber(DEMO_LEVELING.nextLevelXp)} XP` : '1,240 / 1,500 XP'}</span><div><i style="width:${isDemoMode() ? Math.min(100, Math.round((DEMO_LEVELING.xp / DEMO_LEVELING.nextLevelXp) * 100)) : 82}%"></i></div></div><div class="dash-role-table"><div class="dash-role-table-head"><strong>Reward roles</strong><button type="button" disabled>Add Role</button></div>${roles.map((r) => `<div class="dash-role-row"><span>Level ${r.level}</span><strong>${escapeHtml(r.role)}</strong></div>`).join('')}</div><small class="preview-note">Role editing can be connected to the API later. The layout is ready.</small></article></form>`;
}
function logsPage(server) {
  const s = readSettings(server.id, 'logs', { enabled:true, channel:'demo-ch-logs', messages:false, members:true, moderation:true, voice:false });
  return `${serverHeader(server,'logs')}<form class="dash-designer" data-settings-form="logs" data-guild-id="${escapeHtml(server.id)}"><article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Logs</span><h2>Logs</h2><p>Configure log channels and event tracking for ${escapeHtml(server.name)}.</p></div><b class="status ${s.enabled?'enabled':''}">${s.enabled?'Enabled':'Disabled'}</b></div>${switchField('enabled',s.enabled,'Enable logs','Send selected events to a log channel.')}<hr/>${channelSelectField(server,'channel','Log channel',s.channel,'logs')}${switchField('messages',s.messages,'Message logs','Track message delete and edit events.')}${switchField('members',s.members,'Member logs','Track joins and leaves.')}${switchField('moderation',s.moderation,'Moderation logs','Track warnings, bans and mutes.')}${switchField('voice',s.voice,'Voice logs','Track voice channel joins and leaves.')}${saveBtn()}</article><article class="dash-card"><span>Live examples</span><h2>Tracked activity</h2><div class="dash-log-status-grid">${logStatus('Message Logs', s.messages)}${logStatus('Member Logs', s.members)}${logStatus('Voice Logs', s.voice)}${logStatus('Moderation Logs', s.moderation)}</div>${logExample('Member joined','Rafa joined the server.','success')}${logExample('Message deleted','A message was removed in #general.','warn')}${logExample('Moderation action','Zen warned a member.','mod')}</article></form>`;
}
function logStatus(label, enabled) { return `<div class="dash-log-status ${enabled ? 'on' : 'off'}"><span>${escapeHtml(label)}</span><strong>${enabled ? 'Enabled' : 'Disabled'}</strong></div>`; }
function logExample(title, text, type) { return `<div class="dash-log-example ${type}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`; }
function moderationPage(server) {
  const s = readSettings(server.id, 'moderation', { enabled:false, warnings:true, antiSpam:false, antiLinks:false, antiInvites:false, channel:'demo-ch-mod-logs' });
  return `${serverHeader(server,'moderation')}<form class="dash-designer" data-settings-form="moderation" data-guild-id="${escapeHtml(server.id)}"><article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Moderation</span><h2>Moderation Tools</h2><p>Configure warnings, filters and moderation controls.</p></div><b class="status ${s.enabled?'enabled':''}">${s.enabled?'Enabled':'Disabled'}</b></div>${switchField('enabled',s.enabled,'Enable moderation tools','Turn on configurable moderation features.')}<hr/>${channelSelectField(server,'channel','Mod log channel',s.channel,'mod-logs')}${switchField('warnings',s.warnings,'Warning system','Allow moderators to warn users.')}${switchField('antiSpam',s.antiSpam,'Anti-spam','Detect repeated messages automatically.')}${switchField('antiLinks',s.antiLinks,'Link filter','Block links from non-trusted users.')}${switchField('antiInvites',s.antiInvites,'Invite filter','Block Discord invite links.')}${saveBtn()}</article><article class="dash-card"><span>Rules</span><h2>Automation</h2><div class="dash-feature-grid compact">${['Warnings','Anti-spam','Link filter','Invite filter','Mod logs'].map(x => `<div class="dash-feature-card"><strong>${x}</strong><span>Configurable preset.</span></div>`).join('')}</div></article></form>`;
}
function aiPage(server) {
  return `${serverHeader(server,'ai')}<section class="dash-designer" data-ai-page><article class="dash-card dash-form-card"><span>AI Image Access</span><h2>Allowed users</h2><p>Control who can use the image editing command in ${escapeHtml(server.name)}.</p><form class="dash-inline-form" data-ai-form><label class="dash-field"><span>Discord user ID</span><input name="userId" placeholder="123456789012345678" /></label><button class="dash-save-btn" type="submit">Add user</button></form><small class="preview-note">Users with Manage Server permission and the bot owner have access by default.</small></article><article class="dash-card"><span>Current Access</span><h2>People allowed</h2><div data-ai-access-list>${emptyState('Loading access list...', 'Please wait.')}</div></article></section>`;
}
function accessUserRow(user, removable = false, type = 'Manual') {
  const name = user.name || user.username || user.displayName || user.id || 'Unknown user';
  const id = user.id || user.userId || '';
  const img = user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt=""/>` : escapeHtml(name.slice(0,1).toUpperCase());
  return `<div class="dash-access-row"><span class="dash-access-avatar">${img}</span><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(type)}${id ? ` · ${escapeHtml(id)}` : ''}</small></span><button type="button" ${removable ? `data-remove-ai-user="${escapeHtml(id)}" data-remove-ai-label="${escapeHtml(name)}"` : 'disabled'}>${removable ? 'Remove' : 'Default'}</button></div>`;
}
async function loadAiAccess(guildId) {
  const holder = document.querySelector('[data-ai-access-list]');
  if (!holder) return;
  holder.innerHTML = emptyState('Loading access list...', 'Please wait.');
  try {
    const data = await getImageAccess(guildId);
    const owner = data.owner ? [data.owner] : (Array.isArray(data.defaultUsers) ? data.defaultUsers.filter(u => u.type === 'owner') : []);
    const managers = Array.isArray(data.manageServerUsers) ? data.manageServerUsers : (Array.isArray(data.defaultUsers) ? data.defaultUsers.filter(u => u.type !== 'owner') : []);
    const manual = Array.isArray(data.allowedUsers) ? data.allowedUsers : (Array.isArray(data.users) ? data.users : []);
    holder.innerHTML = `<div class="dash-access-list"><div class="dash-note"><strong>Default access</strong><span>Bot owner and users with Manage Server can use this command by default.</span></div>${owner.map(u => accessUserRow(u, false, 'Bot Owner')).join('')}${managers.map(u => accessUserRow(u, false, 'Manage Server')).join('')}${manual.length ? `<h3>Manual access</h3>${manual.map(u => accessUserRow(u, true, 'Manual')).join('')}` : emptyState('No manually added users.', 'Add a Discord user ID to grant command access.')}</div>`;
  } catch (err) {
    holder.innerHTML = errorCard('Could not load access list.', err.message || 'Try again later.');
  }
}
function attachAiPage(server) {
  const page = document.querySelector('[data-ai-page]');
  if (!page) return;
  loadAiAccess(server.id);
  page.querySelector('[data-ai-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('input[name="userId"]');
    const userId = String(input.value || '').trim();
    if (!/^\d{15,25}$/.test(userId)) return showStatusToast('error', 'Invalid user ID', 'Paste a valid Discord user ID.');
    const btn = e.currentTarget.querySelector('button');
    btn.disabled = true; btn.textContent = 'Adding...';
    try { await addImageAccessUser(server.id, userId); input.value = ''; showStatusToast('success', 'Access updated', 'User was added.'); await loadAiAccess(server.id); }
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
function getFormValues(form) {
  const values = {};
  new FormData(form).forEach((value, key) => { values[key] = value; });
  form.querySelectorAll('input[type="checkbox"]').forEach(input => { values[input.name] = input.checked; });
  return values;
}
function attachSettingsForm(server, section) {
  const form = document.querySelector(`[data-settings-form="${section}"]`);
  if (!form) return;
  form.addEventListener('input', () => {
    form.querySelectorAll('textarea[maxlength]').forEach((textarea) => {
      const counter = form.querySelector(`[data-count-for="${textarea.name}"]`);
      if (counter) counter.textContent = textarea.value.length;
    });
    if (section === 'welcome') updateWelcomePreview(server, form);
  });
  form.querySelectorAll('[data-insert-variable]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const textarea = form.querySelector('textarea[name="welcomeMessage"]');
      if (!textarea) return;
      const v = btn.dataset.insertVariable || '';
      const start = textarea.selectionStart || textarea.value.length;
      const end = textarea.selectionEnd || textarea.value.length;
      textarea.value = `${textarea.value.slice(0,start)}${v}${textarea.value.slice(end)}`;
      textarea.focus(); textarea.selectionStart = textarea.selectionEnd = start + v.length;
      textarea.dispatchEvent(new Event('input', { bubbles:true }));
    });
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isDemoMode()) { readOnlyDemoToast(); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving...';
    try { writeSettings(server.id, section, getFormValues(form)); showStatusToast('success', `${sectionTitle(section)} saved`, 'Your settings were saved.'); }
    catch (err) { showStatusToast('error', 'Save failed', err.message || 'Could not save settings.'); }
    finally { setTimeout(() => { btn.disabled = false; btn.textContent = 'Save Changes'; }, 500); }
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
function serverContent(server, section) {
  const active = VALID_SECTIONS.has(section) ? section : 'overview';
  if (active === 'welcome') return welcomePage(server);
  if (active === 'leveling') return levelingPage(server);
  if (active === 'ai') return aiPage(server);
  if (active === 'logs') return logsPage(server);
  if (active === 'moderation') return moderationPage(server);
  return overviewPage(server);
}
async function renderServerPage(id, section = 'overview') {
  if (!els.detailContent || !els.detail) return;
  if (els.home) els.home.hidden = true;
  els.detail.hidden = false;
  const active = VALID_SECTIONS.has(section) ? section : 'overview';
  els.detailContent.innerHTML = shell({ active: sectionTitle(active), section: active, content: loadingCard('Loading server...') });
  try {
    const payload = await getDashboardServer(id);
    const server = payload.server;
    document.title = `${server.name} — ${sectionTitle(active)} — Meowz`;
    els.detailContent.innerHTML = shell({ server, active: sectionTitle(active), section: active, content: serverContent(server, active) });
    wireShell(els.detailContent);
    attachSettingsForm(server, active);
    if (active === 'ai') attachAiPage(server);
  } catch (err) {
    showStatusToast('error', 'Server failed to load', err.message || 'Could not open server.');
    els.detailContent.innerHTML = shell({ active: 'Server unavailable', content: errorCard('Could not open this server.', err.message || 'Try again later.') });
    wireShell(els.detailContent);
  }
}
export function initDashboard() {
  if (!els.home && !els.detail) return;
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
