import { escapeHtml } from '../utils.js';

/**
 * Shared dashboard page shell, equivalent to a Laravel application layout.
 * Feature renderers supply named slots. Keep the existing class names and
 * data attributes: dashboard navigation, server switching and mobile
 * enhancements bind to them.
 *
 * @param {{serverId?: string, demoBanner?: string, dashboardHref: string,
 *   serverCard: string, navigation: string, topbar: string,
 *   breadcrumb: string, content: string}} slots
 */
export function renderDashboardShell({
  serverId = '',
  demoBanner = '',
  dashboardHref,
  serverCard,
  navigation,
  topbar,
  breadcrumb,
  content,
}) {
  return `
    <div class="dash-shell" ${serverId ? `data-dashboard-server-shell="${escapeHtml(serverId)}"` : ''}>${demoBanner}
      <aside class="dash-sidebar" aria-label="Dashboard navigation">
        <div class="dash-brand-row">
          <a class="dash-brand" href="${escapeHtml(dashboardHref)}"><span class="dash-brand-mark">M</span><strong>Meowz</strong></a>
          <a class="dash-round-action" href="/">+</a>
        </div>
        ${serverCard}
        ${navigation}
        <div class="dash-help-card"><strong>Need help?</strong><span>Open the documentation while the support server is being prepared.</span><a href="/docs">View docs</a></div>
      </aside>
      <div class="dash-main">
        ${topbar}
        ${breadcrumb}
        <div class="dash-content">
          ${content}
        </div>
      </div>
    </div>
  `;
}
