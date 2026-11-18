import { escapeHtml } from '../utils.js';

/** Reusable sidebar identity card for the dashboard's server list. */
export function renderDashboardCard({ dashboardHref }) {
  return `<a class="dash-current-server" href="${escapeHtml(dashboardHref)}"><span class="dash-current-icon">M</span><span><strong>Meowz Dashboard</strong><small>Server manager</small></span></a>`;
}

/** Reusable current-server card; caller supplies the existing icon renderer. */
export function renderCurrentServerCard({ serverHref, serverIconMarkup, serverName }) {
  return `<a class="dash-current-server" href="${escapeHtml(serverHref)}">${serverIconMarkup}<span><strong>${escapeHtml(serverName)}</strong><small>Server Settings</small></span><em>⌄</em></a>`;
}

function navLink({ href, key, active, label }) {
  return `<a class="${key === active ? 'is-active' : ''}" href="${escapeHtml(href)}"><span></span>${escapeHtml(label)}</a>`;
}
function navGroup(label, links, muted = false) {
  return `<nav class="dash-side-nav${muted ? ' muted' : ''}"><small>${escapeHtml(label)}</small>${links.map(navLink).join('')}</nav>`;
}

/**
 * Navigation is data-driven so new dashboard sections only need a menu entry.
 * The original markup is intentionally preserved for the existing CSS,
 * server-switcher, and responsive navigation listeners.
 */
export function renderDashboardSidebarNav({
  serverSections = null,
  active,
  dashboardHref,
  settingsHref,
}) {
  const resources = [
    { href: '/docs', key: 'docs', active, label: 'Documentation' },
    { href: '/changelog', key: 'changelog', active, label: 'Changelog' },
  ];
  if (serverSections) {
    const sections = serverSections.map((item) => ({ ...item, active }));
    return navGroup('Dashboard', sections)
      + navGroup('Resources', resources, true)
      + navGroup('Account', [{ href: settingsHref, key: 'settings', active, label: 'Settings' }], true);
  }
  return navGroup('Dashboard', [
    { href: dashboardHref, key: 'dashboard', active, label: 'Overview' },
    { href: settingsHref, key: 'settings', active, label: 'Settings' },
  ]) + navGroup('Resources', resources, true);
}
