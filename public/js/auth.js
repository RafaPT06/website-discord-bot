import { escapeHtml } from './utils.js';

const authArea = document.querySelector('[data-auth-area]');

function avatarUrl(user) {
  if (!user?.id || !user?.avatar) return null;
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=64`;
}

function displayName(user) {
  return user?.globalName || user?.username || 'Discord User';
}

function renderLoggedOut() {
  if (!authArea) return;
  authArea.className = 'auth-area';
  authArea.innerHTML = '<a class="login-button" href="/auth/discord">Login with Discord</a>';
}

function renderLoggedIn(user) {
  if (!authArea) return;

  const image = avatarUrl(user);
  const name = escapeHtml(displayName(user));
  const fallback = escapeHtml(name.slice(0, 1).toUpperCase() || 'U');
  const avatar = image
    ? `<img src="${image}" alt="" loading="lazy" />`
    : `<span>${fallback}</span>`;

  authArea.className = 'auth-area is-authenticated';
  authArea.innerHTML = `
    <div class="user-menu">
      <div class="user-chip" title="${name}">
        <div class="user-avatar">${avatar}</div>
        <span>${name}</span>
      </div>
      <a class="logout-button" href="/auth/logout">Logout</a>
    </div>
  `;
}

export async function initAuth() {
  if (!authArea) return;

  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    const data = await res.json();

    if (data?.authenticated && data?.user) {
      renderLoggedIn(data.user);
      return;
    }

    renderLoggedOut();
  } catch {
    renderLoggedOut();
  }
}
