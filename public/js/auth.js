import { escapeHtml } from './utils.js';

const authArea = document.querySelector('[data-auth-area]');
let activeUser = null;

function avatarUrl(user) {
  if (!user?.id || !user?.avatar) return null;
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=96`;
}

function displayName(user) {
  return user?.globalName || user?.username || 'Discord User';
}

function renderAvatar(user) {
  const image = avatarUrl(user);
  const name = displayName(user);
  const fallback = escapeHtml(name.slice(0, 1).toUpperCase() || 'U');

  if (!image) {
    return `<span class="nav-user-avatar nav-user-avatar-fallback" aria-hidden="true">${fallback}</span>`;
  }

  return `<span class="nav-user-avatar" aria-hidden="true"><img src="${image}" alt="" loading="lazy" /></span>`;
}

function closeProfileMenu() {
  const menu = document.querySelector('[data-profile-menu]');
  const button = document.querySelector('[data-profile-toggle]');
  if (!menu || !button) return;
  menu.hidden = true;
  button.setAttribute('aria-expanded', 'false');
}

function toggleProfileMenu() {
  const menu = document.querySelector('[data-profile-menu]');
  const button = document.querySelector('[data-profile-toggle]');
  if (!menu || !button) return;
  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  button.setAttribute('aria-expanded', String(willOpen));
}

function renderLoggedOut() {
  activeUser = null;

  if (!authArea) return;
  authArea.className = 'auth-area';
  authArea.innerHTML = '<a class="login-button" href="/auth/discord">Login with Discord</a>';
}

function renderLoggedIn(user) {
  activeUser = user;

  if (!authArea) return;

  const name = escapeHtml(displayName(user));
  const username = escapeHtml(user?.username ? `@${user.username}` : '@discord');

  authArea.className = 'auth-area is-authenticated';
  authArea.innerHTML = `
    <div class="profile-menu-wrap">
      <button class="nav-user-button" type="button" data-profile-toggle aria-haspopup="menu" aria-expanded="false">
        ${renderAvatar(user)}
        <span class="nav-user-text">
          <span class="nav-user-name">${name}</span>
          <span class="nav-user-subtitle">${username}</span>
        </span>
        <span class="profile-chevron" aria-hidden="true">⌄</span>
      </button>

      <div class="profile-dropdown" data-profile-menu role="menu" hidden>
        <a href="#settings" role="menuitem">Settings</a>
        <a class="logout-link" href="/auth/logout" role="menuitem">Logout</a>
      </div>
    </div>
  `;

  const toggle = authArea.querySelector('[data-profile-toggle]');
  toggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleProfileMenu();
  });
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

document.addEventListener('click', (event) => {
  const menuWrap = event.target.closest?.('.profile-menu-wrap');
  if (!menuWrap) closeProfileMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeProfileMenu();
});

export function getActiveUser() {
  return activeUser;
}
