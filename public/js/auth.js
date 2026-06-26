import { escapeHtml } from './utils.js';

const authArea = document.querySelector('[data-auth-area]');
const brand = document.querySelector('[data-brand-link]');
const brandIcon = document.querySelector('[data-bot-avatar-small]');
const brandLabel = document.querySelector('[data-bot-name-short]');
let activeUser = null;

function avatarUrl(user) {
  if (!user?.id || !user?.avatar) return null;
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=96`;
}

function displayName(user) {
  return user?.globalName || user?.username || 'Discord User';
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

function applyLoggedOutBrand() {
  if (!brand || !brandIcon || !brandLabel) return;
  brand.classList.remove('brand-user');
  brandIcon.classList.remove('user-image', 'has-image');
  brandIcon.style.backgroundImage = '';
  brandIcon.textContent = 'M';
  brandLabel.hidden = false;
}

function applyLoggedInBrand(user) {
  if (!brand || !brandIcon || !brandLabel) return;
  const image = avatarUrl(user);
  const name = displayName(user);
  brand.classList.add('brand-user');
  brand.setAttribute('aria-label', `${name}'s profile`);

  brandLabel.hidden = true;

  if (image) {
    brandIcon.classList.add('user-image', 'has-image');
    brandIcon.style.backgroundImage = `url("${image}")`;
    brandIcon.textContent = '';
    return;
  }

  brandIcon.classList.remove('has-image');
  brandIcon.classList.add('user-image');
  brandIcon.style.backgroundImage = '';
  brandIcon.textContent = escapeHtml(name.slice(0, 1).toUpperCase() || 'U');
}

function renderLoggedOut() {
  activeUser = null;
  applyLoggedOutBrand();

  if (!authArea) return;
  authArea.className = 'auth-area';
  authArea.innerHTML = '<a class="login-button" href="/auth/discord">Login with Discord</a>';
}

function renderLoggedIn(user) {
  activeUser = user;
  applyLoggedInBrand(user);

  if (!authArea) return;

  const name = escapeHtml(displayName(user));

  authArea.className = 'auth-area is-authenticated';
  authArea.innerHTML = `
    <div class="profile-menu-wrap">
      <button class="profile-button" type="button" data-profile-toggle aria-haspopup="menu" aria-expanded="false">
        <span>Profile</span>
        <span class="profile-chevron" aria-hidden="true">⌄</span>
      </button>

      <div class="profile-dropdown" data-profile-menu role="menu" hidden>
        <div class="profile-dropdown-user">Signed in as ${name}</div>
        <a href="#profile" role="menuitem">Profile</a>
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
