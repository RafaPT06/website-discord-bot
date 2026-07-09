import { MAIN_NAV_ITEMS } from './navConfig.js';

function itemHref(item, demo = false) {
  if (!demo) return item.href;
  if (item.route === '/dashboard') return '/demo/dashboard';
  if (item.route === '/settings' || item.route === '/dashboard/settings') return '/demo/settings';
  return item.href;
}

function navRow(item, demo = false) {
  const authAttr = item.auth && !demo ? ' data-auth-only hidden' : '';
  return `<a class="mobile-drawer-link" href="${itemHref(item, demo)}" data-nav-link data-route="${item.route}"${authAttr}>
    <span>${item.label}</span>
  </a>`;
}

export function renderMobileDrawer({ demo = false, initialAuthHtml = '' } = {}) {
  const primaryItems = MAIN_NAV_ITEMS.filter((item) => item.route !== '/dashboard/settings');
  const accountItems = MAIN_NAV_ITEMS.filter((item) => item.route === '/dashboard/settings');

  return `
    <nav class="nav-links mobile-drawer-panel" data-nav-links aria-label="Main navigation" aria-hidden="true">
      <div class="mobile-drawer-head">
        <strong class="mobile-drawer-title">Menu</strong>
        <button class="mobile-drawer-close" type="button" data-menu-close aria-label="Close navigation">×</button>
      </div>

      <div class="mobile-drawer-body">
        <section class="mobile-drawer-section" aria-labelledby="drawer-menu-label">
          <small id="drawer-menu-label">Menu</small>
          <div class="mobile-drawer-list">
            ${primaryItems.map((item) => navRow(item, demo)).join('')}
          </div>
        </section>

        <section class="mobile-drawer-section mobile-drawer-account" data-mobile-drawer-account aria-labelledby="drawer-account-label">
          <small id="drawer-account-label">Account</small>
          <div class="mobile-drawer-list mobile-drawer-account-links">
            ${accountItems.map((item) => navRow(item, demo)).join('')}
          </div>
          ${initialAuthHtml}
        </section>
      </div>
    </nav>`;
}
