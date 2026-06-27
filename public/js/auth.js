import { getBotStats } from './api.js';
import { escapeHtml } from './utils.js';

const authArea = document.querySelector('[data-auth-area]');
const authOnlyEls = document.querySelectorAll('[data-auth-only]');
const dashboardSection = document.querySelector('[data-dashboard]');
const dashboardGuest = document.querySelector('[data-dashboard-guest]');
let activeUser = null;

function avatarUrl(user, size = 96) {
  if (!user?.id || !user?.avatar) return null;
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

function displayName(user) {
  return user?.globalName || user?.username || 'Discord User';
}

function usernameText(user) {
  return user?.username ? `@${user.username}` : '@discord';
}

function renderAvatar(user, className = 'nav-user-avatar', size = 96) {
  const image = avatarUrl(user, size);
  const name = displayName(user);
  const fallback = escapeHtml(name.slice(0, 1).toUpperCase() || 'U');

  if (!image) {
    return `<span class="${className} ${className}-fallback" aria-hidden="true">${fallback}</span>`;
  }

  return `<span class="${className}" aria-hidden="true"><img src="${image}" alt="" loading="lazy" /></span>`;
}

function setAuthOnlyVisible(isVisible) {
  authOnlyEls.forEach((el) => {
    el.hidden = !isVisible;
  });

  if (dashboardSection) {
    dashboardSection.hidden = !isVisible;
  }
  if (dashboardGuest) {
    dashboardGuest.hidden = isVisible;
  }
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

function setDashboardText(selector, value) {
  const el = dashboardSection?.querySelector(selector);
  if (el) el.textContent = value;
}

async function loadDashboardStats() {
  if (!dashboardSection) return;

  try {
    const data = await getBotStats();
    if (!data?.ok) throw new Error(data?.error || 'Stats unavailable');

    setDashboardText('[data-dashboard-stat="servers"]', typeof data.servers === 'number' ? data.servers.toLocaleString() : '—');
    setDashboardText('[data-dashboard-stat="commands"]', typeof data.commands === 'number' ? data.commands.toLocaleString() : '—');
    setDashboardText('[data-dashboard-stat="status"]', data.online ? 'Online' : 'Offline');
    setDashboardText('[data-dashboard-stat="ping"]', typeof data.ping === 'number' ? `${data.ping}ms` : '—');
  } catch {
    setDashboardText('[data-dashboard-stat="servers"]', '—');
    setDashboardText('[data-dashboard-stat="commands"]', '—');
    setDashboardText('[data-dashboard-stat="status"]', 'API offline');
    setDashboardText('[data-dashboard-stat="ping"]', '—');
  }
}

function renderDashboard(user) {
  if (!dashboardSection) return;

  const name = displayName(user);
  const username = usernameText(user);
  const avatar = avatarUrl(user, 128);

  const title = dashboardSection.querySelector('[data-dashboard-title]');
  const avatarEl = dashboardSection.querySelector('[data-dashboard-avatar]');
  const nameEl = dashboardSection.querySelector('[data-dashboard-name]');
  const usernameEl = dashboardSection.querySelector('[data-dashboard-username]');

  if (title) title.textContent = `Welcome back, ${name}`;
  if (nameEl) nameEl.textContent = name;
  if (usernameEl) usernameEl.textContent = username;

  if (avatarEl) {
    avatarEl.textContent = avatar ? '' : (name.slice(0, 1).toUpperCase() || 'U');
    avatarEl.classList.toggle('has-image', Boolean(avatar));
    avatarEl.style.backgroundImage = avatar ? `url(${avatar})` : '';
  }

  loadDashboardStats();
}

function renderLoggedOut() {
  activeUser = null;
  setAuthOnlyVisible(false);

  if (!authArea) return;
  authArea.className = 'auth-area';
  authArea.innerHTML = '<a class="login-button" href="/auth/discord">Login with Discord</a>';
}

function renderLoggedIn(user) {
  activeUser = user;
  setAuthOnlyVisible(true);
  renderDashboard(user);

  if (!authArea) return;

  const name = escapeHtml(displayName(user));
  const username = escapeHtml(usernameText(user));

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

    <div class="mobile-account-panel">
      <div class="mobile-account-header">
        ${renderAvatar(user, 'mobile-account-avatar')}
        <div>
          <strong>${name}</strong>
          <span>${username}</span>
        </div>
      </div>
      <a href="#settings">Settings</a>
      <a class="logout-link" href="/auth/logout">Logout</a>
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
