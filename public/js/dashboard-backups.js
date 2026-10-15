const BACKUPS_SECTION = 'backups';
const loadedByGuild = new Map();
const draftByGuild = new Map();
let renderToken = 0;

function isDemo() {
  return window.location.pathname.startsWith('/demo');
}

function guildIdFromPath() {
  const match = window.location.pathname.match(/\/(?:dashboard\/server|demo\/server)\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function isBackupsHash() {
  return String(window.location.hash || '').toLowerCase() === '#backups';
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeSettings(input = {}) {
  return {
    configured: Boolean(input.configured || input.channelId),
    enabled: Boolean(input.enabled),
    channelId: input.channelId ? String(input.channelId) : '',
    lastSentAt: input.lastSentAt || null,
    nextDueAt: input.nextDueAt || null,
    intervalDays: Number(input.intervalDays) || 7,
  };
}

function editable(settings) {
  return {
    enabled: Boolean(settings?.enabled),
    channelId: settings?.channelId ? String(settings.channelId) : '',
  };
}

function sameEditable(a, b) {
  const left = editable(a);
  const right = editable(b);
  return left.enabled === right.enabled && left.channelId === right.channelId;
}

function ensureDraft(guildId, original) {
  if (!draftByGuild.has(guildId)) {
    const base = normalizeSettings(original);
    draftByGuild.set(guildId, {
      original: { ...base },
      current: { ...base },
      dirty: false,
    });
  }
  return draftByGuild.get(guildId);
}

function setDraft(guildId, values) {
  const state = ensureDraft(guildId, values);
  state.current = { ...state.current, ...editable(values) };
  state.dirty = !sameEditable(state.original, state.current);
  syncSaveBar(guildId);
  return state;
}

function demoPayload() {
  const now = Date.now();
  return {
    settings: {
      configured: true,
      enabled: true,
      channelId: 'demo-backups',
      lastSentAt: new Date(now - (2 * 24 * 60 * 60 * 1000)).toISOString(),
      nextDueAt: new Date(now + (5 * 24 * 60 * 60 * 1000)).toISOString(),
      intervalDays: 7,
    },
    channels: [
      { id: 'demo-backups', name: 'database-backups', typeName: 'text' },
      { id: 'demo-logs', name: 'bot-logs', typeName: 'text' },
      { id: 'demo-admin', name: 'admin', typeName: 'text' },
    ],
  };
}

async function getJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 10000));
  const { timeoutMs, ...fetchOptions } = options;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...(fetchOptions.headers || {}) },
      ...fetchOptions,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Request failed with ${response.status}`);
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Request timed out. Try again.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadBackups(guildId) {
  if (loadedByGuild.has(guildId)) return loadedByGuild.get(guildId);
  if (isDemo()) {
    const data = demoPayload();
    loadedByGuild.set(guildId, data);
    return data;
  }

  const [settingsResult, serverResult] = await Promise.all([
    getJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/backups`),
    getJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}`),
  ]);
  const channels = Array.isArray(serverResult?.server?.channels) ? serverResult.server.channels : [];
  const data = { settings: normalizeSettings(settingsResult?.settings), channels };
  loadedByGuild.set(guildId, data);
  return data;
}

function backupsHref() {
  return `${window.location.pathname}#backups`;
}

function ensureNavigation() {
  const href = backupsHref();
  document.querySelectorAll('.dash-tabs').forEach((tabs) => {
    if (tabs.querySelector('[data-backups-tab]')) return;
    const link = document.createElement('a');
    link.href = href;
    link.dataset.backupsTab = 'true';
    link.textContent = 'Backups';
    tabs.append(link);
  });

  document.querySelectorAll('.dash-side-nav').forEach((nav) => {
    if (nav.querySelector('[data-backups-tab]')) return;
    const link = document.createElement('a');
    link.href = href;
    link.dataset.backupsTab = 'true';
    link.textContent = 'Backups';
    nav.append(link);
  });

  document.querySelectorAll('.dash-mobile-drawer .dash-drawer-group').forEach((group) => {
    if (group.querySelector('small')?.textContent?.trim() !== 'Dashboard' || group.querySelector('[data-backups-tab]')) return;
    const link = document.createElement('a');
    link.href = href;
    link.dataset.backupsTab = 'true';
    link.textContent = 'Backups';
    group.append(link);
  });

  document.querySelectorAll('[data-backups-tab]').forEach((link) => link.classList.toggle('is-active', isBackupsHash()));
}

function textChannels(channels) {
  return channels.filter((channel) => {
    const type = String(channel.typeName ?? channel.type ?? '').toLowerCase();
    return !type || type === '0' || type.includes('text');
  });
}

function channelOptions(channels, selected) {
  return '<option value="">Choose a channel</option>' + textChannels(channels).map((channel) => {
    const id = String(channel.id || '');
    const name = String(channel.name || 'channel').replace(/^#\s*/, '');
    return `<option value="${esc(id)}" ${id === String(selected || '') ? 'selected' : ''}>#${esc(name)}</option>`;
  }).join('');
}

function formatDate(value, fallback = 'Not yet') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function relativeDate(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const units = [
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];
  for (const [unit, size] of units) {
    if (abs >= size || unit === 'minute') {
      const amount = Math.round(diff / size);
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(amount, unit);
    }
  }
  return 'soon';
}

function statusPanel(settings, channels) {
  const channel = channels.find((item) => String(item.id) === String(settings.channelId));
  const channelName = channel?.name ? `#${String(channel.name).replace(/^#\s*/, '')}` : 'Not configured';
  return `<article class="dash-card backup-status-card">
    <span>Backup Status</span>
    <div class="backup-status-head"><div><h2>${settings.enabled ? 'Scheduled backups active' : 'Scheduled backups paused'}</h2><p>Meowz exports the PostgreSQL tables into a JSON backup file and sends it to Discord.</p></div><b class="status ${settings.enabled ? 'enabled' : 'disabled'}">${settings.enabled ? 'Enabled' : 'Disabled'}</b></div>
    <div class="backup-timeline">
      <div><small>Destination</small><strong>${esc(channelName)}</strong></div>
      <div><small>Last backup</small><strong>${esc(formatDate(settings.lastSentAt))}</strong><span>${settings.lastSentAt ? esc(relativeDate(settings.lastSentAt)) : 'No backup has been sent yet.'}</span></div>
      <div><small>Next scheduled</small><strong>${settings.enabled ? esc(formatDate(settings.nextDueAt, 'Due now')) : 'Paused'}</strong><span>${settings.enabled ? esc(relativeDate(settings.nextDueAt)) : 'Enable scheduled backups to resume.'}</span></div>
      <div><small>Schedule</small><strong>Every ${esc(settings.intervalDays)} days</strong><span>The scheduler checks hourly.</span></div>
    </div>
    <button type="button" class="dash-save-btn backup-run-button" data-run-backup ${settings.channelId ? '' : 'disabled'}>Run Backup Now</button>
    <small class="preview-note">Manual backups update the last-backup time and restart the weekly schedule.</small>
  </article>`;
}

function pageMarkup(guildId, data, state) {
  const settings = state.current;
  return `<section class="dash-designer backups-layout" data-backups-page data-guild-id="${esc(guildId)}">
    ${isDemo() ? '<div class="dash-note demo-note"><strong>Demo Mode</strong><span>This is fake backup data. Demo mode never creates or sends database exports.</span></div>' : ''}
    <form class="dash-card dash-form-card" data-backups-form>
      <div class="dash-card-head"><div><span>Database Backups</span><h2>Weekly backup delivery</h2><p>Keep a recent export of Meowz database tables in a private Discord channel.</p></div><b class="status ${settings.enabled ? 'enabled' : 'disabled'}">${settings.enabled ? 'Enabled' : 'Disabled'}</b></div>
      <label class="dash-switch"><input type="checkbox" name="enabled" ${settings.enabled ? 'checked' : ''}><span></span><div><strong>Enable scheduled backups</strong><small>Send a new backup when the previous one is at least seven days old.</small></div></label>
      <hr>
      <label class="dash-field"><span>Backup Channel</span><select name="channelId">${channelOptions(data.channels, settings.channelId)}</select><small>Use a private text channel that Meowz can view and send files in.</small></label>
      <div class="dash-note"><strong>What gets backed up?</strong><span>The bot exports its PostgreSQL tables to JSON. Backups are sent only to the channel selected above.</span></div>
      <div class="dash-note backup-security-note"><strong>Keep this channel private</strong><span>Database exports can contain server configuration and bot data. Restrict channel access to trusted administrators.</span></div>
    </form>
    <div class="dash-section-stack dash-sticky-column" data-backups-status>${statusPanel(settings, data.channels)}</div>
  </section>`;
}

function readForm(form) {
  return {
    enabled: form.elements.enabled.checked,
    channelId: form.elements.channelId.value,
  };
}

function bindPage(guildId, data) {
  const form = document.querySelector('[data-backups-form]');
  if (!form) return;
  const refresh = () => {
    const state = setDraft(guildId, readForm(form));
    const status = form.querySelector('.status');
    if (status) {
      status.textContent = state.current.enabled ? 'Enabled' : 'Disabled';
      status.classList.toggle('enabled', state.current.enabled);
      status.classList.toggle('disabled', !state.current.enabled);
    }
    const statusHost = document.querySelector('[data-backups-status]');
    if (statusHost) statusHost.innerHTML = statusPanel(state.current, data.channels);
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
}

function parseBarNames(span) {
  const text = String(span?.textContent || '');
  const [, namesText = ''] = text.split(':');
  return namesText.split(',').map((item) => item.trim()).filter(Boolean);
}

function writeBarSummary(bar, names) {
  const span = bar.querySelector('strong + span');
  if (!span) return;
  const unique = [...new Set(names.filter(Boolean))];
  span.textContent = `${unique.length} section${unique.length === 1 ? '' : 's'} changed${unique.length ? `: ${unique.join(', ')}` : ''}`;
}

function syncSaveBar(guildId) {
  const state = draftByGuild.get(guildId);
  const host = document.querySelector('[data-server-save-host]');
  if (!host) return;
  let bar = host.querySelector('[data-global-save-bar]');

  if (state?.dirty) {
    if (!bar) {
      host.innerHTML = `<div class="dash-save-bar" data-global-save-bar data-backup-owned="true" data-guild-id="${esc(guildId)}"><div><strong>You have unsaved changes</strong><span>1 section changed: Backups</span></div><div><button type="button" class="dash-secondary-btn" data-discard-drafts>Discard</button><button type="button" class="dash-save-btn" data-save-drafts>Save Changes</button></div></div>`;
      return;
    }
    const names = parseBarNames(bar.querySelector('strong + span'));
    if (!names.includes('Backups')) names.push('Backups');
    writeBarSummary(bar, names);
    return;
  }

  if (!bar) return;
  const names = parseBarNames(bar.querySelector('strong + span')).filter((name) => name !== 'Backups');
  if (!names.length && bar.dataset.backupOwned === 'true') {
    host.innerHTML = '';
    return;
  }
  if (bar.dataset.backupOwned === 'true') delete bar.dataset.backupOwned;
  if (names.includes('Starboard')) bar.dataset.starboardOwned = 'true';
  if (names.length) writeBarSummary(bar, names);
}

async function saveBackups(guildId) {
  const state = draftByGuild.get(guildId);
  if (!state?.dirty) return true;
  if (isDemo()) return false;

  const payload = editable(state.current);
  if (payload.enabled && !payload.channelId) throw new Error('Choose a backup channel before enabling scheduled backups.');
  const data = await getJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/backups`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const saved = normalizeSettings(data?.settings || payload);
  state.original = { ...saved };
  state.current = { ...saved };
  state.dirty = false;
  const cached = loadedByGuild.get(guildId) || {};
  loadedByGuild.set(guildId, { ...cached, settings: saved });
  syncSaveBar(guildId);
  if (isBackupsHash()) rerenderCurrent(guildId);
  return true;
}

function discardBackups(guildId) {
  const state = draftByGuild.get(guildId);
  if (!state?.dirty) return;
  state.current = { ...state.original };
  state.dirty = false;
  syncSaveBar(guildId);
  if (isBackupsHash()) rerenderCurrent(guildId);
}

function showInline(message, type = 'info') {
  const page = document.querySelector('[data-backups-page]');
  if (!page) return;
  let note = page.querySelector('[data-backups-feedback]');
  if (!note) {
    note = document.createElement('div');
    note.dataset.backupsFeedback = 'true';
    note.className = 'dash-note backup-feedback';
    page.prepend(note);
  }
  note.classList.toggle('is-error', type === 'error');
  note.innerHTML = `<strong>${type === 'error' ? 'Backup action failed' : 'Backup status'}</strong><span>${esc(message)}</span>`;
}

function rerenderCurrent(guildId) {
  const host = document.querySelector('[data-server-tab-content]');
  const data = loadedByGuild.get(guildId);
  const state = draftByGuild.get(guildId);
  if (!host || !data || !state || !isBackupsHash()) return;
  host.innerHTML = pageMarkup(guildId, data, state);
  bindPage(guildId, data);
  syncSaveBar(guildId);
}

async function runBackup(guildId, button) {
  if (isDemo()) {
    showInline('Demo mode is read-only. No database export was created.');
    return;
  }

  const state = draftByGuild.get(guildId);
  const originalText = button?.textContent || 'Run Backup Now';
  if (button) {
    button.disabled = true;
    button.textContent = state?.dirty ? 'Saving & Running…' : 'Running…';
  }

  try {
    if (state?.dirty) await saveBackups(guildId);
    const result = await getJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/backups/run`, {
      method: 'POST',
      body: JSON.stringify({}),
      timeoutMs: 30000,
    });
    const saved = normalizeSettings(result?.settings || {});
    const cached = loadedByGuild.get(guildId) || {};
    loadedByGuild.set(guildId, { ...cached, settings: saved });
    const draft = ensureDraft(guildId, saved);
    draft.original = { ...saved };
    draft.current = { ...saved };
    draft.dirty = false;
    rerenderCurrent(guildId);
    showInline('Backup sent successfully. The weekly schedule now counts from this backup.');
  } catch (err) {
    showInline(err.message || 'Could not run backup.', 'error');
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function renderBackups() {
  if (!isBackupsHash()) return;
  const guildId = guildIdFromPath();
  const host = document.querySelector('[data-server-tab-content]');
  if (!guildId || !host) return;
  const token = ++renderToken;

  ensureNavigation();
  document.querySelectorAll('.dash-tabs a, .dash-side-nav a, [data-starboard-tab], [data-backups-tab]').forEach((link) => {
    if (!link.href?.includes('/server/')) return;
    link.classList.toggle('is-active', link.dataset.backupsTab === 'true');
  });
  document.querySelectorAll('[data-dashboard-active-crumb]').forEach((crumb) => { crumb.textContent = 'Backups'; crumb.hidden = false; });
  document.querySelectorAll('[data-dashboard-active-separator]').forEach((separator) => { separator.hidden = false; });
  host.dataset.activeSection = BACKUPS_SECTION;
  host.innerHTML = '<article class="dash-card"><span>Backups</span><h2>Loading backups…</h2><p>Fetching the saved backup schedule and destination.</p></article>';

  try {
    const data = await loadBackups(guildId);
    if (token !== renderToken || !isBackupsHash()) return;
    const state = ensureDraft(guildId, data.settings);
    host.innerHTML = pageMarkup(guildId, data, state);
    document.title = 'Backups — Meowz';
    bindPage(guildId, data);
    syncSaveBar(guildId);
  } catch (err) {
    if (token !== renderToken) return;
    host.innerHTML = `<article class="dash-card"><span>Backups</span><h2>Could not load backups</h2><p>${esc(err.message || 'Try again later.')}</p><button type="button" class="dash-save-btn" data-backups-retry>Try Again</button></article>`;
  }
}

function scheduleRender() {
  ensureNavigation();
  if (isBackupsHash()) {
    const host = document.querySelector('[data-server-tab-content]');
    const rendered = host?.dataset.activeSection === BACKUPS_SECTION && host.querySelector('[data-backups-page]');
    if (host && !rendered) setTimeout(renderBackups, 0);
  }
  const guildId = guildIdFromPath();
  if (guildId) setTimeout(() => syncSaveBar(guildId), 0);
}

document.addEventListener('click', async (event) => {
  const link = event.target.closest('[data-backups-tab]');
  if (link) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!isBackupsHash()) history.pushState(null, '', '#backups');
    await renderBackups();
    return;
  }

  if (event.target.closest('[data-backups-retry]')) {
    const guildId = guildIdFromPath();
    if (guildId) loadedByGuild.delete(guildId);
    await renderBackups();
    return;
  }

  const runButton = event.target.closest('[data-run-backup]');
  if (runButton) {
    const guildId = guildIdFromPath();
    if (guildId) await runBackup(guildId, runButton);
    return;
  }

  if (event.target.closest('[data-save-drafts]')) {
    const guildId = guildIdFromPath();
    if (!guildId || !draftByGuild.get(guildId)?.dirty) return;
    try {
      if (isDemo()) {
        showInline('Demo mode is read-only. Backup settings were not saved.');
        return;
      }
      await saveBackups(guildId);
    } catch (err) {
      showInline(err.message || 'Could not save backup settings.', 'error');
      setTimeout(() => syncSaveBar(guildId), 0);
    }
    return;
  }

  if (event.target.closest('[data-discard-drafts]')) {
    const guildId = guildIdFromPath();
    if (guildId) discardBackups(guildId);
  }
});

window.addEventListener('hashchange', scheduleRender);
window.addEventListener('popstate', scheduleRender);

const observer = new MutationObserver(() => scheduleRender());
observer.observe(document.documentElement, { childList: true, subtree: true });
scheduleRender();
