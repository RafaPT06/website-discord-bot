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

function guildIconUrl(guild, size = 80) {
  if (!guild?.id || !guild?.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=${size}`;
}

function canInviteGuild(guild) {
  if (typeof guild?.canManage === 'boolean') return guild.canManage;
  const permissions = BigInt(guild?.permissions || '0');
  const manageGuild = 1n << 5n;
  const administrator = 1n << 3n;
  return Boolean((permissions & manageGuild) || (permissions & administrator) || guild?.owner);
}

function inviteUrl(guildId = '') {
  const clientId = window.MEOWZ_CLIENT_ID || '1408079699548307627';
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('permissions', '8');
  url.searchParams.set('scope', 'bot applications.commands');
  if (guildId) {
    url.searchParams.set('guild_id', guildId);
    url.searchParams.set('disable_guild_select', 'true');
  }
  return url.toString();
}

function setAuthOnlyVisible(isVisible) {
  authOnlyEls.forEach((el) => {
    el.hidden = !isVisible;
  });

  if (dashboardSection) dashboardSection.hidden = !isVisible;
  if (dashboardGuest) dashboardGuest.hidden = isVisible;
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

function renderGuildIcon(guild) {
  const icon = guildIconUrl(guild);
  const name = guild?.name || 'Server';
  if (icon) return `<span class="server-icon"><img src="${icon}" alt="" loading="lazy" /></span>`;
  return `<span class="server-icon server-icon-fallback">${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
}

function serverRow(guild, mode = 'manage') {
  const name = escapeHtml(guild?.name || 'Unknown server');
  const subtitle = mode === 'manage' ? 'Meowz is already in this server.' : 'You have permission to add Meowz here.';
  const action = mode === 'manage'
    ? `<a class="server-row-action" href="/dashboard/server/${guild.id}" aria-label="Manage ${name}">›</a>`
    : `<a class="server-row-action add" href="${inviteUrl(guild.id)}" target="_blank" rel="noopener" aria-label="Add Meowz to ${name}">+</a>`;

  return `
    <article class="server-row">
      ${renderGuildIcon(guild)}
      <div class="server-row-main">
        <strong>${name}</strong>
        <span>${subtitle}</span>
      </div>
      ${action}
    </article>
  `;
}

function emptyServerState(title, text, action = '') {
  return `
    <div class="server-empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
      ${action}
    </div>
  `;
}

async function loadDashboardServers() {
  const managedWrap = document.querySelector('[data-managed-servers]');
  const availableWrap = document.querySelector('[data-available-servers]');
  if (!managedWrap || !availableWrap) return;

  managedWrap.innerHTML = `
    <div class="server-row skeleton-server"><span></span><div><b></b><i></i></div></div>
    <div class="server-row skeleton-server"><span></span><div><b></b><i></i></div></div>
  `;
  availableWrap.innerHTML = `
    <div class="server-row skeleton-server"><span></span><div><b></b><i></i></div></div>
    <div class="server-row skeleton-server"><span></span><div><b></b><i></i></div></div>
  `;

  try {
    const response = await fetch('/api/user-guilds', { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.authenticated) throw new Error(data?.error || 'Could not load servers.');

    const withBot = Array.isArray(data.withBot) ? data.withBot : [];
    const available = Array.isArray(data.available) ? data.available : [];
    const allManageableCount = Number(data.manageableCount || withBot.length + available.length || 0);
    const detectionUnavailable = data.botGuildDetection !== 'active';

    managedWrap.innerHTML = withBot.length
      ? withBot.map((guild) => serverRow(guild, 'manage')).join('')
      : emptyServerState(
          detectionUnavailable ? 'Server detection is not fully connected yet.' : 'No servers with Meowz found.',
          detectionUnavailable
            ? 'The dashboard needs the bot API /api/guilds endpoint or BOT_GUILD_IDS to detect where Meowz is installed.'
            : 'Servers where Meowz is installed and you can manage them will appear here.',
          `<a class="mini-action" href="${inviteUrl()}" target="_blank" rel="noopener">Invite Meowz</a>`
        );

    availableWrap.innerHTML = available.length
      ? available.map((guild) => serverRow(guild, 'invite')).join('')
      : emptyServerState(
          allManageableCount ? 'No available servers to invite.' : 'No manageable servers found.',
          allManageableCount
            ? 'Every manageable server we can detect already has Meowz, or server detection needs the bot guild list.'
            : 'Only servers where you have Manage Server permission are shown here. Try logging out and logging in again if this looks wrong.'
        );
  } catch (err) {
    managedWrap.innerHTML = emptyServerState('Could not load your servers.', err.message || 'Try refreshing the page.');
    availableWrap.innerHTML = emptyServerState('Could not load available servers.', 'Try refreshing the page or log in again.');
  }
}

function renderDashboard(user) {
  if (!dashboardSection) return;

  const name = displayName(user);
  const username = usernameText(user);

  const title = dashboardSection.querySelector('[data-dashboard-title]');
  const subtitle = dashboardSection.querySelector('[data-dashboard-subtitle]');

  if (title) title.textContent = `Welcome back, ${name}`;
  if (subtitle) subtitle.textContent = 'Choose a server to manage or add Meowz to a new one.';

  loadDashboardServers();
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
        <a href="/dashboard" role="menuitem">Dashboard</a>
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
      <a href="/dashboard">Dashboard</a>
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
