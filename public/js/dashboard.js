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

const els = {
  home: document.querySelector('[data-dashboard-home]'),
  detail: document.querySelector('[data-server-detail]'),
  detailContent: document.querySelector('[data-server-detail-content]'),
};

const OWNER_VIEW_STORAGE_KEY = 'meowzDashboardViewMode';
const SETTINGS_STORAGE_KEY = 'meowzServerSettings';
let currentViewMode = localStorage.getItem(OWNER_VIEW_STORAGE_KEY) === 'owner' ? 'owner' : 'user';
let lastDashboardData = null;

function routeInfo() {
  const match = window.location.pathname.match(/^\/dashboard\/server\/([^/]+)(?:\/([^/]+))?\/?$/);
  return match ? { id: decodeURIComponent(match[1]), section: decodeURIComponent(match[2] || 'overview') } : null;
}

function avatarUrl(user, size = 96) {
  if (!user?.id || !user?.avatar) return null;
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

function activeName() {
  const user = getActiveUser?.();
  return user?.globalName || user?.username || 'Rafa';
}

function activeUsername() {
  const user = getActiveUser?.();
  return user?.username ? `@${user.username}` : '@atuaprima_';
}

function activeAvatarHtml(className = 'app-user-avatar') {
  const user = getActiveUser?.();
  const img = avatarUrl(user, 128);
  const name = activeName();
  if (img) return `<span class="${className}"><img src="${escapeHtml(img)}" alt="" /></span>`;
  return `<span class="${className}">${escapeHtml(name.slice(0, 1).toUpperCase() || 'U')}</span>`;
}

function serverInitial(name = 'S') {
  return escapeHtml((String(name).trim().charAt(0) || 'S').toUpperCase());
}

function serverIcon(server, className = 'app-server-icon') {
  if (server?.iconUrl) return `<span class="${className}"><img src="${escapeHtml(server.iconUrl)}" alt="" loading="lazy" /></span>`;
  return `<span class="${className} ${className}-fallback">${serverInitial(server?.name || 'S')}</span>`;
}

function sectionTitle(section) {
  return ({
    overview: 'Overview',
    welcome: 'Welcome Messages',
    leveling: 'Leveling System',
    logs: 'Logs',
    ai: 'AI Image Access',
    moderation: 'Moderation',
  })[section] || 'Overview';
}

function serverUrl(server, section = 'overview') {
  const base = `/dashboard/server/${encodeURIComponent(server.id)}`;
  return section === 'overview' ? base : `${base}/${encodeURIComponent(section)}`;
}

function getSettings(guildId, section, defaults = {}) {
  try {
    const all = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    return { ...defaults, ...(all[guildId]?.[section] || {}) };
  } catch {
    return { ...defaults };
  }
}

function saveSettings(guildId, section, values) {
  const all = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
  all[guildId] = all[guildId] || {};
  all[guildId][section] = { ...(all[guildId][section] || {}), ...values };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(all));
}

function appSidebar(server = null, active = 'dashboard') {
  const items = server ? [
    ['overview', 'Overview'],
    ['ai', 'AI Image Access'],
    ['leveling', 'Leveling System'],
    ['welcome', 'Welcome Messages'],
    ['logs', 'Logs'],
    ['moderation', 'Moderation'],
  ] : [
    ['dashboard', 'Overview'],
    ['servers', 'Servers'],
    ['docs', 'Documentation'],
    ['changelog', 'Changelog'],
  ];

  const itemLink = ([key, label]) => {
    let href = '#';
    if (!server) {
      href = key === 'dashboard' ? '/dashboard' : key === 'servers' ? '/dashboard#servers' : key === 'docs' ? '/docs' : '/changelog';
    } else {
      href = serverUrl(server, key);
    }
    return `<a href="${escapeHtml(href)}" class="${key === active ? 'is-active' : ''}"><span class="nav-dot"></span>${escapeHtml(label)}</a>`;
  };

  return `
    <aside class="app-sidebar">
      <div class="app-sidebar-brand">
        <a href="/dashboard" class="app-logo"><span class="app-logo-mark">M</span><strong>Meowz</strong></a>
        <a class="app-sidebar-add" href="/">+</a>
      </div>

      ${server ? `
        <a class="app-current-server" href="${escapeHtml(serverUrl(server))}">
          ${serverIcon(server, 'app-current-server-icon')}
          <span><strong>${escapeHtml(server.name)}</strong><small>Server Settings</small></span>
          <span class="app-current-chevron">⌄</span>
        </a>
      ` : `
        <a class="app-current-server" href="/dashboard">
          <span class="app-current-server-icon app-current-server-icon-fallback">M</span>
          <span><strong>Meowz</strong><small>Dashboard</small></span>
        </a>
      `}

      <nav class="app-sidebar-nav">
        <span>${server ? 'Settings' : 'Dashboard'}</span>
        ${items.map(itemLink).join('')}
      </nav>

      ${server ? `
        <nav class="app-sidebar-nav app-sidebar-nav-muted">
          <span>Tools</span>
          <a href="${escapeHtml(serverUrl(server, 'leveling'))}"><span class="nav-dot"></span>Roles</a>
          <a href="${escapeHtml(serverUrl(server, 'moderation'))}"><span class="nav-dot"></span>Auto Moderation</a>
        </nav>
      ` : ''}

      <div class="app-help-card">
        <strong>Need help?</strong>
        <small>Open the docs while the support server is being prepared.</small>
        <a href="/docs">View docs</a>
      </div>
    </aside>
  `;
}

function appTopbar(server = null, active = 'Dashboard', showOwnerToggle = false, isOwner = false) {
  return `
    <header class="app-topbar">
      <div class="app-breadcrumb">
        <a href="/dashboard">Servers</a>
        ${server ? `<span>›</span><a href="${escapeHtml(serverUrl(server))}">${escapeHtml(server.name)}</a><span>›</span><strong>${escapeHtml(active)}</strong>` : `<span>›</span><strong>Dashboard</strong>`}
      </div>
      <div class="app-topbar-actions">
        ${showOwnerToggle && isOwner ? `
          <div class="owner-view-switch" role="group" aria-label="View mode">
            <button type="button" data-owner-mode="user" class="${currentViewMode === 'user' ? 'is-active' : ''}">User View</button>
            <button type="button" data-owner-mode="owner" class="${currentViewMode === 'owner' ? 'is-active' : ''}">Owner View</button>
          </div>
        ` : ''}
        ${server ? `<a class="app-action-button" href="/">View Bot</a>` : ''}
        <a class="app-user-button" href="#settings">${activeAvatarHtml()}<span><strong>${escapeHtml(activeName())}</strong><small>${escapeHtml(activeUsername())}</small></span><em>OWNER</em></a>
      </div>
    </header>
  `;
}

function mobileHeader(server = null, active = 'Dashboard') {
  return `
    <header class="app-mobile-header">
      <a class="app-logo" href="/dashboard"><span class="app-logo-mark">M</span><strong>Meowz</strong></a>
      <button class="app-mobile-menu-btn" type="button" data-app-mobile-menu aria-label="Open dashboard menu"><span></span><span></span><span></span></button>
      <div class="app-mobile-panel" data-app-mobile-panel hidden>
        <a href="/dashboard">Dashboard</a>
        ${server ? `
          <a href="${escapeHtml(serverUrl(server))}">Overview</a>
          <a href="${escapeHtml(serverUrl(server, 'welcome'))}">Welcome Messages</a>
          <a href="${escapeHtml(serverUrl(server, 'leveling'))}">Leveling</a>
          <a href="${escapeHtml(serverUrl(server, 'ai'))}">AI Image Access</a>
          <a href="${escapeHtml(serverUrl(server, 'logs'))}">Logs</a>
          <a href="${escapeHtml(serverUrl(server, 'moderation'))}">Moderation</a>
        ` : `
          <a href="/docs">Documentation</a>
          <a href="/changelog">Changelog</a>
        `}
        <a class="logout-link" href="/auth/logout">Logout</a>
      </div>
    </header>
  `;
}

function appShell({ server = null, active = 'Dashboard', activeKey = 'dashboard', content, showOwnerToggle = false, isOwner = false }) {
  return `
    <div class="app-layout">
      ${appSidebar(server, activeKey)}
      <div class="app-main">
        ${appTopbar(server, active, showOwnerToggle, isOwner)}
        ${mobileHeader(server, active)}
        <div class="app-content">${content}</div>
      </div>
    </div>
  `;
}

function wireMobileMenus(root = document) {
  root.querySelectorAll('[data-app-mobile-menu]').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = button.parentElement.querySelector('[data-app-mobile-panel]');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      button.classList.toggle('is-open', !panel.hidden);
    });
  });
}

function renderServerRow(server, type = 'installed') {
  const isInstalled = type === 'installed';
  const href = isInstalled ? (server.manageUrl || `/dashboard/server/${encodeURIComponent(server.id)}`) : server.inviteUrl || '#';
  const members = typeof server.memberCount === 'number' ? `${formatNumber(server.memberCount)} members` : (isInstalled ? 'Meowz installed' : 'Invite ready');
  const access = server.accessLabel ? `<em>${escapeHtml(server.accessLabel)}</em>` : '';
  return `
    <a class="app-server-row" href="${escapeHtml(href)}" ${isInstalled ? '' : 'target="_blank" rel="noopener noreferrer"'}>
      ${serverIcon(server, 'app-list-server-icon')}
      <span><strong>${escapeHtml(server.name)}</strong><small>${escapeHtml(members)}</small>${access}</span>
      <b>${isInstalled ? 'Open' : 'Invite'}</b>
    </a>
  `;
}

function renderDashboardLists(data) {
  const installed = Array.isArray(data.installed) ? data.installed : [];
  const available = Array.isArray(data.available) ? data.available : [];
  const installedHtml = installed.length ? installed.map((s) => renderServerRow(s, 'installed')).join('') : `<div class="app-empty"><strong>No installed servers found.</strong><span>Servers where Meowz is installed and visible to this mode will appear here.</span></div>`;
  const availableHtml = available.length ? available.map((s) => renderServerRow(s, 'available')).join('') : `<div class="app-empty"><strong>No available servers found.</strong><span>Meowz is already installed in all servers available to this view.</span></div>`;

  return `
    <section class="app-page-header">
      <span class="app-eyebrow">Dashboard</span>
      <h1>Welcome back, ${escapeHtml(activeName())}</h1>
      <p>Manage your servers, configure Meowz and access dashboard features.</p>
    </section>

    <section id="servers" class="app-dashboard-grid">
      <article class="app-card">
        <div class="app-card-head">
          <div><span class="app-eyebrow">Servers with Meowz</span><h2>${currentViewMode === 'owner' ? 'All installed servers' : 'Manage installed servers'}</h2><p>Choose a server to open its overview.</p></div>
          <strong class="app-count-pill">${installed.length} server${installed.length === 1 ? '' : 's'}</strong>
        </div>
        <div class="app-list">${installedHtml}</div>
      </article>

      <article class="app-card">
        <div class="app-card-head">
          <div><span class="app-eyebrow">Available servers</span><h2>Invite Meowz</h2><p>Servers where you can add Meowz will appear here.</p></div>
          <strong class="app-count-pill">${available.length} server${available.length === 1 ? '' : 's'}</strong>
        </div>
        <div class="app-list">${availableHtml}</div>
      </article>
    </section>
  `;
}

async function renderDashboardHome() {
  if (!els.home) return;
  els.home.hidden = false;
  if (els.detail) els.detail.hidden = true;
  document.title = 'Dashboard — Meowz';
  els.home.innerHTML = appShell({
    active: 'Dashboard',
    activeKey: 'dashboard',
    content: '<div class="app-loading-card">Loading dashboard...</div>',
  });

  try {
    const data = await getDashboardGuilds(currentViewMode);
    lastDashboardData = data;
    els.home.innerHTML = appShell({
      active: 'Dashboard',
      activeKey: 'dashboard',
      showOwnerToggle: true,
      isOwner: Boolean(data.isOwner),
      content: renderDashboardLists(data),
    });
    wireOwnerToggle();
    wireMobileMenus(els.home);
  } catch (error) {
    showStatusToast('error', 'Dashboard failed to load', error.message || 'Could not load servers.');
    els.home.innerHTML = appShell({
      active: 'Dashboard',
      activeKey: 'dashboard',
      content: `<div class="app-empty app-empty-error"><strong>Could not load dashboard.</strong><span>${escapeHtml(error.message || 'Try again later.')}</span></div>`,
    });
    wireMobileMenus(els.home);
  }
}

function wireOwnerToggle() {
  document.querySelectorAll('[data-owner-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.ownerMode === 'owner' ? 'owner' : 'user';
      if (next === currentViewMode) return;
      currentViewMode = next;
      localStorage.setItem(OWNER_VIEW_STORAGE_KEY, currentViewMode);
      showStatusToast('success', 'View mode changed', next === 'owner' ? 'Showing all Meowz servers.' : 'Showing normal user permissions.');
      renderDashboardHome();
    });
  });
}

function serverHeader(server, activeKey) {
  const memberText = typeof server.memberCount === 'number' ? `${formatNumber(server.memberCount)} members` : 'Members unavailable';
  return `
    <section class="app-page-header app-server-header">
      ${serverIcon(server, 'app-page-server-icon')}
      <div>
        <span class="app-eyebrow">Server Dashboard</span>
        <h1>${escapeHtml(server.name)}</h1>
        <p>Manage Meowz features for this server.</p>
        <div class="app-pill-row"><span>${escapeHtml(memberText)}</span><span>${escapeHtml(server.accessLabel || 'Manage Server')}</span><span>Bot Installed</span></div>
      </div>
    </section>
    <nav class="app-section-tabs" aria-label="Server sections">
      ${[
        ['overview', 'Overview'], ['leveling', 'Leveling'], ['welcome', 'Welcome Messages'], ['logs', 'Logs'], ['ai', 'AI Image Access'], ['moderation', 'Moderation']
      ].map(([key, label]) => `<a class="${key === activeKey ? 'is-active' : ''}" href="${escapeHtml(serverUrl(server, key))}">${escapeHtml(label)}</a>`).join('')}
    </nav>
  `;
}

function fieldRow(label, value) {
  return `<div class="app-info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function overviewPage(server) {
  return `
    ${serverHeader(server, 'overview')}
    <section class="app-dashboard-grid app-dashboard-grid-wide">
      <article class="app-card">
        <span class="app-eyebrow">Information</span>
        <h2>Server information</h2>
        <div class="app-info-list">
          ${fieldRow('Name', server.name)}
          ${fieldRow('Server ID', server.id)}
          ${fieldRow('Members', typeof server.memberCount === 'number' ? formatNumber(server.memberCount) : 'Unavailable')}
          ${fieldRow('Status', 'Meowz installed')}
        </div>
      </article>
      <article class="app-card">
        <span class="app-eyebrow">Permissions</span>
        <h2>Dashboard access</h2>
        <div class="app-info-list">
          ${fieldRow('Your access', server.accessLabel || 'Manage Server')}
          ${fieldRow('Dashboard access', 'Allowed')}
          ${fieldRow('Owner view', server.ownerView ? 'Active' : 'Normal')}
        </div>
      </article>
    </section>
    <section class="app-card">
      <span class="app-eyebrow">Server tools</span>
      <h2>Configure Meowz</h2>
      <div class="app-feature-grid">
        ${[
          ['leveling', 'Leveling System', 'XP, cooldowns and level-up messages.'],
          ['welcome', 'Welcome Messages', 'Member join and leave messages.'],
          ['logs', 'Logs', 'Server activity and audit events.'],
          ['ai', 'AI Image Access', 'Control who can use image editing.'],
          ['moderation', 'Moderation', 'Warnings and automod presets.'],
        ].map(([key, title, desc]) => `<a class="app-feature-card" href="${escapeHtml(serverUrl(server, key))}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc)}</span></a>`).join('')}
      </div>
    </section>
  `;
}

function switchControl(name, checked, label, description) {
  return `
    <label class="app-switch-row">
      <input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''} />
      <span class="app-switch-ui"></span>
      <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span>
    </label>
  `;
}

function textInput(name, label, value = '', placeholder = '') {
  return `
    <label class="app-field">
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
    </label>
  `;
}

function numberInput(name, label, value = '', min = 0) {
  return `
    <label class="app-field">
      <span>${escapeHtml(label)}</span>
      <input type="number" min="${Number(min)}" name="${escapeHtml(name)}" value="${escapeHtml(String(value))}" />
    </label>
  `;
}

function textareaInput(name, label, value = '', max = 200) {
  return `
    <label class="app-field">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeHtml(name)}" maxlength="${Number(max)}">${escapeHtml(value)}</textarea>
      <small><b data-count-for="${escapeHtml(name)}">${String(value).length}</b>/${Number(max)}</small>
    </label>
  `;
}

function saveButton() {
  return `<button class="app-save-button" type="submit">Save Changes</button>`;
}

function variableButton(variable) {
  return `<button class="app-mini-button" type="button" data-insert-variable="${escapeHtml(variable)}">${escapeHtml(variable)}</button>`;
}

function renderWelcomeCard(userName, serverName, showAvatar = true, showMember = true) {
  const initial = userName.slice(0, 1).toUpperCase() || 'U';
  return `
    <div class="discord-welcome-card">
      <div class="discord-welcome-bg"></div>
      ${showMember ? '<div class="discord-member-badge">MEMBER #11</div>' : ''}
      ${showAvatar ? `<div class="discord-preview-avatar-large">${escapeHtml(initial)}</div>` : ''}
      <div class="discord-card-text"><strong>WELCOME ${escapeHtml(userName.toUpperCase())}</strong><span>TO</span><b>${escapeHtml(serverName.toUpperCase())}</b></div>
    </div>
  `;
}

function discordPreview(server, settings) {
  const userName = 'Rafa';
  const serverName = server.name;
  return `
    <article class="app-card preview-card" data-welcome-preview>
      <span class="app-eyebrow">Live Preview</span>
      <h2>Discord preview</h2>
      <p>This is how the welcome message will look in Discord.</p>
      <div class="discord-preview-message">
        <span class="discord-avatar-small">M</span>
        <div class="discord-message-body">
          <div class="discord-message-head"><strong>Meowz</strong><em>APP</em><span>Today at 9:30 PM</span></div>
          <p>Welcome <mark>@${escapeHtml(userName)}</mark> to <strong>${escapeHtml(serverName)}</strong>!</p>
          ${renderWelcomeCard(userName, serverName, settings.showAvatar, settings.showMember)}
        </div>
      </div>
      <small class="preview-note">This is a preview. The actual Discord message can look slightly different depending on device size.</small>
    </article>
  `;
}

function welcomePage(server) {
  const settings = getSettings(server.id, 'welcome', {
    enabled: true,
    channel: '# welcome',
    style: 'Custom Card (Modern)',
    welcomeMessage: 'WELCOME {user}\nTO\n{server}',
    leaveMessage: 'Goodbye {user}. We hope to see you again soon.',
    showMember: true,
    showAvatar: true,
  });

  return `
    ${serverHeader(server, 'welcome')}
    <form class="app-settings-grid" data-settings-form="welcome" data-guild-id="${escapeHtml(server.id)}">
      <article class="app-card app-settings-card">
        <div class="app-card-head"><div><span class="app-eyebrow">Welcome Messages</span><h2>Welcome Messages</h2><p>Customize how Meowz welcomes new members to ${escapeHtml(server.name)}.</p></div><strong class="app-status-pill success">${settings.enabled ? 'Enabled' : 'Disabled'}</strong></div>
        ${switchControl('enabled', settings.enabled, 'Enable welcome messages', 'Send a message when someone joins the server.')}
        ${textInput('channel', 'Welcome Channel', settings.channel, '# welcome')}
        <label class="app-field"><span>Message Style</span><select name="style"><option ${settings.style.includes('Custom') ? 'selected' : ''}>Custom Card (Modern)</option><option>Text only</option></select></label>
        <div class="app-variable-row"><span>Insert Variable</span><div>${variableButton('{user}')}${variableButton('{server}')}${variableButton('{memberCount}')}</div></div>
        ${textareaInput('welcomeMessage', 'Welcome Message', settings.welcomeMessage, 200)}
        ${textInput('leaveMessage', 'Leave Message (Optional)', settings.leaveMessage, 'Goodbye {user}.')}
        ${switchControl('showMember', settings.showMember, 'Show member number on the card', 'Display the member position in the server.')}
        ${switchControl('showAvatar', settings.showAvatar, 'Show avatar on the card', 'Display the member avatar on the welcome card.')}
        ${saveButton()}
      </article>
      ${discordPreview(server, settings)}
    </form>
  `;
}

function levelingPage(server) {
  const settings = getSettings(server.id, 'leveling', { enabled: true, channel: '# level-up', xp: 15, cooldown: 60, leaderboard: true });
  return `
    ${serverHeader(server, 'leveling')}
    <form class="app-settings-grid" data-settings-form="leveling" data-guild-id="${escapeHtml(server.id)}">
      <article class="app-card app-settings-card">
        <div class="app-card-head"><div><span class="app-eyebrow">Leveling Settings</span><h2>Leveling System</h2><p>Configure XP, cooldowns and level-up messages for ${escapeHtml(server.name)}.</p></div><strong class="app-status-pill success">${settings.enabled ? 'Enabled' : 'Disabled'}</strong></div>
        ${switchControl('enabled', settings.enabled, 'Enable leveling', 'Award XP when members chat.')}
        ${textInput('channel', 'Level-up channel', settings.channel, '# level-up')}
        ${numberInput('xp', 'XP per message', settings.xp, 1)}
        ${numberInput('cooldown', 'Cooldown seconds', settings.cooldown, 5)}
        ${switchControl('leaderboard', settings.leaderboard, 'Enable leaderboard', 'Allow users to view rankings in Discord.')}
        ${saveButton()}
      </article>
      <article class="app-card preview-card"><span class="app-eyebrow">Preview</span><h2>Level card preview</h2><div class="level-preview"><strong>Rafa</strong><span>Level 12</span><div><i style="width:72%"></i></div><small>720 / 1000 XP</small></div><div class="app-feature-grid compact-grid"><span class="app-feature-card"><strong>Level roles</strong><span>Rewards can be added later.</span></span><span class="app-feature-card"><strong>Level-up messages</strong><span>Sent in the configured channel.</span></span></div></article>
    </form>
  `;
}

function logsPage(server) {
  const settings = getSettings(server.id, 'logs', { enabled: false, channel: '# logs', messageLogs: false, memberLogs: false, modLogs: false, voiceLogs: false });
  return `
    ${serverHeader(server, 'logs')}
    <form class="app-settings-grid" data-settings-form="logs" data-guild-id="${escapeHtml(server.id)}">
      <article class="app-card app-settings-card">
        <div class="app-card-head"><div><span class="app-eyebrow">Logs</span><h2>Event Logs</h2><p>Configure log channels and event tracking for ${escapeHtml(server.name)}.</p></div><strong class="app-status-pill ${settings.enabled ? 'success' : ''}">${settings.enabled ? 'Enabled' : 'Disabled'}</strong></div>
        ${switchControl('enabled', settings.enabled, 'Enable logs', 'Send server events to a channel.')}
        ${textInput('channel', 'Log channel', settings.channel, '# logs')}
        ${switchControl('messageLogs', settings.messageLogs, 'Message logs', 'Track deleted and edited messages.')}
        ${switchControl('memberLogs', settings.memberLogs, 'Member logs', 'Track joins and leaves.')}
        ${switchControl('modLogs', settings.modLogs, 'Moderation logs', 'Track warns, kicks, bans and admin actions.')}
        ${switchControl('voiceLogs', settings.voiceLogs, 'Voice logs', 'Track voice channel moves.')}
        ${saveButton()}
      </article>
      <article class="app-card preview-card"><span class="app-eyebrow">Preview</span><h2>Log examples</h2><div class="log-preview"><span>Member joined</span><strong>Rafa joined ${escapeHtml(server.name)}</strong></div><div class="log-preview warn"><span>Message deleted</span><strong>#general · deleted by moderator</strong></div><div class="log-preview mod"><span>Moderation action</span><strong>Warning issued to user</strong></div></article>
    </form>
  `;
}

function moderationPage(server) {
  const settings = getSettings(server.id, 'moderation', { enabled: false, channel: '# mod-logs', antiSpam: false, antiLinks: false, antiInvites: false, capsFilter: false });
  return `
    ${serverHeader(server, 'moderation')}
    <form class="app-settings-grid" data-settings-form="moderation" data-guild-id="${escapeHtml(server.id)}">
      <article class="app-card app-settings-card">
        <div class="app-card-head"><div><span class="app-eyebrow">Moderation</span><h2>Moderation Tools</h2><p>Configure warnings, automod and moderation controls for ${escapeHtml(server.name)}.</p></div><strong class="app-status-pill ${settings.enabled ? 'success' : ''}">${settings.enabled ? 'Enabled' : 'Disabled'}</strong></div>
        ${switchControl('enabled', settings.enabled, 'Enable moderation tools', 'Turn on moderation modules for this server.')}
        ${textInput('channel', 'Mod log channel', settings.channel, '# mod-logs')}
        ${switchControl('antiSpam', settings.antiSpam, 'Anti-spam', 'Detect repeated messages and spam behavior.')}
        ${switchControl('antiLinks', settings.antiLinks, 'Link filter', 'Block unwanted links.')}
        ${switchControl('antiInvites', settings.antiInvites, 'Invite filter', 'Block Discord invite links.')}
        ${switchControl('capsFilter', settings.capsFilter, 'Caps filter', 'Detect excessive uppercase messages.')}
        ${saveButton()}
      </article>
      <article class="app-card preview-card"><span class="app-eyebrow">Rules</span><h2>Automation presets</h2><div class="app-feature-grid compact-grid"><span class="app-feature-card"><strong>Warnings</strong><span>Track and count user warnings.</span></span><span class="app-feature-card"><strong>Auto actions</strong><span>Mute, kick or ban later.</span></span><span class="app-feature-card"><strong>Permission checks</strong><span>Discord roles remain respected.</span></span></div></article>
    </form>
  `;
}

function renderAccessAvatar(entry, label) {
  if (entry.avatarUrl) return `<span class="access-avatar"><img src="${escapeHtml(entry.avatarUrl)}" alt="" /></span>`;
  return `<span class="access-avatar">${escapeHtml((label || 'U').slice(0, 1).toUpperCase())}</span>`;
}

function accessSource(entry) {
  if (entry.source === 'bot_owner') return 'Bot owner · default access';
  if (entry.source === 'manage_server') return 'Manage Server · default access';
  return 'Manually allowed';
}

function accessRow(entry, isDefault = false) {
  const label = entry.displayName || entry.username || entry.userId;
  return `
    <div class="access-row">
      ${renderAccessAvatar(entry, label)}
      <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(entry.userId || entry.username || 'Discord user')}</small><em>${escapeHtml(accessSource(entry))}</em></span>
      <button type="button" ${isDefault ? 'disabled title="Default access cannot be removed here."' : `data-remove-ai-user="${escapeHtml(entry.userId)}" data-remove-ai-label="${escapeHtml(label)}"`} class="access-remove">Remove</button>
    </div>
  `;
}

function renderAiList(container, payload = {}) {
  const defaultUsers = Array.isArray(payload.defaultUsers) ? payload.defaultUsers : [];
  const users = Array.isArray(payload.users) ? payload.users : (Array.isArray(payload) ? payload : []);
  container.innerHTML = `
    <div class="app-note"><strong>Default access</strong><span>The bot owner and users with Manage Server permission can use /edit_image by default. Their Remove buttons stay disabled.</span></div>
    <div class="access-section"><h3>Default access</h3>${defaultUsers.length ? defaultUsers.map((u) => accessRow(u, true)).join('') : '<div class="app-empty"><strong>No default users found.</strong><span>The bot may need permissions to list server members.</span></div>'}</div>
    <div class="access-section"><h3>Manually allowed</h3>${users.length ? users.map((u) => accessRow(u, false)).join('') : '<div class="app-empty"><strong>No manually added users.</strong><span>Paste a Discord user ID to add access.</span></div>'}</div>
  `;
}

async function loadAiAccess(guildId) {
  const list = document.querySelector('[data-ai-access-list]');
  if (!list) return;
  try {
    const payload = await getImageAccess(guildId);
    renderAiList(list, payload);
  } catch (error) {
    list.innerHTML = `<div class="app-empty app-empty-error"><strong>Could not load access list.</strong><span>${escapeHtml(error.message || 'Try again later.')}</span></div>`;
  }
}

function aiPage(server) {
  return `
    ${serverHeader(server, 'ai')}
    <section class="app-settings-grid" data-ai-page data-guild-id="${escapeHtml(server.id)}">
      <article class="app-card app-settings-card">
        <span class="app-eyebrow">AI Image Access</span><h2>Allowed users</h2><p>Control who can use the image editing command in ${escapeHtml(server.name)}.</p>
        <form class="ai-form" data-ai-form>
          ${textInput('userId', 'Discord user ID', '', '123456789012345678')}
          <button class="app-save-button" type="submit">Add user</button>
        </form>
        <p class="app-small-muted">Paste a Discord user ID. Username autocomplete can be connected later.</p>
      </article>
      <article class="app-card preview-card"><span class="app-eyebrow">Current Access</span><h2>People allowed</h2><div class="access-list" data-ai-access-list><div class="app-empty"><strong>Loading...</strong><span>Please wait.</span></div></div></article>
    </section>
  `;
}

function attachSettingsForm(server, section) {
  const form = document.querySelector('[data-settings-form]');
  if (!form) return;

  form.addEventListener('input', () => {
    form.querySelectorAll('textarea[maxlength]').forEach((textarea) => {
      const counter = form.querySelector(`[data-count-for="${textarea.name}"]`);
      if (counter) counter.textContent = textarea.value.length;
    });
    if (section === 'welcome') updateWelcomePreview(server, form);
  });

  form.querySelectorAll('[data-insert-variable]').forEach((button) => {
    button.addEventListener('click', () => {
      const textarea = form.querySelector('textarea[name="welcomeMessage"]');
      if (!textarea) return;
      const variable = button.dataset.insertVariable || '';
      const start = textarea.selectionStart || textarea.value.length;
      const end = textarea.selectionEnd || textarea.value.length;
      textarea.value = `${textarea.value.slice(0, start)}${variable}${textarea.value.slice(end)}`;
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = {};
    new FormData(form).forEach((value, key) => { values[key] = value; });
    form.querySelectorAll('input[type="checkbox"]').forEach((input) => { values[input.name] = input.checked; });
    saveSettings(server.id, section, values);
    showStatusToast('success', `${sectionTitle(section)} saved`, 'Your changes were saved locally and are ready for API sync.');
  });
}

function updateWelcomePreview(server, form) {
  const preview = document.querySelector('[data-welcome-preview]');
  if (!preview) return;
  const showAvatar = form.querySelector('input[name="showAvatar"]')?.checked ?? true;
  const showMember = form.querySelector('input[name="showMember"]')?.checked ?? true;
  const holder = preview.querySelector('.discord-welcome-card');
  if (holder) holder.outerHTML = renderWelcomeCard('Rafa', server.name, showAvatar, showMember);
}

function attachAiForm(server) {
  const page = document.querySelector('[data-ai-page]');
  if (!page) return;
  loadAiAccess(server.id);

  page.querySelector('[data-ai-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input[name="userId"]');
    const userId = String(input?.value || '').trim();
    if (!/^\d{15,25}$/.test(userId)) {
      showStatusToast('error', 'Invalid user ID', 'Paste a valid Discord user ID.');
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Adding...';
    try {
      await addImageAccessUser(server.id, userId);
      input.value = '';
      showStatusToast('success', 'Access updated', 'User was added to AI image access.');
      await loadAiAccess(server.id);
    } catch (error) {
      showStatusToast('error', 'Could not add user', error.message || 'Try again later.');
    } finally {
      button.disabled = false;
      button.textContent = 'Add user';
    }
  });

  page.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-ai-user]');
    if (!button) return;
    const userId = button.dataset.removeAiUser;
    const label = button.dataset.removeAiLabel || userId;
    if (!window.confirm(`Remove manual AI image access from ${label}?`)) return;
    button.disabled = true;
    button.textContent = 'Removing...';
    try {
      await removeImageAccessUser(server.id, userId);
      showStatusToast('success', 'Access updated', 'User was removed.');
      await loadAiAccess(server.id);
    } catch (error) {
      showStatusToast('error', 'Could not remove user', error.message || 'Try again later.');
      button.disabled = false;
      button.textContent = 'Remove';
    }
  });
}

function serverPageContent(server, section) {
  const active = new Set(['overview', 'leveling', 'welcome', 'logs', 'ai', 'moderation']).has(section) ? section : 'overview';
  if (active === 'welcome') return welcomePage(server);
  if (active === 'leveling') return levelingPage(server);
  if (active === 'logs') return logsPage(server);
  if (active === 'ai') return aiPage(server);
  if (active === 'moderation') return moderationPage(server);
  return overviewPage(server);
}

async function renderServerPage(id, section = 'overview') {
  if (!els.detailContent || !els.detail) return;
  if (els.home) els.home.hidden = true;
  els.detail.hidden = false;
  els.detailContent.innerHTML = appShell({ active: sectionTitle(section), activeKey: section, content: '<div class="app-loading-card">Loading server...</div>' });

  try {
    const payload = await getDashboardServer(id);
    const server = payload.server;
    document.title = `${server.name} — ${sectionTitle(section)} — Meowz`;
    const active = new Set(['overview', 'leveling', 'welcome', 'logs', 'ai', 'moderation']).has(section) ? section : 'overview';
    els.detailContent.innerHTML = appShell({ server, active: sectionTitle(active), activeKey: active, content: serverPageContent(server, active) });
    wireMobileMenus(els.detailContent);
    attachSettingsForm(server, active);
    if (active === 'ai') attachAiForm(server);
  } catch (error) {
    showStatusToast('error', 'Server failed to load', error.message || 'Could not open server.');
    els.detailContent.innerHTML = appShell({
      active: 'Server unavailable',
      content: `<div class="app-empty app-empty-error"><strong>Could not open this server.</strong><span>${escapeHtml(error.message || 'Try again later.')}</span><a class="btn btn-secondary" href="/dashboard">Back to dashboard</a></div>`,
    });
    wireMobileMenus(els.detailContent);
  }
}

export function initDashboard() {
  if (!els.home && !els.detail) return;
  const route = routeInfo();
  if (route) renderServerPage(route.id, route.section);
  else renderDashboardHome();
}
