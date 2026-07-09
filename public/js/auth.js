import { escapeHtml } from './utils.js';
import { DEMO_USER, isDemoRoute } from './demoData.js';

function authAreaEls() { return Array.from(document.querySelectorAll('[data-auth-area]')); }
function authAreaEl() { return authAreaEls()[0] || null; }
function authOnlyEls() { return document.querySelectorAll('[data-auth-only]'); }
function dashboardSectionEl() { return document.querySelector('[data-dashboard]'); }
function dashboardGuestEl() { return document.querySelector('[data-dashboard-guest]'); }
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
  document.body.classList.toggle('dashboard-signed-in', Boolean(isVisible));
  document.body.classList.toggle('dashboard-signed-out', !isVisible);
  document.body.classList.remove('menu-open', 'dash-drawer-open');
  authOnlyEls().forEach((el) => {
    el.hidden = !isVisible;
  });

  const dashboardSection = dashboardSectionEl();
  const dashboardGuest = dashboardGuestEl();
  if (dashboardSection) dashboardSection.hidden = !isVisible;
  if (dashboardGuest) dashboardGuest.hidden = isVisible;
}

function closeProfileMenus(exceptWrap = null) {
  document.querySelectorAll('.profile-menu-wrap').forEach((wrap) => {
    if (exceptWrap && wrap === exceptWrap) return;
    const menu = wrap.querySelector('[data-profile-menu]');
    const button = wrap.querySelector('[data-profile-toggle]');
    if (!menu || !button) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  });
}

function toggleProfileMenu(button) {
  const wrap = button?.closest?.('.profile-menu-wrap');
  const menu = wrap?.querySelector('[data-profile-menu]');
  if (!menu || !button) return;
  const willOpen = menu.hidden;
  closeProfileMenus(wrap);
  menu.hidden = !willOpen;
  button.setAttribute('aria-expanded', String(willOpen));
}

function renderDashboard(user) {
  const dashboardSection = dashboardSectionEl();
  if (!dashboardSection) return;

  const name = displayName(user);
  const username = usernameText(user);
  const avatar = avatarUrl(user, 128);

  const title = dashboardSection.querySelector('[data-dashboard-title]');
  const avatarEl = dashboardSection.querySelector('[data-dashboard-avatar]');
  const nameEl = dashboardSection.querySelector('[data-dashboard-name]');
  const usernameEl = dashboardSection.querySelector('[data-dashboard-username]');
  const idEl = dashboardSection.querySelector('[data-dashboard-id]');

  if (title) title.textContent = `Welcome back, ${name}`;
  if (nameEl) nameEl.textContent = name;
  if (usernameEl) usernameEl.textContent = username;
  if (idEl) idEl.textContent = user?.id || '—';

  if (avatarEl) {
    avatarEl.textContent = avatar ? '' : (name.slice(0, 1).toUpperCase() || 'U');
    avatarEl.classList.toggle('has-image', Boolean(avatar));
    avatarEl.style.backgroundImage = avatar ? `url(${avatar})` : '';
  }
}

function renderDemoUser() {
  activeUser = { ...DEMO_USER };
  setAuthOnlyVisible(true);
  document.body.classList.add('demo-mode');
  document.querySelectorAll('[data-route="/dashboard"]').forEach((link) => { link.href = '/demo/dashboard'; link.hidden = false; });
  document.querySelectorAll('[data-route="/dashboard/settings"]').forEach((link) => { link.href = '/demo/settings'; });
  renderDashboard(activeUser);
  const dashboardGuest = dashboardGuestEl();
  if (dashboardGuest) {
    dashboardGuest.hidden = true;
    dashboardGuest.setAttribute('aria-hidden', 'true');
  }

  const markup = `
    <div class="profile-menu-wrap">
      <a class="nav-user-button" href="/demo/settings" aria-label="Demo settings">
        ${renderAvatar(activeUser)}
        <span class="nav-user-text"><span class="nav-user-name">Demo User</span><span class="nav-user-subtitle">Demo Mode</span></span>
      </a>
    </div>
    <div class="mobile-account-panel"><a class="logout-link" href="/">Exit Demo</a></div>
  `;
  authAreaEls().forEach((authArea) => {
    authArea.className = 'auth-area is-authenticated is-demo';
    authArea.innerHTML = markup;
  });
}

function renderLoggedOut() {
  activeUser = null;
  setAuthOnlyVisible(false);

  authAreaEls().forEach((authArea) => {
    authArea.className = 'auth-area';
    authArea.innerHTML = '<a class="login-button" href="/auth/discord">Login with Discord</a>';
  });
}

function renderLoggedIn(user) {
  activeUser = user;
  setAuthOnlyVisible(true);
  renderDashboard(user);

  const name = escapeHtml(displayName(user));
  const username = escapeHtml(usernameText(user));

  const markup = `
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
        <div class="profile-dropdown-header">
          ${renderAvatar(user, 'profile-dropdown-avatar')}
          <div>
            <strong>${name}</strong>
            <span>${username}</span>
          </div>
        </div>
        <a href="/dashboard/settings" role="menuitem">Settings</a>
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
      <a class="logout-link" href="/auth/logout">Logout</a>
    </div>
  `;

  authAreaEls().forEach((authArea) => {
    authArea.className = 'auth-area is-authenticated';
    authArea.innerHTML = markup;
    const toggle = authArea.querySelector('[data-profile-toggle]');
    toggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleProfileMenu(toggle);
    });
  });
}

export async function initAuth() {
  if (!authAreaEls().length) return { authenticated: false, user: null, demo: false };

  if (isDemoRoute()) {
    renderDemoUser();
    window.dispatchEvent(new CustomEvent('meowz:auth-ready', { detail: { authenticated: false, user: DEMO_USER, demo: true } }));
    return { authenticated: false, user: DEMO_USER, demo: true };
  }

  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    const data = await res.json();

    if (data?.authenticated && data?.user) {
      renderLoggedIn(data.user);
      window.dispatchEvent(new CustomEvent('meowz:auth-ready', { detail: { authenticated: true, user: data.user } }));
      return { authenticated: true, user: data.user };
    }

    renderLoggedOut();
    window.dispatchEvent(new CustomEvent('meowz:auth-ready', { detail: { authenticated: false, user: null } }));
    return { authenticated: false, user: null };
  } catch {
    renderLoggedOut();
    window.dispatchEvent(new CustomEvent('meowz:auth-ready', { detail: { authenticated: false, user: null } }));
    return { authenticated: false, user: null };
  }
}

document.addEventListener('click', (event) => {
  const menuWrap = event.target.closest?.('.profile-menu-wrap');
  if (!menuWrap) closeProfileMenus();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeProfileMenus();
});

export function getActiveUser() {
  return activeUser;
}
