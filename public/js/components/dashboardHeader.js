import { escapeHtml } from '../utils.js';

/** Shared breadcrumb markup for desktop and mobile dashboard headers. */
function breadcrumbItems({ dashboardHref, serverHref, serverName, active, rootLabel }) {
  const isOverview = active === 'Overview';
  return `<a href="${escapeHtml(dashboardHref)}">${escapeHtml(rootLabel)}</a>${serverHref ? `<span>›</span><a href="${escapeHtml(serverHref)}">${escapeHtml(serverName)}</a><span data-dashboard-active-separator ${isOverview ? 'hidden' : ''}>›</span><strong data-dashboard-active-crumb ${isOverview ? 'hidden' : ''}>${escapeHtml(active)}</strong>` : ''}`;
}

export function renderDashboardBreadcrumb({ dashboardHref, serverHref, serverName, active }) {
  return `<div class="dash-mobile-breadcrumb">${breadcrumbItems({ dashboardHref, serverHref, serverName, active, rootLabel: 'Dashboard' })}</div>`;
}

/**
 * Desktop header accepts ready-to-render owner/avatar slots from the dashboard
 * controller, keeping auth and view-mode state outside this UI component.
 */
export function renderDashboardTopbar({
  dashboardHref, serverHref, serverName, active,
  ownerToggleMarkup = '', settingsHref, avatarMarkup,
  displayName, username,
}) {
  return `
    <header class="dash-topbar">
      <div class="dash-breadcrumb">${breadcrumbItems({ dashboardHref, serverHref, serverName, active, rootLabel: 'Servers' })}</div>
      <div class="dash-top-actions">
        ${ownerToggleMarkup}
        ${serverHref ? '<a class="dash-primary-small" href="/">View Bot</a>' : ''}
        <a class="dash-user-pill" href="${escapeHtml(settingsHref)}">${avatarMarkup}<span><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(username)}</small></span><em>OWNER</em></a>
      </div>
    </header>`;
}
