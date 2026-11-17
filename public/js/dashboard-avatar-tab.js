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
    const rows = (trackers.trackers || []).map(t => `<div class="dash-card" data-avatar-user="${esc(t.userId)}" style="margin-top:12px">
      <h3>${esc(t.username)}</h3><p>Roblox ID: ${esc(t.userId)}</p>
      <label>Notification channel <select data-avatar-channel style="width:100%;padding:12px;margin:8px 0">${options(t.channelId)}</select></label>
      <label style="display:block;margin:12px 0"><input data-avatar-enabled type="checkbox" ${t.enabled ? 'checked' : ''}> Enabled</label>
      <button type="button" class="btn btn-primary" data-avatar-save>Save</button>
      <button type="button" class="btn btn-secondary" data-avatar-remove>Remove</button>
    </div>`).join('');
    host.innerHTML = `<section class="dash-designer" data-avatar-page>
      <article class="dash-card"><span>Roblox Avatar Tracker</span><h2>Track Roblox avatar changes</h2><p>Meowz checks every five minutes and notifies your selected Discord channel.</p></article>
      <form class="dash-card" data-avatar-add style="margin-top:16px"><h2>Add Roblox user</h2>
      <input name="user" required maxlength="150" placeholder="Username, user ID or profile link" style="width:100%;padding:12px;margin:10px 0">
      <select name="channelId" required style="width:100%;padding:12px;margin:10px 0">${options('')}</select>
      <button class="btn btn-primary">Add tracker</button></form>
      <article class="dash-card" style="margin-top:16px"><h2>Tracked users</h2>${rows || '<p>No users tracked yet.</p>'}</article>
      <p data-avatar-message role="status"></p>
    </section>`;
    document.title = 'Avatar Tracker — Meowz';
  } catch(err) {
    host.innerHTML = '<article class="dash-card"><h2>Could not load Avatar Tracker</h2><p>' + esc(err.message) + '</p><button data-avatar-retry>Try again</button></article>';
  } finally { busy = false; }
}
async function refresh() {
  const host = document.querySelector('[data-server-tab-content]');
  if (host) host.dataset.activeSection = '';
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
