import { getDashboardGuilds, getDashboardServer, getImageAccess, addImageAccessUser, removeImageAccessUser, getLevelingSettings, saveLevelingSettings, getWelcomeSettings, saveWelcomeSettings, getLogSettings, saveLogSettings, getModerationSettings, saveModerationSettings } from './api.js';
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
  ownerModeSwitch: document.querySelector('[data-owner-mode-switch]'),
};

const OWNER_VIEW_KEY = 'meowzDashboardViewMode';

function getDashboardViewMode() {
  return localStorage.getItem(OWNER_VIEW_KEY) === 'owner' ? 'owner' : 'user';
}

function setDashboardViewMode(mode) {
  localStorage.setItem(OWNER_VIEW_KEY, mode === 'owner' ? 'owner' : 'user');
}

function updateOwnerModeButtons(mode) {
  document.querySelectorAll('[data-owner-mode-button]').forEach((button) => {
    const active = button.getAttribute('data-owner-mode-button') === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}


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
    const subtitle = isInstalled
      ? (server.ownerViewOnly ? 'Owner view only' : serverSubtitle(server, 'Meowz installed'))
      : 'You can invite Meowz here';
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
  const mode = data.mode === 'owner' ? 'owner' : 'user';

  if (els.ownerModeSwitch) {
    els.ownerModeSwitch.hidden = !data.isOwner;
    updateOwnerModeButtons(mode);
  }

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
    <div class="settings-page-grid leveling-settings-page" data-leveling-page data-guild-id="${escapeHtml(server.id)}">
      <form class="dashboard-card compact settings-main-card leveling-settings-form" data-leveling-form>
        <span class="dashboard-card-label">Leveling settings</span>
        <h3>Leveling</h3>
        <p class="muted">Configure XP, level-up messages and cooldowns for ${escapeHtml(server.name)}.</p>

        <label class="setting-toggle-row">
          <span>
            <strong>Enable leveling</strong>
            <small>Allow members to earn XP by chatting.</small>
          </span>
          <input type="checkbox" name="enabled" data-leveling-enabled />
        </label>

        <div class="form-grid-two">
          <label>
            <span>XP per message</span>
            <input type="number" name="xpPerMessage" min="1" max="500" step="1" placeholder="15" data-leveling-xp />
          </label>
          <label>
            <span>Cooldown seconds</span>
            <input type="number" name="cooldownSeconds" min="5" max="3600" step="1" placeholder="60" data-leveling-cooldown />
          </label>
        </div>

        <label>
          <span>Level-up channel ID</span>
          <input type="text" name="channelId" inputmode="numeric" autocomplete="off" placeholder="Leave empty to use the current chat channel" data-leveling-channel />
        </label>

        <div class="settings-form-actions">
          <button class="btn btn-primary" type="submit" data-leveling-save>Save settings</button>
          <span class="settings-save-status" data-leveling-status></span>
        </div>
      </form>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Current values</span>
        <h3>Active configuration</h3>
        <div class="settings-list" data-leveling-current>
          <div><span>Status</span><strong>Loading...</strong></div>
          <div><span>Level-up channel</span><strong>Loading...</strong></div>
          <div><span>XP per message</span><strong>Loading...</strong></div>
          <div><span>Cooldown</span><strong>Loading...</strong></div>
        </div>
      </article>

      <article class="dashboard-card compact server-coming-card">
        <span class="dashboard-card-label">Preview</span>
        <h3>What this page controls</h3>
        <div class="coming-grid coming-grid-two">
          <span><strong>XP settings</strong><small>Adjust message XP and cooldowns.</small><em>Active</em></span>
          <span><strong>Level-up messages</strong><small>Choose where level-up messages are sent.</small><em>Active</em></span>
          <span><strong>Level roles</strong><small>Create rewards for reaching specific levels later.</small><em>Coming soon</em></span>
          <span><strong>Leaderboard</strong><small>Ranking tools are still available in Discord.</small><em>Available</em></span>
        </div>
      </article>
    </div>
  `;
}

function renderLevelingCurrent(settings) {
  const current = document.querySelector('[data-leveling-current]');
  if (!current) return;
  current.innerHTML = `
    <div><span>Status</span><strong>${settings.enabled ? 'Enabled' : 'Disabled'}</strong></div>
    <div><span>Level-up channel</span><strong>${settings.channelId ? escapeHtml(settings.channelId) : 'Current chat channel'}</strong></div>
    <div><span>XP per message</span><strong>${escapeHtml(String(settings.xpPerMessage || 15))} XP</strong></div>
    <div><span>Cooldown</span><strong>${escapeHtml(String(settings.cooldownSeconds || 60))} seconds</strong></div>
  `;
}

function populateLevelingForm(settings) {
  const page = document.querySelector('[data-leveling-page]');
  if (!page) return;
  const enabled = page.querySelector('[data-leveling-enabled]');
  const xp = page.querySelector('[data-leveling-xp]');
  const cooldown = page.querySelector('[data-leveling-cooldown]');
  const channel = page.querySelector('[data-leveling-channel]');
  if (enabled) enabled.checked = settings.enabled !== false;
  if (xp) xp.value = String(settings.xpPerMessage || 15);
  if (cooldown) cooldown.value = String(settings.cooldownSeconds || 60);
  if (channel) channel.value = settings.channelId || '';
  renderLevelingCurrent(settings);
}

async function initLevelingControls(guildId) {
  const page = document.querySelector('[data-leveling-page]');
  if (!page) return;
  const form = page.querySelector('[data-leveling-form]');
  const status = page.querySelector('[data-leveling-status]');
  const saveButton = page.querySelector('[data-leveling-save]');

  try {
    const data = await getLevelingSettings(guildId);
    populateLevelingForm(data.settings || {});
  } catch (err) {
    if (status) status.textContent = err.message || 'Could not load settings.';
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      enabled: Boolean(form.elements.enabled?.checked),
      xpPerMessage: Number(form.elements.xpPerMessage?.value || 15),
      cooldownSeconds: Number(form.elements.cooldownSeconds?.value || 60),
      channelId: String(form.elements.channelId?.value || '').trim(),
    };

    if (payload.channelId && !/^\d{15,25}$/.test(payload.channelId)) {
      if (status) status.textContent = 'Invalid channel ID.';
      form.elements.channelId?.focus();
      return;
    }

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
    }
    if (status) status.textContent = '';

    try {
      const data = await saveLevelingSettings(guildId, payload);
      populateLevelingForm(data.settings || payload);
      if (status) status.textContent = 'Saved.';
    } catch (err) {
      if (status) status.textContent = err.message || 'Could not save settings.';
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Save settings';
      }
    }
  });
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
    <div class="settings-page-grid welcome-settings-page" data-welcome-page data-guild-id="${escapeHtml(server.id)}">
      <form class="dashboard-card compact settings-main-card settings-form" data-welcome-form>
        <span class="dashboard-card-label">Welcome messages</span>
        <h3>Member greetings</h3>
        <p class="muted">Configure join and leave messages for ${escapeHtml(server.name)}.</p>

        <label class="setting-toggle-row">
          <span>
            <strong>Enable welcome messages</strong>
            <small>Send a message when someone joins.</small>
          </span>
          <input type="checkbox" name="welcomeEnabled" data-welcome-enabled />
        </label>

        <label class="setting-toggle-row">
          <span>
            <strong>Enable leave messages</strong>
            <small>Send a message when someone leaves.</small>
          </span>
          <input type="checkbox" name="goodbyeEnabled" data-goodbye-enabled />
        </label>

        <div class="form-grid-two">
          <label>
            <span>Welcome channel ID</span>
            <input type="text" name="welcomeChannelId" inputmode="numeric" autocomplete="off" placeholder="Channel ID" data-welcome-channel />
          </label>
          <label>
            <span>Leave channel ID</span>
            <input type="text" name="goodbyeChannelId" inputmode="numeric" autocomplete="off" placeholder="Channel ID" data-goodbye-channel />
          </label>
        </div>

        <label>
          <span>Welcome message</span>
          <textarea name="welcomeMessage" rows="4" maxlength="1000" placeholder="Welcome {user} to {server}." data-welcome-message></textarea>
        </label>

        <label>
          <span>Leave message</span>
          <textarea name="goodbyeMessage" rows="4" maxlength="1000" placeholder="{user} left {server}." data-goodbye-message></textarea>
        </label>

        <div class="settings-form-actions">
          <button class="btn btn-primary" type="submit" data-welcome-save>Save settings</button>
          <span class="settings-save-status" data-welcome-status></span>
        </div>
      </form>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Variables</span>
        <h3>Message placeholders</h3>
        <div class="settings-list">
          <div><span>User mention</span><strong>{user}</strong></div>
          <div><span>Username</span><strong>{username}</strong></div>
          <div><span>Server name</span><strong>{server}</strong></div>
          <div><span>Member count</span><strong>{memberCount}</strong></div>
        </div>
      </article>

      <article class="dashboard-card compact settings-side-card welcome-preview-card">
        <span class="dashboard-card-label">Preview</span>
        <h3>Message preview</h3>
        <p class="muted">Preview how the welcome and leave messages will look before saving.</p>
        <div class="welcome-preview-stack">
          <div class="welcome-preview-message">
            <span>Welcome message</span>
            <strong data-welcome-preview>Loading preview...</strong>
          </div>
          <div class="welcome-preview-message is-muted">
            <span>Leave message</span>
            <strong data-goodbye-preview>Loading preview...</strong>
          </div>
        </div>
      </article>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Current values</span>
        <h3>Active configuration</h3>
        <div class="settings-list" data-welcome-current>
          <div><span>Status</span><strong>Loading...</strong></div>
          <div><span>Welcome channel</span><strong>Loading...</strong></div>
          <div><span>Leave channel</span><strong>Loading...</strong></div>
        </div>
      </article>
    </div>
  `;
}

function formatWelcomePreview(template, server, fallback) {
  const raw = String(template || '').trim() || fallback;
  return raw
    .replaceAll('{user}', '@Rafa')
    .replaceAll('{username}', 'Rafa')
    .replaceAll('{server}', server?.name || 'Meowz Server')
    .replaceAll('{memberCount}', typeof server?.memberCount === 'number' ? formatNumber(server.memberCount + 1) : '128');
}

function updateWelcomePreview(server) {
  const page = document.querySelector('[data-welcome-page]');
  if (!page) return;
  const welcomePreview = page.querySelector('[data-welcome-preview]');
  const goodbyePreview = page.querySelector('[data-goodbye-preview]');
  const welcomeText = page.querySelector('[data-welcome-message]')?.value;
  const goodbyeText = page.querySelector('[data-goodbye-message]')?.value;
  if (welcomePreview) {
    welcomePreview.textContent = formatWelcomePreview(welcomeText, server, 'Welcome {user} to {server}.');
  }
  if (goodbyePreview) {
    goodbyePreview.textContent = formatWelcomePreview(goodbyeText, server, '{username} left {server}.');
  }
}

function populateWelcomeForm(settings, server = null) {
  const page = document.querySelector('[data-welcome-page]');
  if (!page) return;
  page.querySelector('[data-welcome-enabled]').checked = settings.welcomeEnabled !== false;
  page.querySelector('[data-goodbye-enabled]').checked = settings.goodbyeEnabled !== false;
  page.querySelector('[data-welcome-channel]').value = settings.welcomeChannelId || '';
  page.querySelector('[data-goodbye-channel]').value = settings.goodbyeChannelId || '';
  page.querySelector('[data-welcome-message]').value = settings.welcomeMessage || '';
  page.querySelector('[data-goodbye-message]').value = settings.goodbyeMessage || '';
  renderWelcomeCurrent(settings);
  updateWelcomePreview(server);
}

function renderWelcomeCurrent(settings) {
  const current = document.querySelector('[data-welcome-current]');
  if (!current) return;
  current.innerHTML = `
    <div><span>Welcome status</span><strong>${settings.welcomeEnabled !== false ? 'Enabled' : 'Disabled'}</strong></div>
    <div><span>Leave status</span><strong>${settings.goodbyeEnabled !== false ? 'Enabled' : 'Disabled'}</strong></div>
    <div><span>Welcome channel</span><strong>${settings.welcomeChannelId ? escapeHtml(settings.welcomeChannelId) : 'Not configured'}</strong></div>
    <div><span>Leave channel</span><strong>${settings.goodbyeChannelId ? escapeHtml(settings.goodbyeChannelId) : 'Not configured'}</strong></div>
  `;
}

async function initWelcomeControls(guildId, server = null) {
  const page = document.querySelector('[data-welcome-page]');
  if (!page) return;
  const form = page.querySelector('[data-welcome-form]');
  const status = page.querySelector('[data-welcome-status]');
  const saveButton = page.querySelector('[data-welcome-save]');

  page.querySelectorAll('[data-welcome-message], [data-goodbye-message]').forEach((input) => {
    input.addEventListener('input', () => updateWelcomePreview(server));
  });
  updateWelcomePreview(server);

  try {
    const data = await getWelcomeSettings(guildId);
    populateWelcomeForm(data.settings || {}, server);
  } catch (err) {
    if (status) status.textContent = err.message || 'Could not load settings.';
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      welcomeEnabled: Boolean(form.elements.welcomeEnabled?.checked),
      goodbyeEnabled: Boolean(form.elements.goodbyeEnabled?.checked),
      welcomeChannelId: String(form.elements.welcomeChannelId?.value || '').trim(),
      goodbyeChannelId: String(form.elements.goodbyeChannelId?.value || '').trim(),
      welcomeMessage: String(form.elements.welcomeMessage?.value || '').trim(),
      goodbyeMessage: String(form.elements.goodbyeMessage?.value || '').trim(),
    };

    for (const key of ['welcomeChannelId', 'goodbyeChannelId']) {
      if (payload[key] && !/^\d{15,25}$/.test(payload[key])) {
        if (status) status.textContent = 'Invalid channel ID.';
        return;
      }
    }

    if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Saving...'; }
    if (status) status.textContent = '';
    try {
      const data = await saveWelcomeSettings(guildId, payload);
      populateWelcomeForm(data.settings || payload, server);
      if (status) status.textContent = 'Saved.';
    } catch (err) {
      if (status) status.textContent = err.message || 'Could not save settings.';
    } finally {
      if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Save settings'; }
    }
  });
}

function renderLogsPage(server) {
  return `
    <div class="settings-page-grid logs-settings-page" data-logs-page data-guild-id="${escapeHtml(server.id)}">
      <form class="dashboard-card compact settings-main-card settings-form" data-logs-form>
        <span class="dashboard-card-label">Logs</span>
        <h3>Server activity</h3>
        <p class="muted">Configure log channels and event tracking for ${escapeHtml(server.name)}.</p>

        <label class="setting-toggle-row">
          <span><strong>Enable logs</strong><small>Send selected server events to a log channel.</small></span>
          <input type="checkbox" name="enabled" data-logs-enabled />
        </label>

        <label>
          <span>Log channel ID</span>
          <input type="text" name="channelId" inputmode="numeric" autocomplete="off" placeholder="Channel ID" data-logs-channel />
        </label>

        <div class="settings-toggle-stack">
          <label class="setting-toggle-row"><span><strong>Message events</strong><small>Track message edits and deletes later.</small></span><input type="checkbox" name="messageEvents" data-logs-message /></label>
          <label class="setting-toggle-row"><span><strong>Member events</strong><small>Track joins, leaves and member updates.</small></span><input type="checkbox" name="memberEvents" data-logs-member /></label>
          <label class="setting-toggle-row"><span><strong>Moderation events</strong><small>Track moderation actions and warnings.</small></span><input type="checkbox" name="moderationEvents" data-logs-moderation /></label>
        </div>

        <div class="settings-form-actions">
          <button class="btn btn-primary" type="submit" data-logs-save>Save settings</button>
          <span class="settings-save-status" data-logs-status></span>
        </div>
      </form>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Current values</span>
        <h3>Active configuration</h3>
        <div class="settings-list" data-logs-current>
          <div><span>Status</span><strong>Loading...</strong></div>
          <div><span>Log channel</span><strong>Loading...</strong></div>
        </div>
      </article>
    </div>
  `;
}

function populateLogsForm(settings) {
  const page = document.querySelector('[data-logs-page]');
  if (!page) return;
  page.querySelector('[data-logs-enabled]').checked = settings.enabled === true;
  page.querySelector('[data-logs-channel]').value = settings.channelId || '';
  page.querySelector('[data-logs-message]').checked = settings.messageEvents !== false;
  page.querySelector('[data-logs-member]').checked = settings.memberEvents !== false;
  page.querySelector('[data-logs-moderation]').checked = settings.moderationEvents !== false;
  renderLogsCurrent(settings);
}

function renderLogsCurrent(settings) {
  const current = document.querySelector('[data-logs-current]');
  if (!current) return;
  current.innerHTML = `
    <div><span>Status</span><strong>${settings.enabled === true ? 'Enabled' : 'Disabled'}</strong></div>
    <div><span>Log channel</span><strong>${settings.channelId ? escapeHtml(settings.channelId) : 'Not configured'}</strong></div>
    <div><span>Message events</span><strong>${settings.messageEvents !== false ? 'Enabled' : 'Disabled'}</strong></div>
    <div><span>Member events</span><strong>${settings.memberEvents !== false ? 'Enabled' : 'Disabled'}</strong></div>
    <div><span>Moderation events</span><strong>${settings.moderationEvents !== false ? 'Enabled' : 'Disabled'}</strong></div>
  `;
}

async function initLogsControls(guildId) {
  const page = document.querySelector('[data-logs-page]');
  if (!page) return;
  const form = page.querySelector('[data-logs-form]');
  const status = page.querySelector('[data-logs-status]');
  const saveButton = page.querySelector('[data-logs-save]');

  try {
    const data = await getLogSettings(guildId);
    populateLogsForm(data.settings || {});
  } catch (err) {
    if (status) status.textContent = err.message || 'Could not load settings.';
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      enabled: Boolean(form.elements.enabled?.checked),
      channelId: String(form.elements.channelId?.value || '').trim(),
      messageEvents: Boolean(form.elements.messageEvents?.checked),
      memberEvents: Boolean(form.elements.memberEvents?.checked),
      moderationEvents: Boolean(form.elements.moderationEvents?.checked),
    };
    if (payload.channelId && !/^\d{15,25}$/.test(payload.channelId)) {
      if (status) status.textContent = 'Invalid channel ID.';
      return;
    }
    if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Saving...'; }
    if (status) status.textContent = '';
    try {
      const data = await saveLogSettings(guildId, payload);
      populateLogsForm(data.settings || payload);
      if (status) status.textContent = 'Saved.';
    } catch (err) {
      if (status) status.textContent = err.message || 'Could not save settings.';
    } finally {
      if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Save settings'; }
    }
  });
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

function renderModerationPage(server) {
  return `
    <div class="settings-page-grid moderation-settings-page" data-moderation-page data-guild-id="${escapeHtml(server.id)}">
      <form class="dashboard-card compact settings-main-card settings-form" data-moderation-form>
        <span class="dashboard-card-label">Moderation tools</span>
        <h3>Server moderation</h3>
        <p class="muted">Configure warnings, automod and moderation controls for ${escapeHtml(server.name)}.</p>

        <label class="setting-toggle-row">
          <span><strong>Enable moderation tools</strong><small>Allow Meowz moderation settings for this server.</small></span>
          <input type="checkbox" name="enabled" data-moderation-enabled />
        </label>

        <label>
          <span>Moderation log channel ID</span>
          <input type="text" name="modLogChannelId" inputmode="numeric" autocomplete="off" placeholder="Channel ID" data-moderation-channel />
        </label>

        <div class="settings-toggle-stack">
          <label class="setting-toggle-row"><span><strong>Warnings</strong><small>Enable warning-based moderation controls.</small></span><input type="checkbox" name="warningsEnabled" data-moderation-warnings /></label>
          <label class="setting-toggle-row"><span><strong>Auto moderation</strong><small>Enable automatic filters when configured.</small></span><input type="checkbox" name="automodEnabled" data-moderation-automod /></label>
        </div>

        <label>
          <span>Blocked words</span>
          <textarea name="blockedWords" rows="5" maxlength="2000" placeholder="One word or phrase per line" data-moderation-blocked></textarea>
        </label>

        <div class="settings-form-actions">
          <button class="btn btn-primary" type="submit" data-moderation-save>Save settings</button>
          <span class="settings-save-status" data-moderation-status></span>
        </div>
      </form>

      <article class="dashboard-card compact settings-side-card">
        <span class="dashboard-card-label">Current values</span>
        <h3>Active configuration</h3>
        <div class="settings-list" data-moderation-current>
          <div><span>Status</span><strong>Loading...</strong></div>
          <div><span>Mod log channel</span><strong>Loading...</strong></div>
        </div>
      </article>
    </div>
  `;
}

function populateModerationForm(settings) {
  const page = document.querySelector('[data-moderation-page]');
  if (!page) return;
  page.querySelector('[data-moderation-enabled]').checked = settings.enabled === true;
  page.querySelector('[data-moderation-channel]').value = settings.modLogChannelId || '';
  page.querySelector('[data-moderation-warnings]').checked = settings.warningsEnabled !== false;
  page.querySelector('[data-moderation-automod]').checked = settings.automodEnabled === true;
  page.querySelector('[data-moderation-blocked]').value = settings.blockedWords || '';
  renderModerationCurrent(settings);
}

function renderModerationCurrent(settings) {
  const current = document.querySelector('[data-moderation-current]');
  if (!current) return;
  const blockedCount = String(settings.blockedWords || '').split(/\n|,/).map((v) => v.trim()).filter(Boolean).length;
  current.innerHTML = `
    <div><span>Status</span><strong>${settings.enabled === true ? 'Enabled' : 'Disabled'}</strong></div>
    <div><span>Warnings</span><strong>${settings.warningsEnabled !== false ? 'Enabled' : 'Disabled'}</strong></div>
    <div><span>Automod</span><strong>${settings.automodEnabled === true ? 'Enabled' : 'Disabled'}</strong></div>
    <div><span>Mod log channel</span><strong>${settings.modLogChannelId ? escapeHtml(settings.modLogChannelId) : 'Not configured'}</strong></div>
    <div><span>Blocked words</span><strong>${blockedCount}</strong></div>
  `;
}

async function initModerationControls(guildId) {
  const page = document.querySelector('[data-moderation-page]');
  if (!page) return;
  const form = page.querySelector('[data-moderation-form]');
  const status = page.querySelector('[data-moderation-status]');
  const saveButton = page.querySelector('[data-moderation-save]');

  try {
    const data = await getModerationSettings(guildId);
    populateModerationForm(data.settings || {});
  } catch (err) {
    if (status) status.textContent = err.message || 'Could not load settings.';
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      enabled: Boolean(form.elements.enabled?.checked),
      warningsEnabled: Boolean(form.elements.warningsEnabled?.checked),
      automodEnabled: Boolean(form.elements.automodEnabled?.checked),
      modLogChannelId: String(form.elements.modLogChannelId?.value || '').trim(),
      blockedWords: String(form.elements.blockedWords?.value || '').trim(),
    };
    if (payload.modLogChannelId && !/^\d{15,25}$/.test(payload.modLogChannelId)) {
      if (status) status.textContent = 'Invalid channel ID.';
      return;
    }
    if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Saving...'; }
    if (status) status.textContent = '';
    try {
      const data = await saveModerationSettings(guildId, payload);
      populateModerationForm(data.settings || payload);
      if (status) status.textContent = 'Saved.';
    } catch (err) {
      if (status) status.textContent = err.message || 'Could not save settings.';
    } finally {
      if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Save settings'; }
    }
  });
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
  if (activeSection === 'leveling') initLevelingControls(server.id);
  if (activeSection === 'welcome') initWelcomeControls(server.id, server);
  if (activeSection === 'logs') initLogsControls(server.id);
  if (activeSection === 'moderation') initModerationControls(server.id);
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
    const data = await getDashboardGuilds(getDashboardViewMode());
    renderDashboard(data);
  } catch (err) {
    renderDashboardError(err.message);
  }
}

export function initDashboard() {
  if (!els.home && !els.detail) return;
  document.querySelectorAll('[data-owner-mode-button]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.getAttribute('data-owner-mode-button') === 'owner' ? 'owner' : 'user';
      setDashboardViewMode(mode);
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
