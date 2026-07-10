import { MAIN_NAV_ITEMS } from './navConfig.js';

function itemHref(item, demo = false) {
  if (!demo) return item.href;
  if (item.route === '/dashboard') return '/demo/dashboard';
  if (item.route === '/settings' || item.route === '/dashboard/settings') return '/demo/settings';
  return item.href;
}

function navRow(item, demo = false) {
  const authAttr = item.auth && !demo ? ' data-auth-only hidden' : '';
  return `<a class="mobile-nav-link" href="${itemHref(item, demo)}" data-nav-link data-route="${item.route}"${authAttr}>${item.label}</a>`;
}

export function renderMobileNavDialog({ demo = false, initialAuthHtml = '' } = {}) {
  const primaryItems = MAIN_NAV_ITEMS.filter((item) => item.route !== '/dashboard/settings');
  const accountItems = MAIN_NAV_ITEMS.filter((item) => item.route === '/dashboard/settings');

  return `
    <dialog class="mobile-nav-dialog" id="mobile-nav" data-mobile-nav-dialog aria-labelledby="mobile-nav-title">
      <div class="mobile-nav-surface" data-mobile-nav-surface>
        <div class="mobile-nav-head">
          <a class="mobile-nav-brand" href="${demo ? '/demo' : '/'}" data-nav-link data-route="/" aria-label="Meowz home">
            <span class="brand-icon" data-bot-avatar-small>M</span>
            <span><small>Meowz</small><strong id="mobile-nav-title">Menu</strong></span>
          </a>
          <button class="mobile-nav-close" type="button" data-menu-close aria-label="Close navigation">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="mobile-nav-body">
          <section class="mobile-nav-section" aria-labelledby="mobile-nav-main-label">
            <small id="mobile-nav-main-label">Navigation</small>
            <div class="mobile-nav-list">
              ${primaryItems.map((item) => navRow(item, demo)).join('')}
            </div>
          </section>

          <section class="mobile-nav-section mobile-nav-account" aria-labelledby="mobile-nav-account-label">
            <small id="mobile-nav-account-label">Account</small>
            <div class="mobile-nav-list">
              ${accountItems.map((item) => navRow(item, demo)).join('')}
            </div>
            ${initialAuthHtml}
          </section>
        </div>
      </div>
    </dialog>`;
}
