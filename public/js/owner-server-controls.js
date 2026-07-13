import { showStatusToast } from './toast.js';

const OWNER_VIEW_STORAGE_KEY = 'meowzDashboardViewMode';
const OWNER_GUILD_CACHE_MS = 15_000;
let ownerGuildCache = { at: 0, data: null };
let syncFrame = 0;
let syncing = false;
let syncPending = false;
let removedGuildId = null;
let selectedGuild = null;
let selectedSource = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function currentGuildId() {
  const match = window.location.pathname.match(/^\/dashboard\/server\/([^/]+)(?:\/[^/]+)?\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function guildIdFromServerLink(link) {
  if (!link?.href) return null;
  try {
    const url = new URL(link.href, window.location.origin);
    const match = url.pathname.match(/^\/dashboard\/server\/([^/]+)(?:\/[^/]+)?\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function isOwnerView() {
  return localStorage.getItem(OWNER_VIEW_STORAGE_KEY) === 'owner';
}

function isOverviewTab() {
  const active = String(window.location.hash || '#overview').replace(/^#/, '').trim() || 'overview';
  return active === 'overview';
}

async function loadOwnerGuilds({ force = false } = {}) {
  if (!force && ownerGuildCache.data && Date.now() - ownerGuildCache.at < OWNER_GUILD_CACHE_MS) {
    return ownerGuildCache.data;
  }

  const response = await fetch('/api/dashboard/guilds?mode=owner', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Could not verify owner access.');
  ownerGuildCache = { at: Date.now(), data };
  return data;
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function ensureRemovalDialog() {
  let dialog = document.querySelector('[data-owner-remove-dialog]');
  if (dialog) return dialog;

  dialog = document.createElement('dialog');
  dialog.className = 'dash-owner-remove-dialog';
  dialog.setAttribute('data-owner-remove-dialog', '');
  dialog.innerHTML = `
    <form method="dialog" class="dash-owner-remove-surface" data-owner-remove-form>
      <div class="dash-owner-remove-icon" aria-hidden="true">!</div>
      <div>
        <span>Permanent server action</span>
        <h2 data-owner-remove-title>Remove Meowz?</h2>
        <p>Meowz will immediately leave the Discord server. To confirm, type the server name exactly:</p>
        <strong class="dash-owner-confirm-name" data-owner-confirm-name></strong>
      </div>
      <label class="dash-field">
        <span>Server name</span>
        <input type="text" name="confirmation" autocomplete="off" spellcheck="false" data-owner-remove-confirmation />
      </label>
      <div class="dash-owner-remove-actions">
        <button type="button" class="dash-secondary-btn" data-cancel-owner-remove>Cancel</button>
        <button type="submit" class="dash-danger-btn" data-confirm-owner-remove disabled>Remove Meowz</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  const form = dialog.querySelector('[data-owner-remove-form]');
  const input = dialog.querySelector('[data-owner-remove-confirmation]');
  const confirmButton = dialog.querySelector('[data-confirm-owner-remove]');
  const cancelButton = dialog.querySelector('[data-cancel-owner-remove]');

  const syncConfirmation = () => {
    if (!confirmButton) return;
    confirmButton.disabled = !selectedGuild || String(input?.value || '').trim() !== String(selectedGuild.name);
  };

  cancelButton?.addEventListener('click', () => closeDialog(dialog));
  input?.addEventListener('input', syncConfirmation);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedGuild || !confirmButton || String(input?.value || '').trim() !== String(selectedGuild.name)) return;

    const guild = selectedGuild;
    const source = selectedSource;
    confirmButton.disabled = true;
    confirmButton.textContent = 'Removing…';
    if (cancelButton) cancelButton.disabled = true;

    try {
      const response = await fetch(`/api/dashboard/servers/${encodeURIComponent(guild.id)}/bot`, {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ confirmation: String(input?.value || '').trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not remove Meowz from this server.');

      removedGuildId = guild.id;
      ownerGuildCache = { at: 0, data: null };
      closeDialog(dialog);

      if (source?.matches?.('[data-owner-server-controls]')) {
        source.classList.add('is-complete');
        source.innerHTML = `<span>Owner controls</span><h2>Meowz was removed</h2><p>Meowz has left <strong>${escapeHtml(guild.name)}</strong>. Returning to the server list…</p>`;
      } else if (source?.matches?.('[data-owner-server-list-row]')) {
        source.classList.add('is-complete');
        const removeButton = source.querySelector('[data-owner-list-remove]');
        if (removeButton) {
          removeButton.disabled = true;
          removeButton.textContent = 'Removed';
        }
      }

      showStatusToast('success', 'Meowz removed from server', data?.message || `Meowz left ${guild.name}.`);
      setTimeout(() => window.location.assign('/dashboard'), 1500);
    } catch (err) {
      showStatusToast('error', 'Could not remove Meowz', err.message || 'The removal request failed.');
      confirmButton.textContent = 'Remove Meowz';
      if (cancelButton) cancelButton.disabled = false;
      syncConfirmation();
    }
  });

  return dialog;
}

function showRemovalDialog(guild, source) {
  selectedGuild = guild;
  selectedSource = source || null;
  const dialog = ensureRemovalDialog();
  const input = dialog.querySelector('[data-owner-remove-confirmation]');
  const confirmButton = dialog.querySelector('[data-confirm-owner-remove]');
  const cancelButton = dialog.querySelector('[data-cancel-owner-remove]');
  const title = dialog.querySelector('[data-owner-remove-title]');
  const name = dialog.querySelector('[data-owner-confirm-name]');

  if (title) title.textContent = `Remove Meowz from ${guild.name}?`;
  if (name) name.textContent = guild.name;
  if (input) {
    input.value = '';
    input.placeholder = guild.name;
  }
  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.textContent = 'Remove Meowz';
  }
  if (cancelButton) cancelButton.disabled = false;

  openDialog(dialog);
  requestAnimationFrame(() => input?.focus());
}

function overviewControlsMarkup(guild) {
  const guildName = escapeHtml(guild.name);
  const guildId = escapeHtml(guild.id);
  return `
    <article class="dash-card dash-owner-danger-zone" data-owner-server-controls="${guildId}">
      <div class="dash-owner-danger-head">
        <div>
          <span>Owner controls</span>
          <h2>Remove Meowz from this server</h2>
          <p>This disconnects Meowz from <strong>${guildName}</strong>. The bot will stop responding there immediately.</p>
        </div>
        <button type="button" class="dash-danger-btn" data-open-owner-remove>Remove Meowz</button>
      </div>
      <small class="dash-owner-danger-note">Only the configured Meowz owner can use this action. Server data is kept unless it is removed separately.</small>
    </article>`;
}

function attachOverviewControls(host, guild) {
  if (!host || host.querySelector('[data-owner-server-controls]')) return;
  host.insertAdjacentHTML('beforeend', overviewControlsMarkup(guild));
  const card = host.querySelector('[data-owner-server-controls]');
  card?.querySelector('[data-open-owner-remove]')?.addEventListener('click', () => showRemovalDialog(guild, card));
}

function unwrapServerListControls() {
  document.querySelectorAll('[data-owner-server-list-row]').forEach((wrapper) => {
    const link = wrapper.querySelector(':scope > .dash-server-row');
    if (link && wrapper.parentElement) wrapper.replaceWith(link);
    else wrapper.remove();
  });
}

function attachServerListControls(data) {
  const installed = new Map((Array.isArray(data?.installed) ? data.installed : []).map((guild) => [String(guild.id), guild]));
  document.querySelectorAll('.dash-list > .dash-server-row').forEach((link) => {
    const guildId = guildIdFromServerLink(link);
    const guild = guildId ? installed.get(String(guildId)) : null;
    if (!guild || link.closest('[data-owner-server-list-row]')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'dash-owner-server-list-row';
    wrapper.setAttribute('data-owner-server-list-row', String(guild.id));
    link.before(wrapper);
    wrapper.appendChild(link);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dash-owner-list-remove';
    button.setAttribute('data-owner-list-remove', '');
    button.setAttribute('aria-label', `Remove Meowz from ${guild.name}`);
    button.textContent = 'Remove';
    button.addEventListener('click', () => showRemovalDialog(guild, wrapper));
    wrapper.appendChild(button);
  });
}

async function syncOwnerControls() {
  syncFrame = 0;
  if (syncing) {
    syncPending = true;
    return;
  }

  syncing = true;
  try {
    if (!isOwnerView()) {
      document.querySelectorAll('[data-owner-server-controls]').forEach((node) => node.remove());
      unwrapServerListControls();
      return;
    }

    const data = await loadOwnerGuilds();
    if (!data?.isOwner || !data?.ownerMode) {
      document.querySelectorAll('[data-owner-server-controls]').forEach((node) => node.remove());
      unwrapServerListControls();
      return;
    }

    const guildId = currentGuildId();
    if (!guildId) {
      attachServerListControls(data);
      return;
    }

    unwrapServerListControls();
    if (removedGuildId === guildId || !isOverviewTab()) {
      document.querySelectorAll('[data-owner-server-controls]').forEach((node) => node.remove());
      return;
    }

    const host = document.querySelector('[data-server-tab-content][data-active-section="overview"]');
    if (!host || host.querySelector('[data-owner-server-controls]')) return;
    const guild = (Array.isArray(data.installed) ? data.installed : []).find((item) => String(item.id) === guildId);
    if (!guild || !host.isConnected) return;
    attachOverviewControls(host, guild);
  } catch (err) {
    console.warn('Owner server controls unavailable:', err);
  } finally {
    syncing = false;
    if (syncPending) {
      syncPending = false;
      scheduleSync();
    }
  }
}

function scheduleSync() {
  if (syncing) {
    syncPending = true;
    return;
  }
  if (syncFrame) return;
  syncFrame = requestAnimationFrame(syncOwnerControls);
}

const observer = new MutationObserver(scheduleSync);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleSync);
window.addEventListener('popstate', scheduleSync);
window.addEventListener('storage', (event) => {
  if (event.key === OWNER_VIEW_STORAGE_KEY) scheduleSync();
});
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-owner-mode]')) setTimeout(scheduleSync, 120);
});

scheduleSync();
