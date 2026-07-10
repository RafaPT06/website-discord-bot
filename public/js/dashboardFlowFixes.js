const style = document.createElement('style');
style.textContent = `
  body.has-dashboard-unsaved, body.has-dashboard-status { padding-bottom: 0 !important; }
  [data-floating-status-host], .dash-floating-status { display: none !important; }
  [data-server-save-host] { position: static !important; inset: auto !important; transform: none !important; width: 100% !important; max-width: 100% !important; margin: clamp(1.05rem, 2.6vw, 1.45rem) 0 0 !important; padding: 0 !important; z-index: auto !important; }
  [data-server-save-host]:empty { display: none !important; }
  [data-server-save-host] .dash-save-bar, .dash-save-bar[data-global-save-bar] { position: static !important; inset: auto !important; transform: none !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: clamp(.9rem, 2vw, 1.1rem) !important; display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; align-items: center !important; gap: clamp(.75rem, 1.8vw, 1rem) !important; border-radius: clamp(.95rem, 2vw, 1.15rem) !important; border: 1px solid rgba(139, 92, 246, .28) !important; background: linear-gradient(180deg, rgba(255,255,255,.065), rgba(255,255,255,.035)) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.07) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  .dash-save-bar > div:last-child { display: flex !important; justify-content: flex-end !important; gap: .65rem !important; flex-wrap: wrap !important; }
  .dash-save-bar .dash-save-btn, .dash-save-bar .dash-secondary-btn { min-height: 2.65rem !important; min-width: min(9.25rem, 42vw) !important; }
  .dash-moderation-layout { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; align-items: start !important; gap: clamp(1.25rem, 2.8vw, 1.8rem) !important; row-gap: clamp(1.35rem, 3vw, 1.95rem) !important; }
  .dash-moderation-layout > * { min-width: 0 !important; margin-top: 0 !important; margin-bottom: 0 !important; }
  [data-moderation-access-list] { display: block !important; min-height: 0 !important; margin-top: clamp(1rem, 2.4vw, 1.35rem) !important; }
  .dash-automation-card { align-self: start !important; }
  @media (min-width: 1100px) { .dash-moderation-layout { grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr) !important; } .dash-moderation-layout > [data-settings-form="moderation"] { grid-row: span 2 !important; } }
  @media (max-width: 700px) { [data-server-save-host] .dash-save-bar, .dash-save-bar[data-global-save-bar] { grid-template-columns: 1fr !important; align-items: stretch !important; } .dash-save-bar > div:last-child { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .dash-save-bar .dash-save-btn, .dash-save-bar .dash-secondary-btn { width: 100% !important; min-width: 0 !important; } }
`;
document.head.appendChild(style);

function html(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function guildIdFromPath() {
  const match = window.location.pathname.match(/\/(?:dashboard|demo)\/server\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function row(user, type, removable) {
  const name = user.displayName || user.name || user.label || user.username || user.userId || user.id || 'Unknown user';
  const id = user.userId || user.id || '';
  const avatar = user.avatarUrl ? `<img src="${html(user.avatarUrl)}" alt=""/>` : html(name.slice(0, 1).toUpperCase());
  return `<div class="dash-access-row"><span class="dash-access-avatar">${avatar}</span><span><strong>${html(name)}</strong><small>${html(type)}${id ? ` · ${html(id)}` : ''}</small></span><button type="button" ${removable ? `data-remove-ai-user="${html(id)}" data-remove-ai-label="${html(name)}"` : 'disabled'}>${removable ? 'Remove' : 'Default'}</button></div>`;
}

function renderAccess(data) {
  const defaults = Array.isArray(data.defaultUsers) ? data.defaultUsers : [];
  const manual = Array.isArray(data.allowedUsers) ? data.allowedUsers : (Array.isArray(data.users) ? data.users : []);
  const owner = defaults.filter((user) => ['bot_owner', 'owner'].includes(String(user.source || user.type || '').toLowerCase()));
  const managers = defaults.filter((user) => !owner.includes(user));
  const empty = '<div class="empty-state"><strong>No manual moderation bypass users.</strong><span>Search by username or paste a Discord ID to add someone.</span></div>';
  return `<div class="dash-access-list"><div class="dash-note"><strong>Default access</strong><span>Bot owner and users with Manage Server are included automatically and cannot be removed.</span></div>${owner.map((user) => row(user, 'Bot Owner', false)).join('')}${managers.map((user) => row(user, 'Manage Server', false)).join('')}${manual.length ? `<h3>Manual access</h3>${manual.map((user) => row(user, 'Manual', true)).join('')}` : empty}</div>`;
}

const loaded = new WeakSet();
async function fixModerationList() {
  const holder = document.querySelector('[data-moderation-access-list]');
  const guildId = guildIdFromPath();
  if (!holder || !guildId || loaded.has(holder)) return;
  loaded.add(holder);
  holder.innerHTML = renderAccess({ defaultUsers: [], users: [] });
  try {
    const response = await fetch(`/api/dashboard/servers/${encodeURIComponent(guildId)}/moderation-access`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    holder.innerHTML = renderAccess(response.ok ? data : { defaultUsers: [], users: [] });
  } catch {
    holder.innerHTML = renderAccess({ defaultUsers: [], users: [] });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fixModerationList);
else fixModerationList();
new MutationObserver(fixModerationList).observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(fixModerationList, 0));
