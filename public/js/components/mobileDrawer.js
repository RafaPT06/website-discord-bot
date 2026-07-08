import { MAIN_NAV_ITEMS } from './navConfig.js';

function itemHref(item, demo = false) {
  if (!demo) return item.href;
  if (item.route === '/dashboard') return '/demo/dashboard';
  if (item.route === '/settings' || item.route === '/dashboard/settings') return '/demo/settings';
  return item.href;
}

export function renderMobileDrawer({ demo = false, initialAuthHtml = '' } = {}) {
  const main = MAIN_NAV_ITEMS.filter((item) => !item.auth || item.route === '/dashboard')
    .map((item) => `<a class="mobile-drawer-link" href="${itemHref(item, demo)}" data-nav-link data-route="${item.route}"${item.auth && !demo ? ' data-auth-only hidden' : ''}>${item.label}</a>`)
    .join('');
  return `
    <nav class="nav-links mobile-drawer-panel" data-nav-links aria-label="Main navigation" aria-hidden="true">
      <div class="mobile-drawer-head">
        <a class="mobile-drawer-brand" href="/"><span class="brand-icon" data-bot-avatar-small>M</span><strong>Meowz</strong></a>
        <button class="mobile-drawer-close" type="button" data-menu-close aria-label="Close navigation">×</button>
      </div>
      <div class="mobile-drawer-section">
        <small>Menu</small>
        <div class="mobile-drawer-list">${main}</div>
      </div>
      <div class="mobile-drawer-account" data-mobile-drawer-account>
        <small>Account</small>
        ${initialAuthHtml}
      </div>
    </nav>`;
}
