const STARBOARD_SECTION = 'starboard';
const draftByGuild = new Map();
const loadedByGuild = new Map();
let renderToken = 0;

function isDemo() {
  return window.location.pathname.startsWith('/demo');
}

function guildIdFromPath() {
  const match = window.location.pathname.match(/\/(?:dashboard\/server|demo\/server)\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function isStarboardHash() {
  return String(window.location.hash || '').toLowerCase() === '#starboard';
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
    enabled: Boolean(input.enabled),
    channelId: input.channelId ? String(input.channelId) : '',
    threshold: Math.min(50, Math.max(1, Math.round(Number(input.threshold) || 3))),
    emoji: String(input.emoji || '⭐').trim().slice(0, 64) || '⭐',
  };
}

function sameSettings(a, b) {
  const left = normalizeSettings(a);
  const right = normalizeSettings(b);
  return left.enabled === right.enabled
    && left.channelId === right.channelId
    && left.threshold === right.threshold
    && left.emoji === right.emoji;
}

function ensureDraft(guildId, original) {
  if (!draftByGuild.has(guildId)) {
    const normalized = normalizeSettings(original);
    draftByGuild.set(guildId, { original: normalized, current: { ...normalized }, dirty: false });
  }
  return draftByGuild.get(guildId);
}

function setDraft(guildId, values) {
  const state = ensureDraft(guildId, values);
  state.current = normalizeSettings(values);
  state.dirty = !sameSettings(state.original, state.current);
  syncSaveBar(guildId);
  return state;
}

function demoPayload() {
  return {
    settings: { enabled: true, channelId: 'demo-starboard', threshold: 3, emoji: '⭐' },
    channels: [
      { id: 'demo-starboard', name: 'starboard', typeName: 'text' },
      { id: 'demo-general', name: 'general', typeName: 'text' },
      { id: 'demo-media', name: 'media', typeName: 'text' },
    ],
  };
}

async function getJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      ...options,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Request failed with ${response.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadStarboard(guildId) {
  if (loadedByGuild.has(guildId)) return loadedByGuild.get(guildId);
  if (isDemo()) {
    const data = demoPayload();
    loadedByGuild.set(guildId, data);
    return data;
  }

  const [settingsResult, serverResult] = await Promise.all([
    getJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/starboard`),
    getJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}`),
  ]);
  const channels = Array.isArray(serverResult?.server?.channels) ? serverResult.server.channels : [];
  const data = { settings: normalizeSettings(settingsResult?.settings), channels };
  loadedByGuild.set(guildId, data);
  return data;
}

function starboardHref() {
  return `${window.location.pathname}#starboard`;
}

function ensureNavigation() {
  const href = starboardHref();
  document.querySelectorAll('.dash-tabs').forEach((tabs) => {
    if (tabs.querySelector('[data-starboard-tab]')) return;
    const link = document.createElement('a');
    link.href = href;
    link.dataset.starboardTab = 'true';
    link.textContent = 'Starboard';
    tabs.append(link);
  });

  document.querySelectorAll('.dash-side-nav').forEach((nav) => {
    if (nav.querySelector('[data-starboard-tab]')) return;
    const link = document.createElement('a');
    link.href = href;
    link.dataset.starboardTab = 'true';
    link.textContent = 'Starboard';
    nav.append(link);
  });

  document.querySelectorAll('.dash-mobile-drawer .dash-drawer-group').forEach((group) => {
    const title = group.querySelector('small')?.textContent?.trim();
    if (title !== 'Dashboard' || group.querySelector('[data-starboard-tab]')) return;
    const link = document.createElement('a');
    link.href = href;
    link.dataset.starboardTab = 'true';
    link.textContent = 'Starboard';
    group.append(link);
  });

  document.querySelectorAll('[data-starboard-tab]').forEach((link) => link.classList.toggle('is-active', isStarboardHash()));
}

function channelOptions(channels, selected) {
  const usable = channels.filter((channel) => {
    const type = String(channel.typeName ?? channel.type ?? '').toLowerCase();
    return !type || type.includes('text') || type === '0' || type.includes('announcement');
  });
  return '<option value="">Choose a channel</option>' + usable.map((channel) => {
    const id = String(channel.id || '');
    const name = String(channel.name || 'channel').replace(/^#\s*/, '');
    return `<option value="${esc(id)}" ${id === String(selected || '') ? 'selected' : ''}>#${esc(name)}</option>`;
  }).join('');
}

function previewMarkup(settings, channels) {
  const channel = channels.find((item) => String(item.id) === String(settings.channelId));
  const channelName = channel?.name ? `#${String(channel.name).replace(/^#\s*/, '')}` : 'No channel selected';
  return `<article class="dash-card starboard-preview-card">
    <span>Preview</span>
    <h2>Starboard post</h2>
    <p>Messages that reach the reaction threshold are reposted by Meowz in the selected channel.</p>
    <div class="starboard-preview-embed">
      <div class="starboard-preview-title"><span>${esc(settings.emoji)}</span><strong>Starboard</strong></div>
      <p>That one message everyone decided deserved a place here.</p>
      <div class="starboard-preview-meta"><span>Author <strong>@member</strong></span><span>Stars <strong>${esc(settings.threshold)}</strong></span></div>
      <small>${esc(channelName)} · Jump to message</small>
    </div>
    <div class="dash-info-list">
      <div class="dash-info-row"><span>Status</span><strong>${settings.enabled ? 'Enabled' : 'Disabled'}</strong></div>
      <div class="dash-info-row"><span>Reaction</span><strong>${esc(settings.emoji)}</strong></div>
      <div class="dash-info-row"><span>Threshold</span><strong>${esc(settings.threshold)} reaction${settings.threshold === 1 ? '' : 's'}</strong></div>
    </div>
  </article>`;
}

function pageMarkup(guildId, data, state) {
  const settings = state.current;
  return `<section class="dash-designer starboard-layout" data-starboard-page data-guild-id="${esc(guildId)}">
    ${isDemo() ? '<div class="dash-note demo-note"><strong>Demo Mode</strong><span>Preview Starboard safely. Real settings cannot be changed here.</span></div>' : ''}
    <form class="dash-card dash-form-card" data-starboard-form>
      <div class="dash-card-head"><div><span>Starboard</span><h2>Highlight the best messages</h2><p>Repost messages that reach a reaction threshold into a dedicated channel.</p></div><b class="status ${settings.enabled ? 'enabled' : 'disabled'}">${settings.enabled ? 'Enabled' : 'Disabled'}</b></div>
      <label class="dash-switch"><input type="checkbox" name="enabled" ${settings.enabled ? 'checked' : ''}><span></span><div><strong>Enable Starboard</strong><small>Watch reactions and repost qualifying messages.</small></div></label>
      <hr>
      <label class="dash-field"><span>Starboard Channel</span><select name="channelId">${channelOptions(data.channels, settings.channelId)}</select><small>Only Discord text channels can be used.</small></label>
      <label class="dash-field"><span>Reaction Emoji</span><input name="emoji" value="${esc(settings.emoji)}" maxlength="64" autocomplete="off" inputmode="text"><small>Unicode or a Discord custom emoji can be used.</small></label>
      <label class="dash-field"><span>Reaction Threshold</span><input name="threshold" type="number" min="1" max="50" step="1" value="${esc(settings.threshold)}"><small>How many matching reactions a message needs before Meowz posts it.</small></label>
      <div class="dash-note"><strong>No duplicate posts</strong><span>Each source message can only be added to Starboard once.</span></div>
    </form>
    <div class="dash-section-stack dash-sticky-column" data-starboard-preview>${previewMarkup(settings, data.channels)}</div>
  </section>`;
}

function readForm(form) {
  return normalizeSettings({
    enabled: form.elements.enabled.checked,
    channelId: form.elements.channelId.value,
    emoji: form.elements.emoji.value,
    threshold: form.elements.threshold.value,
  });
}

function bindPage(guildId, data) {
  const form = document.querySelector('[data-starboard-form]');
  if (!form) return;
  const refresh = () => {
    const state = setDraft(guildId, readForm(form));
    const status = form.querySelector('.status');
    if (status) {
      status.textContent = state.current.enabled ? 'Enabled' : 'Disabled';
      status.classList.toggle('enabled', state.current.enabled);
      status.classList.toggle('disabled', !state.current.enabled);
    }
    const preview = document.querySelector('[data-starboard-preview]');
    if (preview) preview.innerHTML = previewMarkup(state.current, data.channels);
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
}

function existingSaveParts(host) {
  const text = host?.querySelector('[data-global-save-bar] strong + span')?.textContent || '';
  const match = text.match(/(\d+) section/);
  return { count: match ? Number(match[1]) : 0, text };
}

function syncSaveBar(guildId) {
  const state = draftByGuild.get(guildId);
  const host = document.querySelector('[data-server-save-host]');
  if (!host) return;
  const existing = host.querySelector('[data-global-save-bar]');

  if (!state?.dirty) {
    if (existing?.dataset.starboardOwned === 'true') host.innerHTML = '';
    return;
  }

  if (!existing) {
    host.innerHTML = `<div class="dash-save-bar" data-global-save-bar data-starboard-owned="true" data-guild-id="${esc(guildId)}"><div><strong>You have unsaved changes</strong><span>1 section changed: Starboard</span></div><div><button type="button" class="dash-secondary-btn" data-discard-drafts>Discard</button><button type="button" class="dash-save-btn" data-save-drafts>Save Changes</button></div></div>`;
    return;
  }

  if (existing.dataset.starboardOwned !== 'true') {
    const span = existing.querySelector('strong + span');
    if (span && !span.textContent.includes('Starboard')) {
      const { count, text } = existingSaveParts(host);
      const names = text.replace(/^\d+ sections? changed:?\s*/, '').trim();
      span.textContent = `${Math.max(1, count) + 1} sections changed${names ? `: ${names}, Starboard` : ': Starboard'}`;
    }
  }
}

async function saveStarboard(guildId) {
  const state = draftByGuild.get(guildId);
  if (!state?.dirty) return true;
  if (isDemo()) return false;

  const payload = normalizeSettings(state.current);
  if (payload.enabled && !payload.channelId) throw new Error('Choose a Starboard channel before enabling it.');
  const data = await getJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/starboard`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const saved = normalizeSettings(data?.settings || payload);
  state.original = saved;
  state.current = { ...saved };
  state.dirty = false;
  loadedByGuild.set(guildId, { ...(loadedByGuild.get(guildId) || {}), settings: saved });
  syncSaveBar(guildId);
  return true;
}

function discardStarboard(guildId) {
  const state = draftByGuild.get(guildId);
  if (!state?.dirty) return;
  state.current = { ...state.original };
  state.dirty = false;
  syncSaveBar(guildId);
  if (isStarboardHash()) renderStarboard();
}

function renderInlineError(message) {
  const host = isStarboardHash()
    ? document.querySelector('[data-starboard-page]')
    : document.querySelector('[data-server-save-host]');
  if (!host) return;
  let note = host.querySelector('[data-starboard-error]');
  if (!note) {
    note = document.createElement('div');
    note.className = 'dash-note starboard-error-note';
    note.dataset.starboardError = 'true';
    host.prepend(note);
  }
  note.innerHTML = `<strong>Starboard could not be saved</strong><span>${esc(message)}</span>`;
}

async function renderStarboard() {
  if (!isStarboardHash()) return;
  const guildId = guildIdFromPath();
  const host = document.querySelector('[data-server-tab-content]');
  if (!guildId || !host) return;
  const token = ++renderToken;

  ensureNavigation();
  document.querySelectorAll('.dash-tabs a, .dash-side-nav a, [data-starboard-tab]').forEach((link) => {
    if (!link.href?.includes('/server/')) return;
    link.classList.toggle('is-active', link.dataset.starboardTab === 'true');
  });
  document.querySelectorAll('[data-dashboard-active-crumb]').forEach((crumb) => { crumb.textContent = 'Starboard'; crumb.hidden = false; });
  document.querySelectorAll('[data-dashboard-active-separator]').forEach((separator) => { separator.hidden = false; });
  host.dataset.activeSection = STARBOARD_SECTION;
  host.innerHTML = '<article class="dash-card"><span>Starboard</span><h2>Loading Starboard…</h2><p>Fetching the saved reaction settings.</p></article>';

  try {
    const data = await loadStarboard(guildId);
    if (token !== renderToken || !isStarboardHash()) return;
    const state = ensureDraft(guildId, data.settings);
    host.innerHTML = pageMarkup(guildId, data, state);
    document.title = 'Starboard — Meowz';
    bindPage(guildId, data);
    syncSaveBar(guildId);
  } catch (error) {
    if (token !== renderToken) return;
    host.innerHTML = `<article class="dash-card"><span>Starboard</span><h2>Could not load Starboard</h2><p>${esc(error.message || 'Try again later.')}</p><button type="button" class="dash-save-btn" data-starboard-retry>Try Again</button></article>`;
  }
}

function scheduleRender() {
  ensureNavigation();
  if (isStarboardHash()) {
    const host = document.querySelector('[data-server-tab-content]');
    const alreadyRendered = host?.dataset.activeSection === STARBOARD_SECTION && host.querySelector('[data-starboard-page]');
    if (host && !alreadyRendered) setTimeout(renderStarboard, 0);
  }
  const guildId = guildIdFromPath();
  if (guildId) setTimeout(() => syncSaveBar(guildId), 0);
}

document.addEventListener('click', async (event) => {
  const starboardLink = event.target.closest('[data-starboard-tab]');
  if (starboardLink) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!isStarboardHash()) history.pushState(null, '', '#starboard');
    await renderStarboard();
    return;
  }

  if (event.target.closest('[data-starboard-retry]')) {
    const guildId = guildIdFromPath();
    if (guildId) loadedByGuild.delete(guildId);
    renderStarboard();
    return;
  }

  const guildId = guildIdFromPath();
  if (!guildId) return;
  const discard = event.target.closest('[data-discard-drafts]');
  const save = event.target.closest('[data-save-drafts]');
  if (discard) discardStarboard(guildId);
  if (save && draftByGuild.get(guildId)?.dirty) {
    if (isDemo()) {
      renderInlineError('Demo mode is read-only. Log in to save real Starboard settings.');
      return;
    }
    try {
      const ok = await saveStarboard(guildId);
      if (ok && isStarboardHash()) renderStarboard();
    } catch (error) {
      console.error('Starboard save failed:', error);
      renderInlineError(error.message || 'Try again later.');
    }
  }
}, true);

window.addEventListener('hashchange', scheduleRender);
window.addEventListener('popstate', scheduleRender);

const observer = new MutationObserver(scheduleRender);
observer.observe(document.documentElement, { childList: true, subtree: true });
scheduleRender();
