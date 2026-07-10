import { escapeHtml } from '../utils.js';
import { emptyState } from './feedback.js';

export function userAccessForm(kind, title = 'Add user access') {
  return `<form class="dash-inline-form dash-user-search-form" data-access-form="${escapeHtml(kind)}" autocomplete="off"><label class="dash-field dash-user-search-field"><span>${escapeHtml(title)}</span><input name="userSearch" placeholder="Search username or paste Discord ID" data-user-search="${escapeHtml(kind)}" /><input type="hidden" name="userId" data-user-id="${escapeHtml(kind)}"/><div class="dash-user-search-results" data-user-search-results="${escapeHtml(kind)}" hidden></div></label><button class="dash-save-btn" type="submit">Add user</button></form>`;
}

export function accessUserRow(user, removable = false, type = 'Manual') {
  const name = user.displayName || user.name || user.label || user.username || user.id || user.userId || 'Unknown user';
  const id = user.userId || user.id || '';
  const img = user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt=""/>` : escapeHtml(name.slice(0,1).toUpperCase());
  return `<div class="dash-access-row"><span class="dash-access-avatar">${img}</span><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(type)}${user.username ? ` · ${escapeHtml(user.username)}` : (id ? ` · ${escapeHtml(id)}` : '')}</small></span><button type="button" ${removable ? `data-remove-ai-user="${escapeHtml(id)}" data-remove-ai-label="${escapeHtml(name)}"` : 'disabled'}>${removable ? 'Remove' : 'Default'}</button></div>`;
}

export function normalizeAccessPayload(data = {}) {
  const defaultUsers = Array.isArray(data.defaultUsers) ? data.defaultUsers : [
    ...(data.owner ? [data.owner] : []),
    ...(Array.isArray(data.manageServerUsers) ? data.manageServerUsers : []),
    ...(Array.isArray(data.managers) ? data.managers : []),
  ];
  const manual = Array.isArray(data.allowedUsers) ? data.allowedUsers
    : Array.isArray(data.users) ? data.users
    : Array.isArray(data.trustedUsers) ? data.trustedUsers
    : Array.isArray(data.bypassUsers) ? data.bypassUsers
    : Array.isArray(data.members) ? data.members
    : [];
  return { defaultUsers, manual };
}

export function renderAccessList(data = {}, manualEmpty = 'No manually added users.') {
  const { defaultUsers, manual } = normalizeAccessPayload(data);
  const owner = defaultUsers.filter((user) => ['bot_owner', 'owner'].includes(String(user.source || user.type || '').toLowerCase()));
  const managers = defaultUsers.filter((user) => !owner.includes(user));
  const fallbackNote = data?.fallback
    ? '<div class="dash-note dash-note-warning"><strong>Limited access data</strong><span>The live moderation access API is unavailable, so safe defaults are shown for now.</span></div>'
    : '';
  return `<div class="dash-access-list">${fallbackNote}<div class="dash-note"><strong>Default access</strong><span>Bot owner and users with Manage Server are included automatically and cannot be removed.</span></div>${owner.map(u => accessUserRow(u, false, 'Bot Owner')).join('')}${managers.map(u => accessUserRow(u, false, 'Manage Server')).join('')}${manual.length ? `<h3>Manual access</h3>${manual.map(u => accessUserRow(u, true, 'Manual')).join('')}` : emptyState(manualEmpty, 'Search by username or paste a Discord ID to add someone.')}</div>`;
}

export function userSuggestionRow(user) {
  const name = user.displayName || user.username || user.userId || 'Unknown user';
  const username = user.username && user.username !== name ? user.username : user.userId;
  const avatar = user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt=""/>` : escapeHtml(String(name).slice(0,1).toUpperCase());
  return `<button type="button" data-user-suggestion data-user-id="${escapeHtml(user.userId || user.id || '')}" data-user-label="${escapeHtml(name)}"><span class="dash-access-avatar">${avatar}</span><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(username || '')}</small></span></button>`;
}
