const SECTION = 'avatar-tracker';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const guildId = () => location.pathname.match(/\/(?:dashboard|demo)\/server\/(\d{15,25})/)?.[1];
const active = () => location.hash.toLowerCase() === '#avatar-tracker';
let busy = false;
let lastGuild = null;
function nav() {
  const id = guildId();
  document.getElementById('meowz-avatar-tracker-link')?.remove();
  if (!id) return;
  for (const [selector, attr] of [['.dash-tabs','tab'],['.dash-side-nav','side'],['.dash-mobile-drawer .dash-drawer-group','mobile']]) {
    document.querySelectorAll(selector).forEach(container => {
      if (attr !== 'tab' && container.querySelector('small')?.textContent?.trim() !== 'Dashboard') return;
      if (!container.querySelector('[data-avatar-tracker-tab]')) {
        const link = document.createElement('a');
        link.dataset.avatarTrackerTab = 'true';
        link.href = '/dashboard/server/' + id + '#avatar-tracker';
        link.textContent = 'Avatar Tracker';
        container.append(link);
      }
    });
  }
  document.querySelectorAll('[data-avatar-tracker-tab]').forEach(link => link.classList.toggle('is-active', active()));
}
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers: {'content-type':'application/json'} });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'Request failed (' + response.status + ')');
  return data;
}
let channels = [];
const options = selected => '<option value="">Choose channel</option>' + channels.map(c => '<option value="' + esc(c.id) + '" ' + (String(c.id) === String(selected) ? 'selected' : '') + '># ' + esc(c.name) + '</option>').join('');
async function render() {
  if (!active() || busy || !guildId()) return;
  const host = document.querySelector('[data-server-tab-content]');
  if (!host) return;
  busy = true;
  const id = guildId();
  lastGuild = id;
  host.dataset.activeSection = SECTION;
  document.querySelectorAll('.dash-tabs a, .dash-side-nav a').forEach(link => link.classList.toggle('is-active', !!link.dataset.avatarTrackerTab));
  document.querySelectorAll('[data-dashboard-active-crumb]').forEach(crumb => { crumb.textContent = 'Avatar Tracker'; crumb.hidden = false; });
  host.innerHTML = '<article class="dash-card"><h2>Loading Avatar Tracker…</h2></article>';
  try {
    const [trackers, server] = await Promise.all([api('/api/dashboard/servers/' + id + '/avatar-trackers'),api('/api/dashboard/servers/' + id)]);
    if (!active() || id !== guildId()) return;
    channels = (server?.server?.channels || []).filter(c => {
      const type = String(c.typeName ?? c.type ?? '').toLowerCase();
      return !type || type === '0' || type.includes('text') || type.includes('announcement');
    });
    const users = trackers.trackers || [];
    const rows = users.map(t => `<article class="avatar-user" data-avatar-user="${esc(t.userId)}">
      <div class="avatar-user-top">
        <img class="avatar-user-image" src="https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(t.userId)}&width=150&height=150&format=png" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="avatar-user-info"><strong>${esc(t.username)}</strong><a href="https://www.roblox.com/users/${encodeURIComponent(t.userId)}/profile" target="_blank" rel="noopener noreferrer">View Roblox profile</a><span>ID: ${esc(t.userId)}</span></div>
        <span class="avatar-status ${t.enabled ? 'on' : 'off'}">${t.enabled ? 'Active' : 'Paused'}</span>
      </div>
      <div class="avatar-user-controls">
        <label class="avatar-field">Notification channel<select data-avatar-channel>${options(t.channelId)}</select></label>
        <label class="avatar-switch"><input data-avatar-enabled type="checkbox" ${t.enabled ? 'checked' : ''}><span>Tracking enabled</span></label>
        <div class="avatar-actions"><button type="button" class="btn btn-primary" data-avatar-save>Save changes</button><button type="button" class="btn btn-secondary" data-avatar-remove>Remove</button></div>
      </div>
    </article>`).join('');
    host.innerHTML = `<section class="avatar-dashboard" data-avatar-page>
      <header class="avatar-hero"><div><span class="avatar-eyebrow">ROBLOX • AVATAR MONITORING</span><h2>Avatar Tracker</h2><p>Stay updated when someone's Roblox outfit changes. Meowz checks every 5 minutes.</p></div>
      <div class="avatar-counter"><strong>${users.length}</strong><span>Tracked ${users.length === 1 ? 'user' : 'users'}</span></div></header>
      <div class="avatar-layout">
      <form class="avatar-panel avatar-add" data-avatar-add><div class="avatar-panel-head"><div><span class="avatar-eyebrow">NEW TRACKER</span><h3>Add a Roblox user</h3></div><span class="avatar-step">01</span></div>
      <label class="avatar-field">Roblox username or profile<input name="user" required maxlength="150" autocomplete="off" placeholder="Username, user ID or profile URL"></label>
      <label class="avatar-field">Send notifications to<select name="channelId" required>${options('')}</select></label>
      <button class="btn btn-primary avatar-add-button">+ Add tracker</button></form>
      <section class="avatar-panel avatar-list"><div class="avatar-panel-head"><div><span class="avatar-eyebrow">MANAGE TRACKERS</span><h3>Tracked users</h3></div><span class="avatar-count">${users.length} total</span></div>
      ${rows || '<div class="avatar-empty"><strong>No users yet</strong><p>Add a Roblox account to start receiving avatar change alerts.</p></div>'}</section></div>
      <p class="avatar-feedback" data-avatar-message role="status" aria-live="polite"></p>
    </section>`;
    document.title = 'Avatar Tracker — Meowz';
  } catch(err) {
    host.innerHTML = '<article class="dash-card"><h2>Could not load Avatar Tracker</h2><p>' + esc(err.message) + '</p><button data-avatar-retry>Try again</button></article>';
  } finally { busy = false; }
}
async function refresh() {
  const host = document.querySelector('[data-server-tab-content]');
  if (host) { host.dataset.activeSection = ''; host.querySelector('[data-avatar-page]')?.remove(); }
  await render();
}
document.addEventListener('click', async event => {
  const tab = event.target.closest('[data-avatar-tracker-tab]');
  if (tab) {
    event.preventDefault();event.stopImmediatePropagation();
    if (!active()) history.pushState(null, '', '#avatar-tracker');
    nav();await refresh();return;
  }
  if (event.target.closest('[data-avatar-retry]')) { await refresh();return; }
  const row = event.target.closest('[data-avatar-user]');
  const action = event.target.closest('[data-avatar-save],[data-avatar-remove]');
  if (!row || !action) return;
  const id = guildId();if (!id || location.pathname.startsWith('/demo')) return;
  const url = '/api/dashboard/servers/' + id + '/avatar-trackers/' + encodeURIComponent(row.dataset.avatarUser);
  const msg = document.querySelector('[data-avatar-message]');
  try {
    if (action.hasAttribute('data-avatar-remove')) {
      if (!confirm('Remove this tracked user?')) return;
      await api(url, {method:'DELETE'});
    } else {
      await api(url, {method:'PATCH',body:JSON.stringify({channelId:row.querySelector('[data-avatar-channel]').value,enabled:row.querySelector('[data-avatar-enabled]').checked})});
    }
    await refresh();
  } catch(err) { if(msg) msg.textContent = err.message; }
}, true);
document.addEventListener('submit',async event => {
  if (!event.target.matches('[data-avatar-add]')) return;
  event.preventDefault();event.stopImmediatePropagation();
  if (location.pathname.startsWith('/demo')) return;
  const form = event.target;
  const msg = document.querySelector('[data-avatar-message]');
  try {
    await api('/api/dashboard/servers/' + guildId() + '/avatar-trackers',{method:'POST',body:JSON.stringify({user:form.elements.user.value,channelId:form.elements.channelId.value})});
    await refresh();
  } catch(err) { if(msg) msg.textContent = err.message; }
},true);
function schedule() {
  nav();
  if (active()) {
    const host = document.querySelector('[data-server-tab-content]');
    if (host && (host.dataset.activeSection !== SECTION || !host.querySelector('[data-avatar-page]'))) render();
  }
}
window.addEventListener('hashchange',schedule);
window.addEventListener('popstate',schedule);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
schedule();
