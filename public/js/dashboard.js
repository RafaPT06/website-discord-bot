import { getDashboardGuilds, getDashboardServer, getImageAccess, addImageAccessUser, removeImageAccessUser } from './api.js';
import { escapeHtml, formatNumber, setText } from './utils.js';

const els = {
  home: document.querySelector('[data-dashboard-home]'),
  detail: document.querySelector('[data-server-detail]'),
  title: document.querySelector('[data-dashboard-title]'),
  intro: document.querySelector('[data-dashboard-intro]'),
  installed: document.querySelector('[data-installed-servers]'),
  available: document.querySelector('[data-available-servers]'),
  installedCount: document.querySelector('[data-installed-count]'),
  availableCount: document.querySelector('[data-available-count]'),
  heroManagedCount: document.querySelector('[data-dashboard-managed-count]'),
  heroAvailableCount: document.querySelector('[data-dashboard-available-count]'),
  detailContent: document.querySelector('[data-server-detail-content]'),
};

function currentServerRoute() {
  const match = window.location.pathname.match(/^\/dashboard\/server\/([^/]+)(?:\/([^/]+))?\/?$/);
  return match ? { id: decodeURIComponent(match[1]), section: match[2] ? decodeURIComponent(match[2]) : 'overview' } : null;
}

function serverInitial(name = 'S') {
  return escapeHtml((name.trim().charAt(0) || 'S').toUpperCase());
}

function serverIcon(server, className = 'server-icon') {
  if (server.iconUrl) {
    return `<span class="${className}"><img src="${escapeHtml(server.iconUrl)}" alt="" loading="lazy" /></span>`;
  }
  return `<span class="${className} ${className}-fallback">${serverInitial(server.name)}</span>`;
}

function serverSubtitle(server, fallback) {
  if (typeof server.memberCount === 'number') return `${formatNumber(server.memberCount)} members`;
  return fallback;
}

function renderServerList(container, servers, type) {
  if (!container) return;

  if (!servers.length) {
    container.innerHTML = type === 'installed'
      ? `<div class="server-empty-state"><strong>No manageable servers with Meowz yet.</strong><span>Invite Meowz to a server where you have Manage Server permissions to start managing it here.</span></div>`
      : `<div class="server-empty-state"><strong>Meowz is already installed in all your manageable servers.</strong><span>If you get access to another server later, it will appear here.</span></div>`;
    return;
  }

  container.innerHTML = servers.map((server) => {
    const isInstalled = type === 'installed';
    const href = isInstalled ? server.manageUrl : server.inviteUrl;
    const label = isInstalled ? 'Open' : 'Invite';
    const subtitle = isInstalled ? serverSubtitle(server, 'Meowz installed') : 'You can invite Meowz here';
    const target = isInstalled ? '' : ' target="_blank" rel="noopener noreferrer"';

    return `
      <a class="server-row" href="${escapeHtml(href || '#')}"${target}>
        ${serverIcon(server)}
        <span class="server-row-main">
          <strong>${escapeHtml(server.name)}</strong>
          <span>${escapeHtml(subtitle)}</span>
        </span>
        <span class="server-row-action">${escapeHtml(label)}</span>
      </a>
    `;
  }).join('');
}

function renderDashboard(data) {
  const installed = Array.isArray(data.installed) ? data.installed : [];
  const available = Array.isArray(data.available) ? data.available : [];
  setText(els.installedCount, `${installed.length} server${installed.length === 1 ? '' : 's'}`);
  setText(els.availableCount, `${available.length} server${available.length === 1 ? '' : 's'}`);
  setText(els.heroManagedCount, formatNumber(installed.length));
  setText(els.heroAvailableCount, formatNumber(available.length));
  renderServerList(els.installed, installed, 'installed');
  renderServerList(els.available, available, 'available');
}

function renderDashboardError(message) {
  const html = `<div class="server-empty-state error"><strong>Could not load servers.</strong><span>${escapeHtml(message || 'Try logging out and logging in again.')}</span></div>`;
  if (els.installed) els.installed.innerHTML = html;
  if (els.available) els.available.innerHTML = html;
}

function serverManageUrl(server, section = 'overview') {
  const base = `/dashboard/server/${encodeURIComponent(server.id)}`;
  return section === 'overview' ? base : `${base}/${encodeURIComponent(section)}`;
}

function renderServerHeader(server, activeSection = 'overview') {
  const memberText = typeof server.memberCount === 'number' ? `${formatNumber(server.memberCount)} member${server.memberCount === 1 ? '' : 's'}` : 'Members unavailable';
  const tabs = [
    ['overview', 'Overview'],
    ['leveling', 'Leveling'],
    ['welcome', 'Welcome messages'],
    ['logs', 'Logs'],
    ['ai', 'AI image access'],
    ['moderation', 'Moderation tools'],
  ];

  return `
    <div class="server-detail-hero server-detail-hero-plain">
      <a class="server-breadcrumb" href="/dashboard">Dashboard / ${escapeHtml(server.name)}</a>
      <div class="server-detail-heading server-detail-heading-plain">
        ${serverIcon(server, 'server-detail-icon')}
        <div>
          <span class="dashboard-eyebrow">Server dashboard</span>
          <h2>${escapeHtml(server.name)}</h2>
          <p class="muted">Manage Meowz features for this server.</p>
          <div class="server-detail-pills">
            <span>${escapeHtml(memberText)}</span>
            <span>Manage Server</span>
            <span>Bot Installed</span>
          </div>
        </div>
      </div>
      <nav class="server-section-tabs" aria-label="Server dashboard sections">
        ${tabs.map(([section, label]) => `<a href="${escapeHtml(serverManageUrl(server, section))}" class="${section === activeSection ? 'is-active' : ''}">${escapeHtml(label)}</a>`).join('')}
      </nav>
    </div>
  `;
}

function renderServerOverview(server) {
  const tools = [
    ['Leveling settings', 'XP system, level roles and leaderboards.', 'leveling'],
    ['Welcome messages', 'Member join and leave messages.', 'welcome'],
    ['Logs', 'Server activity and audit events.', 'logs'],
    ['AI image access', 'Control who can use image editing.', 'ai'],
    ['Moderation tools', 'Warnings, automod and actions.', 'moderation'],
  ];

  return `
    <div class="server-detail-grid">
      <article class="dashboard-card compact">
        <span class="dashboard-card-label">Information</span>
        <div class="server-info-list">
          <div><span>Name</span><strong>${escapeHtml(server.name)}</strong></div>
          <div><span>Server ID</span><strong>${escapeHtml(server.id)}</strong></div>
          <div><span>Members</span><strong>${typeof server.memberCount === 'number' ? formatNumber(server.memberCount) : 'Unavailable'}</strong></div>
          <div><span>Status</span><strong>Meowz installed</strong></div>
        </div>
      </article>

      <article class="dashboard-card compact">
        <span class="dashboard-card-label">Permissions</span>
        <div class="server-info-list">
          <div><span>Your access</span><strong>Manage Server</strong></div>
          <div><span>Dashboard access</span><strong>Allowed</strong></div>
          <div><span>Customization</span><strong>Coming soon</strong></div>
        </div>
      </article>

      <article class="dashboard-card compact server-coming-card">
        <span class="dashboard-card-label">Customization coming soon</span>
        <h3>Server tools</h3>
        <p class="muted">These sections will become configurable from the website later.</p>
        <div class="coming-grid">
          ${tools.map(([title, description, section]) => `<a href="${escapeHtml(serverManageUrl(server, section))}"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small><em>Coming soon</em></a>`).join('')}
        </div>
      </article>
    </div>
  `;
}

function renderLevelingPage(server) {
  return `
    <div class="settings-page-grid">
      <article class="dashboard-card compact settings-main-card">
        <span class="dashboard-card-label">Leveling settings</span>
        <h3>Leveling</h3>
        <p class="muted">Configure XP, level-up messages and level rewards from the website. Editing is coming soon.</p>
        <div class="settings-list">
          <div><span>Status</span><strong>Coming soon</strong></div>
          <div><span>Level-up channel</span><strong>Not configured</strong></div>
          <div><span>XP per message</span><strong>15 XP</strong></div>
          <div><span>Cooldown</span><strong>60 seconds</strong></div>
          <div><span>Leaderboard</span><strong>Available in Discord</strong></div>
        </div>
      </article>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Level roles</span>
        <h3>Rewards</h3>
        <p class="muted">Level role management will be added here later.</p>
        <div class="settings-empty-state">
          <strong>No roles configured yet.</strong>
          <span>When this section is enabled, you will be able to add level rewards from the dashboard.</span>
        </div>
      </article>

      <article class="dashboard-card compact server-coming-card">
        <span class="dashboard-card-label">Preview</span>
        <h3>What this page will manage</h3>
        <div class="coming-grid coming-grid-two">
          <span><strong>XP settings</strong><small>Adjust message XP and cooldowns.</small><em>Coming soon</em></span>
          <span><strong>Level-up messages</strong><small>Choose where level-up messages are sent.</small><em>Coming soon</em></span>
          <span><strong>Level roles</strong><small>Create rewards for reaching specific levels.</small><em>Coming soon</em></span>
          <span><strong>Leaderboard</strong><small>View server ranking tools from the dashboard.</small><em>Coming soon</em></span>
        </div>
        <button class="btn btn-secondary disabled-button" type="button" disabled>Save changes coming soon</button>
      </article>
    </div>
  `;
}

function disabledOption(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function previewCard(title, description) {
  return `<span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small><em>Coming soon</em></span>`;
}

function comingSaveButton(label = 'Save changes coming soon') {
  return `<button class="btn btn-secondary disabled-button" type="button" disabled>${escapeHtml(label)}</button>`;
}

function renderWelcomePage(server) {
  return `
    <div class="settings-page-grid">
      <article class="dashboard-card compact settings-main-card">
        <span class="dashboard-card-label">Welcome messages</span>
        <h3>Member greetings</h3>
        <p class="muted">Configure join and leave messages for ${escapeHtml(server.name)}. Editing is coming soon.</p>
        <div class="settings-list">
          ${disabledOption('Status', 'Coming soon')}
          ${disabledOption('Welcome channel', 'Not configured')}
          ${disabledOption('Join message', 'Not configured')}
          ${disabledOption('Leave message', 'Not configured')}
          ${disabledOption('Test message', 'Unavailable')}
        </div>
      </article>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Templates</span>
        <h3>Message variables</h3>
        <p class="muted">Templates will support common placeholders when this section is enabled.</p>
        <div class="settings-empty-state">
          <strong>No templates configured yet.</strong>
          <span>You will be able to use variables like user, server and member count later.</span>
        </div>
      </article>

      <article class="dashboard-card compact server-coming-card">
        <span class="dashboard-card-label">Preview</span>
        <h3>What this page will manage</h3>
        <div class="coming-grid coming-grid-two">
          ${previewCard('Welcome channel', 'Choose where join messages are sent.')}
          ${previewCard('Join messages', 'Customize the message sent when someone joins.')}
          ${previewCard('Leave messages', 'Customize the message sent when someone leaves.')}
          ${previewCard('Message preview', 'Test how messages look before saving.')}
        </div>
        ${comingSaveButton()}
      </article>
    </div>
  `;
}

function renderLogsPage(server) {
  return `
    <div class="settings-page-grid">
      <article class="dashboard-card compact settings-main-card">
        <span class="dashboard-card-label">Logs</span>
        <h3>Server activity</h3>
        <p class="muted">Configure log channels and event tracking for ${escapeHtml(server.name)}. Editing is coming soon.</p>
        <div class="settings-list">
          ${disabledOption('Status', 'Coming soon')}
          ${disabledOption('Log channel', 'Not configured')}
          ${disabledOption('Message logs', 'Disabled')}
          ${disabledOption('Member logs', 'Disabled')}
          ${disabledOption('Moderation logs', 'Disabled')}
        </div>
      </article>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Events</span>
        <h3>Tracked activity</h3>
        <p class="muted">Event toggles will appear here once logging settings are connected to the bot.</p>
        <div class="settings-empty-state">
          <strong>No log events configured yet.</strong>
          <span>You will be able to enable message edits, deletes, joins, leaves and moderation actions.</span>
        </div>
      </article>

      <article class="dashboard-card compact server-coming-card">
        <span class="dashboard-card-label">Preview</span>
        <h3>What this page will manage</h3>
        <div class="coming-grid coming-grid-two">
          ${previewCard('Log channels', 'Choose where server logs are sent.')}
          ${previewCard('Message events', 'Track edits, deletes and message actions.')}
          ${previewCard('Member events', 'Track joins, leaves and profile changes.')}
          ${previewCard('Moderation events', 'Track warns, bans, kicks and admin actions.')}
        </div>
        ${comingSaveButton()}
      </article>
    </div>
  `;
}

function renderAiPage(server) {
  return `
    <div class="settings-page-grid ai-access-page" data-ai-access-page data-guild-id="${escapeHtml(server.id)}">
      <article class="dashboard-card compact settings-main-card ai-access-main">
        <span class="dashboard-card-label">AI image access</span>
        <h3>Allowed users</h3>
        <p class="muted">Control who can use the image editing command in ${escapeHtml(server.name)}.</p>

        <form class="ai-access-form" data-ai-access-form>
          <label for="ai-access-user-id">Discord user ID</label>
          <div class="ai-access-input-row">
            <input id="ai-access-user-id" name="userId" inputmode="numeric" autocomplete="off" placeholder="123456789012345678" />
            <button class="btn btn-primary" type="submit">Add user</button>
          </div>
          <p class="muted tiny">Paste a Discord user ID. User search by username can be added later.</p>
        </form>
      </article>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Current access</span>
        <h3>People allowed</h3>
        <div class="ai-access-list" data-ai-access-list>
          <div class="settings-empty-state"><strong>Loading allowed users...</strong><span>Please wait.</span></div>
        </div>
      </article>

      <article class="dashboard-card compact server-coming-card">
        <span class="dashboard-card-label">Command behavior</span>
        <h3>How access works</h3>
        <div class="coming-grid coming-grid-two">
          <span><strong>Server only</strong><small>The image editing command stays disabled in DMs.</small><em>Active</em></span>
          <span><strong>Allowed users</strong><small>Only users listed here can run the command.</small><em>Active</em></span>
          <span><strong>Manage Server</strong><small>Server managers can update this list from the dashboard.</small><em>Active</em></span>
          <span><strong>Roles</strong><small>Role-based access can be added later.</small><em>Coming soon</em></span>
        </div>
      </article>
    </div>
  `;
}

function renderAiAccessList(container, users = []) {
  if (!container) return;
  if (!users.length) {
    container.innerHTML = `<div class="settings-empty-state"><strong>No users allowed yet.</strong><span>Add a trusted user ID to let them use AI image editing in this server.</span></div>`;
    return;
  }

  container.innerHTML = users.map((entry) => {
    const label = entry.displayName || entry.username || entry.userId;
    const sub = entry.username && entry.userId !== entry.username ? entry.userId : 'Allowed user';
    return `
      <div class="ai-access-user-row" data-user-id="${escapeHtml(entry.userId)}">
        <span class="ai-access-user-avatar">${escapeHtml((label || 'U').slice(0, 1).toUpperCase())}</span>
        <span class="ai-access-user-main">
          <strong>${escapeHtml(label)}</strong>
          <small>${escapeHtml(sub)}</small>
        </span>
        <button class="server-row-action danger" type="button" data-remove-ai-user="${escapeHtml(entry.userId)}">Remove</button>
      </div>
    `;
  }).join('');
}

let aiAccessRefreshPromise = null;

async function refreshAiAccess(guildId) {
  const list = document.querySelector('[data-ai-access-list]');
  if (!list) return;
  if (aiAccessRefreshPromise) return aiAccessRefreshPromise;

  aiAccessRefreshPromise = (async () => {
    try {
      const data = await getImageAccess(guildId);
      renderAiAccessList(list, data.users || []);
    } catch (err) {
      list.innerHTML = `<div class="settings-empty-state error"><strong>Could not load access list.</strong><span>${escapeHtml(err.message || 'Try again later.')}</span></div>`;
    } finally {
      aiAccessRefreshPromise = null;
    }
  })();

  return aiAccessRefreshPromise;
}


function initAiAccessControls(guildId) {
  const page = document.querySelector('[data-ai-access-page]');
  if (!page) return;

  refreshAiAccess(guildId);

  const form = page.querySelector('[data-ai-access-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = form.querySelector('input[name="userId"]');
    const userId = String(input?.value || '').trim();
    if (!/^\d{15,25}$/.test(userId)) {
      input?.focus();
      input?.classList.add('is-invalid');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const previous = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Adding...';
    }

    try {
      await addImageAccessUser(guildId, userId);
      if (input) input.value = '';
      await refreshAiAccess(guildId);
    } catch (err) {
      const list = document.querySelector('[data-ai-access-list]');
      if (list) list.innerHTML = `<div class="settings-empty-state error"><strong>Could not add user.</strong><span>${escapeHtml(err.message || 'Try again later.')}</span></div>`;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previous || 'Add user';
      }
    }
  });

  page.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-ai-user]');
    if (!button) return;
    const userId = button.getAttribute('data-remove-ai-user');
    if (!userId) return;
    button.disabled = true;
    button.textContent = 'Removing...';
    try {
      await removeImageAccessUser(guildId, userId);
      await refreshAiAccess(guildId);
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Remove';
    }
  });
}

function renderModerationPage(server) {
  return `
    <div class="settings-page-grid">
      <article class="dashboard-card compact settings-main-card">
        <span class="dashboard-card-label">Moderation tools</span>
        <h3>Server moderation</h3>
        <p class="muted">Configure warnings, automod and moderation controls for ${escapeHtml(server.name)}. Editing is coming soon.</p>
        <div class="settings-list">
          ${disabledOption('Status', 'Coming soon')}
          ${disabledOption('Warnings', 'Not configured')}
          ${disabledOption('Auto moderation', 'Disabled')}
          ${disabledOption('Mod log channel', 'Not configured')}
          ${disabledOption('Permission checks', 'Discord only')}
        </div>
      </article>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Rules</span>
        <h3>Automation</h3>
        <p class="muted">Automod rules and moderation presets will be configured here later.</p>
        <div class="settings-empty-state">
          <strong>No moderation rules yet.</strong>
          <span>You will be able to manage warning thresholds, blocked words and automated actions.</span>
        </div>
      </article>

      <article class="dashboard-card compact server-coming-card">
        <span class="dashboard-card-label">Preview</span>
        <h3>What this page will manage</h3>
        <div class="coming-grid coming-grid-two">
          ${previewCard('Warnings', 'Configure warning rules and thresholds.')}
          ${previewCard('Automod', 'Set automatic filters and actions.')}
          ${previewCard('Moderation logs', 'Choose where actions are reported.')}
          ${previewCard('Permissions', 'Control who can use moderation tools.')}
        </div>
        ${comingSaveButton()}
      </article>
    </div>
  `;
}

function renderServerDetail(data, section = 'overview') {
  if (!els.home || !els.detail || !els.detailContent) return;
  const server = data.server;
  const allowedSections = new Set(['overview', 'leveling', 'welcome', 'logs', 'ai', 'moderation']);
  const activeSection = allowedSections.has(section) ? section : 'overview';
  els.home.hidden = true;
  els.detail.hidden = false;
  document.title = `${server.name} — Meowz Dashboard`;

  let content = renderServerOverview(server);
  if (activeSection === 'leveling') content = renderLevelingPage(server);
  if (activeSection === 'welcome') content = renderWelcomePage(server);
  if (activeSection === 'logs') content = renderLogsPage(server);
  if (activeSection === 'ai') content = renderAiPage(server);
  if (activeSection === 'moderation') content = renderModerationPage(server);

  els.detailContent.innerHTML = `${renderServerHeader(server, activeSection)}${content}`;
  if (activeSection === 'ai') initAiAccessControls(server.id);
}

function renderServerDetailError(message) {
  if (!els.home || !els.detail || !els.detailContent) return;
  els.home.hidden = true;
  els.detail.hidden = false;
  els.detailContent.innerHTML = `
    <div class="dashboard-card server-detail-error">
      <span class="dashboard-card-label">Server unavailable</span>
      <h2>Could not open this server.</h2>
      <p class="muted">${escapeHtml(message || 'You may not have permission to manage this server, or Meowz is not installed there.')}</p>
      <a class="btn btn-secondary" href="/dashboard">Back to dashboard</a>
    </div>
  `;
}

async function loadServerDetail(id, section = 'overview') {
  try {
    const data = await getDashboardServer(id);
    renderServerDetail(data, section);
  } catch (err) {
    renderServerDetailError(err.message);
  }
}

async function loadDashboardHome() {
  if (!els.home) return;
  if (els.detail) els.detail.hidden = true;
  els.home.hidden = false;
  try {
    const data = await getDashboardGuilds();
    renderDashboard(data);
  } catch (err) {
    renderDashboardError(err.message);
  }
}

export function initDashboard() {
  if (!els.home && !els.detail) return;
  const serverRoute = currentServerRoute();
  if (serverRoute) {
    loadServerDetail(serverRoute.id, serverRoute.section);
  } else {
    loadDashboardHome();
  }
}
