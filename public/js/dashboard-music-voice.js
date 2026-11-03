const SECTION = 'music-voice';
const cache = new Map();
let loading = false;
let generation = 0;
const demo = () => location.pathname.startsWith('/demo');
const guildId = () => location.pathname.match(/\/(?:dashboard\/server|demo\/server)\/([^/]+)/)?.[1] || null;
const active = () => location.hash.toLowerCase() === '#' + SECTION;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const endpoint = id => '/api/dashboard/servers/' + encodeURIComponent(id) + '/music/voice';
const demoState = () => ({ channels: [
  { id:'demo-general', name:'General', joinable:true, full:false },
  { id:'demo-music', name:'Music Lounge', joinable:true, full:false },
  { id:'demo-afk', name:'AFK', joinable:false, full:false },
], voice:{ connected:false, channelId:null, status:'disconnected' } });

async function request(url, options) {
  const response = await fetch(url, { cache:'no-store', headers:{ 'content-type':'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'Request failed (' + response.status + ')');
  return data;
}
function ensureNav() {
  const url = location.pathname + '#' + SECTION;
  for (const nav of document.querySelectorAll('.dash-tabs')) {
    if (!nav.querySelector('[data-music-voice-tab]')) {
      const a = document.createElement('a'); a.href = url; a.dataset.musicVoiceTab = 'true'; a.textContent = 'Music & Voice'; nav.append(a);
    }
  }
  for (const nav of document.querySelectorAll('.dash-side-nav')) {
    if (nav.querySelector('small')?.textContent?.trim() !== 'Dashboard' || nav.querySelector('[data-music-voice-tab]')) continue;
    const a = document.createElement('a'); a.href = url; a.dataset.musicVoiceTab = 'true'; a.textContent = 'Music & Voice'; nav.append(a);
  }
  for (const nav of document.querySelectorAll('.dash-mobile-drawer .dash-drawer-group')) {
    if (nav.querySelector('small')?.textContent?.trim() !== 'Dashboard' || nav.querySelector('[data-music-voice-tab]')) continue;
    const a = document.createElement('a'); a.href = url; a.dataset.musicVoiceTab = 'true'; a.textContent = 'Music & Voice'; nav.append(a);
  }
  document.querySelectorAll('[data-music-voice-tab]').forEach(a => a.classList.toggle('is-active', active()));
}
function page(data) {
  const selected = data.voice?.channelId || '';
  const channels = data.channels || [];
  const options = channels.map(c => '<option value="' + escapeHtml(c.id) + '"' +
    (c.id === selected ? ' selected' : '') + (c.joinable && !c.full ? '' : ' disabled') +
    '>' + escapeHtml(c.name) + (c.full ? ' (Full)' : !c.joinable ? ' (Unavailable)' : '') + '</option>').join('');
  return '<section class="music-voice-page" data-music-voice-page>' +
    '<header class="music-voice-header"><span>SERVER UTILITIES</span><h1>Music & Voice</h1><p>Connect Meowz to a voice channel without joining it yourself.</p></header>' +
    '<div class="music-voice-grid"><div class="dash-card music-voice-card"><div class="music-voice-heading"><h2>Voice connection</h2><span class="music-voice-status">' +
    (data.voice?.connected ? 'Connected' : 'Disconnected') + '</span></div>' +
    '<label for="music-voice-channel">Voice channel</label><select id="music-voice-channel" data-music-voice-select><option value="">Select a voice channel</option>' + options + '</select>' +
    '<div class="music-voice-actions"><button type="button" class="dash-primary-btn" data-music-voice-join' + (demo() ? ' disabled' : '') + '>Join channel</button>' +
    '<button type="button" class="dash-secondary-btn" data-music-voice-leave' + (demo() || !data.voice?.connected ? ' disabled' : '') + '>Disconnect</button>' +
    '<button type="button" class="dash-secondary-btn" data-music-voice-refresh>Refresh</button></div>' +
    '<p class="music-voice-message" data-music-voice-message role="status">' +
    (demo() ? 'Demo mode is read-only. These are sample voice channels.' : 'Meowz needs View Channel and Connect permissions.') + '</p></div>' +
    '<div class="dash-card music-voice-card"><h2>Spotify</h2><p>Spotify playlist and track browsing is coming next. Account connection will use Spotify OAuth.</p>' +
    '<div class="music-voice-spotify-note">Spotify audio cannot be rebroadcast through the Spotify API. Music playback will use separately supported audio sources.</div>' +
    '<button type="button" class="dash-secondary-btn" disabled>Connect Spotify — coming soon</button></div></div></section>';
}
async function render(force = false) {
  if (!active() || loading) return;
  const id = guildId(), host = document.querySelector('[data-server-tab-content]');
  if (!id || !host) return;
  if (!force && host.dataset.activeSection === SECTION && host.querySelector('[data-music-voice-page]')) return;
  const token = ++generation;
  loading = true;
  host.dataset.activeSection = SECTION;
  host.innerHTML = '<div class="music-voice-loading">Loading voice channels…</div>';
  try {
    const data = demo() ? demoState() : (!force && cache.has(id) ? cache.get(id) : await request(endpoint(id)));
    if (!active() || token !== generation) return;
    cache.set(id, data);
    host.innerHTML = page(data);
    bind(id, host);
  } catch (err) {
    if (token === generation) host.innerHTML = '<div class="dash-card music-voice-card"><h2>Could not load voice channels</h2><p>' + escapeHtml(err.message) + '</p><button class="dash-secondary-btn" data-music-voice-retry>Retry</button></div>';
    host.querySelector('[data-music-voice-retry]')?.addEventListener('click', () => render(true));
  } finally { loading = false; }
}
function bind(id, host) {
  const select = host.querySelector('[data-music-voice-select]');
  const message = host.querySelector('[data-music-voice-message]');
  host.querySelector('[data-music-voice-refresh]')?.addEventListener('click', () => { cache.delete(id); render(true); });
  async function action(kind) {
    if (demo()) return;
    const channelId = select.value;
    if (kind === 'join' && !channelId) { message.textContent = 'Select a voice channel first.'; return; }
    const buttons = [...host.querySelectorAll('button')];
    buttons.forEach(button => button.disabled = true);
    message.textContent = kind === 'join' ? 'Connecting Meowz…' : 'Disconnecting Meowz…';
    try {
      await request(endpoint(id) + '/' + kind, { method:'POST', body:JSON.stringify(kind === 'join' ? { channelId } : {}) });
      cache.delete(id);
      await render(true);
    } catch (err) {
      message.textContent = err.message;
      buttons.forEach(button => button.disabled = false);
    }
  }
  host.querySelector('[data-music-voice-join]')?.addEventListener('click', () => action('join'));
  host.querySelector('[data-music-voice-leave]')?.addEventListener('click', () => action('leave'));
}
function navigate() {
  ensureNav();
  if (active()) {
    const host = document.querySelector('[data-server-tab-content]');
    if (host) host.dataset.activeSection = '';
    render();
  }
}
document.addEventListener('click', event => {
  const link = event.target.closest?.('[data-music-voice-tab]');
  if (!link || new URL(link.href).pathname !== location.pathname) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!active()) history.pushState(null, '', '#' + SECTION);
  navigate();
}, true);
window.addEventListener('hashchange', navigate);
window.addEventListener('popstate', navigate);
new MutationObserver(() => {
  ensureNav();
  if (active() && !loading && !document.querySelector('[data-music-voice-page]') && !document.querySelector('.music-voice-loading')) render();
}).observe(document.documentElement, { childList:true, subtree:true });
navigate();
