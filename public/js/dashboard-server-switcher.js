import { getDashboardGuilds } from './api.js';

const SNAPSHOT_KEY = 'meowzDashboardServerSnapshots';
const VIEW_MODE_KEY = 'meowzDashboardViewMode';
let request = null;
let enhanceQueued = false;
let activeMenu = null;

function isDemo() {
  return window.location.pathname.startsWith('/demo');
}

function currentGuildId() {
  const match = window.location.pathname.match(/\/(?:dashboard\/server|demo\/server)\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function dashboardBase() {
  return isDemo() ? '/demo/dashboard' : '/dashboard';
}

function serverPath(id) {
  return `${isDemo() ? '/demo/server' : '/dashboard/server'}/${encodeURIComponent(id)}#overview`;
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readCachedServers() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY) || '{}');
    return Array.isArray(parsed?.servers) ? parsed.servers : [];
  } catch {
    return [];
  }
}

function cacheServers(servers) {
  if (!Array.isArray(servers) || !servers.length) return;
  try {
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      at: Date.now(),
      servers: servers.map((server) => ({ ...server })),
    }));
  } catch {
    // Session storage is only a performance enhancement.
  }
}

async function loadServers() {
  const cached = readCachedServers();
  if (cached.length) return cached;
  if (request) return request;

  const mode = localStorage.getItem(VIEW_MODE_KEY) === 'owner' ? 'owner' : 'user';
  request = getDashboardGuilds(mode)
    .then((data) => {
      const servers = Array.isArray(data?.installed) ? data.installed : [];
      cacheServers(servers);
      return servers;
    })
    .finally(() => {
      request = null;
    });

  return request;
}

function iconMarkup(server) {
  if (server?.iconUrl) {
    return `<span class="dash-switcher-icon"><img src="${esc(server.iconUrl)}" alt="" loading="lazy"></span>`;
  }
  const initial = esc(String(server?.name || 'M').trim().charAt(0).toUpperCase() || 'M');
  return `<span class="dash-switcher-icon dash-switcher-icon-fallback">${initial}</span>`;
}

function menuMarkup(servers, guildId) {
  const sorted = [...servers].sort((a, b) => {
    if (String(a.id) === String(guildId)) return -1;
    if (String(b.id) === String(guildId)) return 1;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const rows = sorted.length
    ? sorted.map((server) => {
      const current = String(server.id) === String(guildId);
      return `<a class="dash-switcher-server${current ? ' is-current' : ''}" href="${esc(serverPath(server.id))}" data-server-switcher-link data-server-id="${esc(server.id)}">
        ${iconMarkup(server)}
        <span><strong>${esc(server.name || 'Unnamed server')}</strong><small>${current ? 'Current server' : (server.manageable === false ? 'View only' : 'Manage server')}</small></span>
        <em>${current ? '✓' : '›'}</em>
      </a>`;
    }).join('')
    : '<div class="dash-switcher-empty"><strong>No other servers available</strong><span>Return to the dashboard to refresh your server list.</span></div>';

  return `<div class="dash-server-switcher-menu" data-server-switcher-menu role="dialog" aria-label="Switch Discord server">
    <div class="dash-switcher-head"><div><small>Meowz</small><strong>Switch server</strong></div><button type="button" data-server-switcher-close aria-label="Close server switcher">×</button></div>
    <div class="dash-switcher-list">${rows}</div>
    <a class="dash-switcher-all" href="${esc(dashboardBase())}">View all servers <span>→</span></a>
  </div>`;
}

function closeMenu() {
  if (!activeMenu) return;
  activeMenu.menu.hidden = true;
  activeMenu.trigger?.setAttribute('aria-expanded', 'false');
  activeMenu = null;
}

function hostForTrigger(trigger) {
  return trigger.closest('.dash-sidebar, .dash-mobile-bar') || trigger.closest('.dash-shell');
}

async function openMenu(trigger) {
  const guildId = currentGuildId();
  if (!guildId) return;
  const host = hostForTrigger(trigger);
  if (!host) return;

  if (activeMenu?.trigger === trigger && !activeMenu.menu.hidden) {
    closeMenu();
    return;
  }
  closeMenu();

  let menu = host.querySelector(':scope > [data-server-switcher-menu]');
  if (!menu) {
    const placeholder = document.createElement('div');
    placeholder.innerHTML = menuMarkup(readCachedServers(), guildId);
    menu = placeholder.firstElementChild;
    host.append(menu);
  }

  menu.hidden = false;
  menu.dataset.loading = 'true';
  trigger.setAttribute('aria-expanded', 'true');
  activeMenu = { menu, trigger };

  try {
    const servers = await loadServers();
    if (!activeMenu || activeMenu.menu !== menu) return;
    const replacement = document.createElement('div');
    replacement.innerHTML = menuMarkup(servers, guildId);
    const next = replacement.firstElementChild;
    host.replaceChild(next, menu);
    next.hidden = false;
    activeMenu = { menu: next, trigger };
  } catch (error) {
    if (!activeMenu || activeMenu.menu !== menu) return;
    menu.innerHTML = `<div class="dash-switcher-head"><div><small>Meowz</small><strong>Switch server</strong></div><button type="button" data-server-switcher-close aria-label="Close server switcher">×</button></div><div class="dash-switcher-empty"><strong>Could not load servers</strong><span>${esc(error.message || 'Try again from the dashboard.')}</span></div><a class="dash-switcher-all" href="${esc(dashboardBase())}">View all servers <span>→</span></a>`;
    delete menu.dataset.loading;
  }
}

function makeTrigger(element) {
  if (!element || element.dataset.serverSwitcherReady === 'true') return;
  element.dataset.serverSwitcherReady = 'true';
  element.dataset.serverSwitcherTrigger = 'true';
  element.setAttribute('aria-haspopup', 'dialog');
  element.setAttribute('aria-expanded', 'false');
  element.setAttribute('title', 'Switch server');
}

function enhance() {
  const shell = document.querySelector('.dash-shell[data-dashboard-server-shell]');
  if (!shell || !currentGuildId()) {
    closeMenu();
    return;
  }

  shell.querySelectorAll('.dash-sidebar .dash-brand, .dash-sidebar .dash-current-server, .dash-mobile-bar .dash-brand').forEach(makeTrigger);
}

function queueEnhance() {
  if (enhanceQueued) return;
  enhanceQueued = true;
  requestAnimationFrame(() => {
    enhanceQueued = false;
    enhance();
  });
}

document.addEventListener('click', async (event) => {
  const close = event.target.closest('[data-server-switcher-close]');
  if (close) {
    event.preventDefault();
    closeMenu();
    return;
  }

  const trigger = event.target.closest('[data-server-switcher-trigger]');
  if (trigger) {
    event.preventDefault();
    event.stopPropagation();
    await openMenu(trigger);
    return;
  }

  const serverLink = event.target.closest('[data-server-switcher-link]');
  if (serverLink) {
    const saveBar = document.querySelector('[data-global-save-bar]');
    if (saveBar && !window.confirm('You have unsaved changes. Switch servers and leave them unsaved?')) {
      event.preventDefault();
      return;
    }
    closeMenu();
    return;
  }

  if (activeMenu && !event.target.closest('[data-server-switcher-menu]')) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

window.addEventListener('hashchange', queueEnhance);
window.addEventListener('popstate', queueEnhance);

const observer = new MutationObserver(queueEnhance);
observer.observe(document.documentElement, { childList: true, subtree: true });
queueEnhance();
