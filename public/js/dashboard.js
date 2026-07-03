import { getDashboardGuilds, getDashboardServer, getImageAccess, addImageAccessUser, removeImageAccessUser, getWelcomeSettings, saveWelcomeSettings } from './api.js';
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
  ownerPanel: document.querySelector('[data-owner-view-panel]'),
  ownerTitle: document.querySelector('[data-owner-view-title]'),
  heroManagedCount: document.querySelector('[data-dashboard-managed-count]'),
  heroAvailableCount: document.querySelector('[data-dashboard-available-count]'),
  detailContent: document.querySelector('[data-server-detail-content]'),
};

const OWNER_VIEW_STORAGE_KEY = 'meowzDashboardViewMode';
let currentViewMode = localStorage.getItem(OWNER_VIEW_STORAGE_KEY) === 'owner' ? 'owner' : 'user';

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

function updateOwnerToggle(isOwner, ownerMode) {
  if (!els.ownerPanel) return;
  els.ownerPanel.hidden = !isOwner;
  if (!isOwner) return;

  currentViewMode = ownerMode ? 'owner' : 'user';
  localStorage.setItem(OWNER_VIEW_STORAGE_KEY, currentViewMode);
  if (els.ownerTitle) els.ownerTitle.textContent = ownerMode ? 'Owner View' : 'User Preview';
  els.ownerPanel.querySelectorAll('[data-view-mode]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.viewMode === currentViewMode);
  });
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
    const access = isInstalled && server.accessLabel ? `<em>${escapeHtml(server.accessLabel)}</em>` : '';
    const target = isInstalled ? '' : ' target="_blank" rel="noopener noreferrer"';

    return `
      <a class="server-row" href="${escapeHtml(href || '#')}"${target}>
        ${serverIcon(server)}
        <span class="server-row-main">
          <strong>${escapeHtml(server.name)}</strong>
          <span>${escapeHtml(subtitle)}</span>
          ${access}
        </span>
        <span class="server-row-action">${escapeHtml(label)}</span>
      </a>
    `;
  }).join('');
}

function renderDashboard(data) {
  updateOwnerToggle(Boolean(data.isOwner), Boolean(data.ownerMode));
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

function renderServerSidebar(server, activeSection = 'overview') {
  const settings = [
    ['overview', 'Overview'],
    ['ai', 'AI Image Access'],
    ['leveling', 'Leveling System'],
    ['welcome', 'Welcome Messages'],
    ['logs', 'Logs'],
    ['moderation', 'Moderation'],
  ];

  return `
    <aside class="server-app-sidebar" aria-label="Server settings navigation">
      <a class="server-sidebar-brand" href="/dashboard">
        <span class="brand-icon" data-bot-avatar-small>M</span>
        <strong>Meowz</strong>
      </a>
      <div class="server-sidebar-current">
        ${serverIcon(server, 'server-sidebar-icon')}
        <span><strong>${escapeHtml(server.name)}</strong><small>Server Settings</small></span>
      </div>
      <nav class="server-sidebar-nav">
        <span>Settings</span>
        ${settings.map(([section, label]) => `<a href="${escapeHtml(serverManageUrl(server, section))}" class="${section === activeSection ? 'is-active' : ''}">${escapeHtml(label)}</a>`).join('')}
      </nav>
      <div class="server-sidebar-help">
        <strong>Owner tools</strong>
        <span>Owner/User view stays on the main dashboard for now.</span>
        <a href="/dashboard">Back to dashboard</a>
      </div>
    </aside>
  `;
}

function renderServerAppShell(server, activeSection, content) {
  return `
    <div class="server-app-shell">
      ${renderServerSidebar(server, activeSection)}
      <div class="server-app-main">
        <div class="server-app-topbar">
          <a class="server-breadcrumb" href="/dashboard">Servers / ${escapeHtml(server.name)}</a>
          <span class="server-app-status">${activeSection === 'welcome' ? 'Welcome Messages' : activeSection === 'ai' ? 'AI Image Access' : activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</span>
        </div>
        ${renderServerHeader(server, activeSection)}
        ${content}
      </div>
    </div>
  `;
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
    <div class="welcome-designer-grid" data-welcome-page data-guild-id="${escapeHtml(server.id)}" data-server-name="${escapeHtml(server.name)}">
      <article class="dashboard-card compact welcome-designer-card">
        <span class="dashboard-card-label">Welcome messages</span>
        <div class="settings-card-title-row">
          <h3>Welcome Messages</h3>
          <span class="settings-status-pill" data-welcome-status>Loading</span>
        </div>
        <p class="muted">Customize how Meowz welcomes new members to ${escapeHtml(server.name)}.</p>

        <form class="welcome-settings-form" data-welcome-form>
          <div class="welcome-setting-block switch-row">
            <span>
              <strong>Enable welcome messages</strong>
              <small>Send a message when someone joins the server.</small>
            </span>
            <label class="ui-switch"><input type="checkbox" name="welcomeEnabled" data-welcome-enabled /><span></span></label>
          </div>

          <label class="welcome-field-label" for="welcome-channel-input">Welcome Channel</label>
          <div class="fake-select input-select-shell"><span>#</span><input id="welcome-channel-input" name="welcomeChannelId" autocomplete="off" placeholder="Channel ID or name" /><small>Channel picker coming later</small></div>

          <label class="welcome-field-label" for="welcome-style-select">Message Style</label>
          <select id="welcome-style-select" class="welcome-input" name="messageStyle">
            <option value="modern">Custom Card (Modern)</option>
            <option value="text">Text only</option>
          </select>

          <div class="message-label-row">
            <label class="welcome-field-label" for="welcome-message-preview-input">Welcome Message</label>
            <select class="mini-action welcome-variable-select" data-welcome-variable>
              <option value="">Insert Variable</option>
              <option value="{user}">{user}</option>
              <option value="{server}">{server}</option>
              <option value="{memberCount}">{memberCount}</option>
            </select>
          </div>
          <textarea id="welcome-message-preview-input" class="welcome-textarea" rows="5" name="welcomeMessage" maxlength="200" data-welcome-message>WELCOME {user}\nTO\n{server}</textarea>
          <div class="character-count" data-welcome-count>0/200</div>

          <label class="welcome-field-label" for="leave-message-input">Leave Message (Optional)</label>
          <input id="leave-message-input" class="welcome-input" name="leaveMessage" data-leave-message maxlength="200" value="Goodbye {user}. We hope to see you again soon." />

          <div class="welcome-options">
            <label><input type="checkbox" name="showMemberNumber" data-show-member checked /> Show member number on the card</label>
            <label><input type="checkbox" name="showAvatar" data-show-avatar checked /> Show avatar on the card</label>
          </div>

          <button class="btn btn-primary welcome-save-button" type="submit" data-welcome-save>Save Changes</button>
          <p class="muted tiny" data-welcome-feedback></p>
        </form>
      </article>

      <article class="dashboard-card compact welcome-preview-card">
        <span class="dashboard-card-label">Live preview</span>
        <h3>Discord preview</h3>
        <p class="muted">This is how the welcome message will look in Discord.</p>
        <div data-welcome-preview>${renderDiscordWelcomePreview('June 30, 2026', 'Rafa', server.name || 'Server', 11)}</div>
        <p class="muted tiny preview-note">This is a preview. The actual Discord message can look slightly different depending on device size.</p>
      </article>
    </div>
  `;
}

function renderDiscordWelcomePreview(dateLabel, userName, serverName, memberNumber, blueAvatar = false, customMessage = '', options = {}) {
  const showMember = options.showMember !== false;
  const showAvatar = options.showAvatar !== false;
  const messageLines = String(customMessage || `WELCOME ${userName}\nTO\n${serverName}`).split('\n').filter(Boolean);
  const headline = messageLines[0] || `WELCOME ${userName}`;
  const middle = messageLines[1] || 'TO';
  const bottom = messageLines[2] || serverName;
  return `
    <div class="discord-preview-post">
      <div class="discord-preview-date"><span></span><strong>${escapeHtml(dateLabel)}</strong><span></span></div>
      <div class="discord-preview-message">
        <span class="discord-preview-bot-avatar" data-bot-avatar-small>M</span>
        <div class="discord-preview-content">
          <div class="discord-preview-author"><strong>Meowz</strong><em>APP</em><small>12:11 AM</small></div>
          <p>Welcome <mark>@${escapeHtml(userName)}</mark> to <strong>${escapeHtml(serverName)}</strong>!</p>
          <div class="welcome-card-image">
            ${showMember ? `<div class="welcome-card-member">MEMBER #${formatNumber(memberNumber)}</div>` : ''}
            ${showAvatar ? `<span class="welcome-card-avatar ${blueAvatar ? 'blue' : ''}">${escapeHtml(userName.slice(0, 1).toUpperCase())}</span>` : ''}
            <strong>${escapeHtml(headline.toUpperCase())}</strong>
            <small>${escapeHtml(middle.toUpperCase())}</small>
            <b>${escapeHtml(bottom.toUpperCase())}</b>
          </div>
        </div>
      </div>
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

function formatAccessSource(entry) {
  if (entry.source === 'bot_owner') return 'Bot owner · default access';
  if (entry.source === 'manage_server') return 'Manage Server · default access';
  return 'Manually allowed';
}

function renderAccessAvatar(entry, label) {
  if (entry.avatarUrl) {
    return `<span class="ai-access-user-avatar"><img src="${escapeHtml(entry.avatarUrl)}" alt="" /></span>`;
  }
  return `<span class="ai-access-user-avatar">${escapeHtml((label || 'U').slice(0, 1).toUpperCase())}</span>`;
}

function renderAccessRow(entry, isDefault = false) {
  const label = entry.displayName || entry.username || entry.userId;
  const sub = entry.username && entry.username !== label ? entry.username : entry.userId;
  const source = formatAccessSource(entry);
  const safeUserId = escapeHtml(entry.userId || '');
  const button = isDefault
    ? `<button class="server-row-action danger is-disabled" type="button" disabled aria-disabled="true" title="This user has default access from Discord permissions.">Remove</button>`
    : `<button class="server-row-action danger" type="button" data-remove-ai-user="${safeUserId}" data-remove-ai-label="${escapeHtml(label)}">Remove</button>`;

  return `
    <div class="ai-access-user-row${isDefault ? ' is-default-access' : ''}" data-user-id="${safeUserId}">
      ${renderAccessAvatar(entry, label)}
      <span class="ai-access-user-main">
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(sub || 'Discord user')}</small>
        <em>${escapeHtml(source)}</em>
      </span>
      ${button}
    </div>
  `;
}

function renderAiAccessList(container, payload = {}) {
  if (!container) return;

  const defaultUsers = Array.isArray(payload.defaultUsers) ? payload.defaultUsers : [];
  const users = Array.isArray(payload.users) ? payload.users : (Array.isArray(payload) ? payload : []);

  const defaultHtml = defaultUsers.length
    ? `<div class="ai-access-section"><div class="ai-access-section-heading"><strong class="ai-access-section-title">Default access</strong><span>${defaultUsers.length} user${defaultUsers.length === 1 ? '' : 's'}</span></div>${defaultUsers.map((entry) => renderAccessRow(entry, true)).join('')}</div>`
    : `<div class="settings-empty-state"><strong>No default-access users found.</strong><span>Default access appears here when the bot can read the server owner and Manage Server members.</span></div>`;

  const manualHtml = users.length
    ? `<div class="ai-access-section"><div class="ai-access-section-heading"><strong class="ai-access-section-title">Manually allowed</strong><span>${users.length} user${users.length === 1 ? '' : 's'}</span></div>${users.map((entry) => renderAccessRow(entry, false)).join('')}</div>`
    : `<div class="settings-empty-state"><strong>No manually added users yet.</strong><span>Add a trusted user ID if they do not already have default access.</span></div>`;

  container.innerHTML = `
    <div class="ai-access-note">
      <strong>Default access cannot be removed here</strong>
      <span>The bot owner and users with Manage Server permission can use /edit_image by default. Their Remove buttons stay disabled because that access comes from Discord permissions.</span>
    </div>
    ${defaultHtml}
    ${manualHtml}
  `;
}

function ensureAiConfirmModal() {
  let modal = document.querySelector('[data-ai-confirm-modal]');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.className = 'ai-confirm-backdrop';
  modal.hidden = true;
  modal.setAttribute('data-ai-confirm-modal', '');
  modal.innerHTML = `
    <div class="ai-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="ai-confirm-title">
      <span class="dashboard-card-label">Confirm removal</span>
      <h3 id="ai-confirm-title">Remove manual access?</h3>
      <p data-ai-confirm-text>This user will no longer be manually allowed to use /edit_image.</p>
      <div class="ai-confirm-actions">
        <button class="btn btn-secondary" type="button" data-ai-confirm-cancel>Cancel</button>
        <button class="btn btn-danger" type="button" data-ai-confirm-accept>Remove access</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function confirmAiAccessRemoval(label) {
  const modal = ensureAiConfirmModal();
  const text = modal.querySelector('[data-ai-confirm-text]');
  if (text) text.textContent = `Remove manual AI image access from ${label}?`;
  modal.hidden = false;
  document.body.classList.add('modal-open');

  return new Promise((resolve) => {
    const cleanup = (answer) => {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      modal.querySelector('[data-ai-confirm-cancel]')?.removeEventListener('click', onCancel);
      modal.querySelector('[data-ai-confirm-accept]')?.removeEventListener('click', onAccept);
      modal.removeEventListener('click', onBackdrop);
      window.removeEventListener('keydown', onKeydown);
      resolve(answer);
    };
    const onCancel = () => cleanup(false);
    const onAccept = () => cleanup(true);
    const onBackdrop = (event) => { if (event.target === modal) cleanup(false); };
    const onKeydown = (event) => { if (event.key === 'Escape') cleanup(false); };

    modal.querySelector('[data-ai-confirm-cancel]')?.addEventListener('click', onCancel);
    modal.querySelector('[data-ai-confirm-accept]')?.addEventListener('click', onAccept);
    modal.addEventListener('click', onBackdrop);
    window.addEventListener('keydown', onKeydown);
    setTimeout(() => modal.querySelector('[data-ai-confirm-cancel]')?.focus(), 0);
  });
}

let aiAccessRefreshPromise = null;

async function refreshAiAccess(guildId) {
  const list = document.querySelector('[data-ai-access-list]');
  if (!list) return;
  if (aiAccessRefreshPromise) return aiAccessRefreshPromise;

  aiAccessRefreshPromise = (async () => {
    try {
      const data = await getImageAccess(guildId);
      renderAiAccessList(list, data);
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
    if (!button || button.disabled) return;
    const userId = button.getAttribute('data-remove-ai-user');
    if (!userId) return;

    const label = button.getAttribute('data-remove-ai-label') || userId;
    const confirmed = await confirmAiAccessRemoval(label);
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = 'Removing...';
    try {
      await removeImageAccessUser(guildId, userId);
      await refreshAiAccess(guildId);
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Remove';
      const list = document.querySelector('[data-ai-access-list]');
      if (list) list.insertAdjacentHTML('afterbegin', `<div class="settings-empty-state error"><strong>Could not remove user.</strong><span>${escapeHtml(err.message || 'Try again later.')}</span></div>`);
    }
  });
}


function replaceWelcomeVariables(template, userName, serverName, memberNumber) {
  return String(template || '')
    .replaceAll('{user}', userName)
    .replaceAll('{server}', serverName)
    .replaceAll('{memberCount}', String(memberNumber));
}

function updateWelcomePreview() {
  const page = document.querySelector('[data-welcome-page]');
  if (!page) return;
  const serverName = page.dataset.serverName || 'Server';
  const message = page.querySelector('[data-welcome-message]')?.value || 'WELCOME {user}\nTO\n{server}';
  const showMember = page.querySelector('[data-show-member]')?.checked !== false;
  const showAvatar = page.querySelector('[data-show-avatar]')?.checked !== false;
  const preview = page.querySelector('[data-welcome-preview]');
  const count = page.querySelector('[data-welcome-count]');
  if (count) count.textContent = `${message.length}/200`;
  if (!preview) return;

  const rendered = replaceWelcomeVariables(message, 'Rafa', serverName, 11);
  preview.innerHTML = renderDiscordWelcomePreview('June 30, 2026', 'Rafa', serverName, 11, false, rendered, { showMember, showAvatar });
}

function setWelcomeFormState(settings = {}) {
  const page = document.querySelector('[data-welcome-page]');
  if (!page) return;
  const enabled = settings.welcomeEnabled !== false;
  const status = page.querySelector('[data-welcome-status]');
  if (status) {
    status.textContent = enabled ? 'Enabled' : 'Disabled';
    status.classList.toggle('is-disabled', !enabled);
  }
  const enabledInput = page.querySelector('[data-welcome-enabled]');
  const channelInput = page.querySelector('input[name="welcomeChannelId"]');
  const welcomeMessage = page.querySelector('[data-welcome-message]');
  const leaveMessage = page.querySelector('[data-leave-message]');
  if (enabledInput) enabledInput.checked = enabled;
  if (channelInput && settings.welcomeChannelId) channelInput.value = settings.welcomeChannelId;
  if (welcomeMessage && settings.welcomeMessage) welcomeMessage.value = settings.welcomeMessage;
  if (leaveMessage && settings.leaveMessage) leaveMessage.value = settings.leaveMessage;
  updateWelcomePreview();
}

async function initWelcomeControls(guildId) {
  const page = document.querySelector('[data-welcome-page]');
  if (!page) return;
  const form = page.querySelector('[data-welcome-form]');
  const feedback = page.querySelector('[data-welcome-feedback]');

  try {
    const data = await getWelcomeSettings(guildId);
    setWelcomeFormState(data.settings || data);
    if (feedback) feedback.textContent = '';
  } catch (err) {
    if (feedback) feedback.textContent = err.message || 'Could not load welcome settings.';
    setWelcomeFormState({});
  }

  page.querySelectorAll('input, textarea, select').forEach((control) => {
    control.addEventListener('input', updateWelcomePreview);
    control.addEventListener('change', updateWelcomePreview);
  });

  page.querySelector('[data-welcome-variable]')?.addEventListener('change', (event) => {
    const value = event.target.value;
    const textarea = page.querySelector('[data-welcome-message]');
    if (!value || !textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + value.length;
    event.target.value = '';
    updateWelcomePreview();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = page.querySelector('[data-welcome-save]');
    const previous = button?.textContent || 'Save Changes';
    const payload = {
      welcomeEnabled: page.querySelector('[data-welcome-enabled]')?.checked !== false,
      welcomeChannelId: page.querySelector('input[name="welcomeChannelId"]')?.value.trim() || null,
      welcomeMessage: page.querySelector('[data-welcome-message]')?.value || '',
      leaveMessage: page.querySelector('[data-leave-message]')?.value || '',
      showMemberNumber: page.querySelector('[data-show-member]')?.checked !== false,
      showAvatar: page.querySelector('[data-show-avatar]')?.checked !== false,
    };

    if (button) { button.disabled = true; button.textContent = 'Saving...'; }
    if (feedback) feedback.textContent = '';
    try {
      const data = await saveWelcomeSettings(guildId, payload);
      setWelcomeFormState(data.settings || payload);
      if (feedback) feedback.textContent = 'Welcome settings saved.';
    } catch (err) {
      if (feedback) feedback.textContent = err.message || 'Could not save welcome settings.';
    } finally {
      if (button) { button.disabled = false; button.textContent = previous; }
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

  els.detailContent.innerHTML = renderServerAppShell(server, activeSection, content);
  if (activeSection === 'ai') initAiAccessControls(server.id);
  if (activeSection === 'welcome') initWelcomeControls(server.id);
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
    const data = await getDashboardGuilds(currentViewMode);
    renderDashboard(data);
  } catch (err) {
    renderDashboardError(err.message);
  }
}

export function initDashboard() {
  if (!els.home && !els.detail) return;
  els.ownerPanel?.querySelectorAll('[data-view-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.viewMode === 'owner' ? 'owner' : 'user';
      if (nextMode === currentViewMode) return;
      currentViewMode = nextMode;
      localStorage.setItem(OWNER_VIEW_STORAGE_KEY, currentViewMode);
      if (els.installed) els.installed.innerHTML = '<div class="skeleton-server"><span></span><div><strong></strong><small></small></div></div>';
      if (els.available) els.available.innerHTML = '<div class="skeleton-server"><span></span><div><strong></strong><small></small></div></div>';
      loadDashboardHome();
    });
  });
  const serverRoute = currentServerRoute();
  if (serverRoute) {
    loadServerDetail(serverRoute.id, serverRoute.section);
  } else {
    loadDashboardHome();
  }
}
