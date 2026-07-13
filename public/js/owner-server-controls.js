import { showStatusToast } from './toast.js';

const OWNER_VIEW_STORAGE_KEY = 'meowzDashboardViewMode';
const OWNER_GUILD_CACHE_MS = 15_000;
let ownerGuildCache = { at: 0, data: null };
let syncFrame = 0;
let syncing = false;
let syncPending = false;
let removedGuildId = null;

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

function ownerControlsMarkup(guild) {
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
    </article>
    <dialog class="dash-owner-remove-dialog" data-owner-remove-dialog aria-labelledby="owner-remove-title-${guildId}">
      <form method="dialog" class="dash-owner-remove-surface" data-owner-remove-form>
        <div class="dash-owner-remove-icon" aria-hidden="true">!</div>
        <div>
          <span>Permanent server action</span>
          <h2 id="owner-remove-title-${guildId}">Remove Meowz from ${guildName}?</h2>
          <p>Meowz will immediately leave the Discord server. To confirm, type the server name exactly:</p>
          <strong class="dash-owner-confirm-name">${guildName}</strong>
        </div>
        <label class="dash-field">
          <span>Server name</span>
          <input type="text" name="confirmation" autocomplete="off" spellcheck="false" placeholder="${guildName}" data-owner-remove-confirmation />
        </label>
        <div class="dash-owner-remove-actions">
          <button type="button" class="dash-secondary-btn" data-cancel-owner-remove>Cancel</button>
          <button type="submit" class="dash-danger-btn" data-confirm-owner-remove disabled>Remove Meowz</button>
        </div>
      </form>
    </dialog>`;
}

function attachOwnerControls(host, guild) {
  if (!host || host.querySelector('[data-owner-server-controls]')) return;
  host.insertAdjacentHTML('beforeend', ownerControlsMarkup(guild));

  const card = host.querySelector('[data-owner-server-controls]');
  const dialog = host.querySelector('[data-owner-remove-dialog]');
  const form = dialog?.querySelector('[data-owner-remove-form]');
  const input = dialog?.querySelector('[data-owner-remove-confirmation]');
  const confirmButton = dialog?.querySelector('[data-confirm-owner-remove]');
  const openButton = card?.querySelector('[data-open-owner-remove]');
  const cancelButton = dialog?.querySelector('[data-cancel-owner-remove]');

  const syncConfirmation = () => {
    if (!confirmButton) return;
    confirmButton.disabled = String(input?.value || '').trim() !== String(guild.name);
  };

  openButton?.addEventListener('click', () => {
    if (input) input.value = '';
    syncConfirmation();
    openDialog(dialog);
    requestAnimationFrame(() => input?.focus());
  });

  cancelButton?.addEventListener('click', () => closeDialog(dialog));
  input?.addEventListener('input', syncConfirmation);
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const confirmation = String(input?.value || '').trim();
    if (confirmation !== String(guild.name) || !confirmButton) return;

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
        body: JSON.stringify({ confirmation }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not remove Meowz from this server.');

      removedGuildId = guild.id;
      ownerGuildCache = { at: 0, data: null };
      closeDialog(dialog);
      if (card) {
        card.classList.add('is-complete');
        card.innerHTML = `<span>Owner controls</span><h2>Meowz was removed</h2><p>Meowz has left <strong>${escapeHtml(guild.name)}</strong>. Returning to the server list…</p>`;
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
}

async function syncOwnerControls() {
  syncFrame = 0;
  if (syncing) {
    syncPending = true;
    return;
  }

  syncing = true;
  try {
    document.querySelectorAll('[data-owner-server-controls], [data-owner-remove-dialog]').forEach((node) => {
      if (!isOwnerView() || !isOverviewTab()) node.remove();
    });

    const guildId = currentGuildId();
    if (!guildId || removedGuildId === guildId || !isOwnerView() || !isOverviewTab()) return;

    const host = document.querySelector('[data-server-tab-content][data-active-section="overview"]');
    if (!host || host.querySelector('[data-owner-server-controls]')) return;

    const data = await loadOwnerGuilds();
    if (!data?.isOwner || !data?.ownerMode) return;
    const guild = (Array.isArray(data.installed) ? data.installed : []).find((item) => String(item.id) === guildId);
    if (!guild || !host.isConnected) return;
    attachOwnerControls(host, guild);
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
