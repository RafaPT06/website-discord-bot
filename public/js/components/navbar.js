import { isDemoRoute } from '../demoData.js';
import { MAIN_NAV_ITEMS } from './navConfig.js';
import { renderMobileDrawer } from './mobileDrawer.js';

function authMarkup(demo, scope = 'desktop') {
  const initialAuthText = demo ? 'Loading demo...' : 'Checking login...';
  const initialAuthClass = demo ? 'auth-area auth-loading is-demo' : 'auth-area auth-loading';
  return `<div class="${initialAuthClass}" data-auth-area data-auth-scope="${scope}">${initialAuthText}</div>`;
}

function itemHref(item, demo = false) {
  if (!demo) return item.href;
  if (item.route === '/dashboard') return '/demo/dashboard';
  if (item.route === '/settings' || item.route === '/dashboard/settings') return '/demo/settings';
  return item.href;
}

function desktopNavLink(item, demo = false) {
  const authAttr = item.auth && !demo ? ' data-auth-only hidden' : '';
  return `<a href="${itemHref(item, demo)}" data-nav-link data-route="${item.route}"${authAttr}>${item.label}</a>`;
}

function renderDesktopNav(demo = false) {
  return `
    <nav class="desktop-nav-links" data-desktop-nav-links aria-label="Main navigation">
      ${MAIN_NAV_ITEMS.filter((item) => item.route !== '/dashboard/settings').map((item) => desktopNavLink(item, demo)).join('')}
      ${authMarkup(demo, 'desktop')}
    </nav>
  `;
}

export function renderNavbar() {
  const demo = isDemoRoute();
  return `
    <header class="nav" data-global-navbar>
      <a class="brand" href="/" aria-label="Meowz home">
        <span class="brand-icon" data-bot-avatar-small>M</span>
        <span data-bot-name-short>Meowz</span>
      </a>
      ${renderDesktopNav(demo)}
      <button class="mobile-menu-button" type="button" data-menu-toggle aria-label="Open navigation" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      ${renderMobileDrawer({ demo, initialAuthHtml: authMarkup(demo, 'mobile') })}
    </header>
  `;
}

export function mountNavbar() {
  const current = document.querySelector('header.nav, [data-global-navbar]');
  if (current) {
    current.outerHTML = renderNavbar();
    return;
  }
  const glows = document.querySelectorAll('.bg-glow');
  const anchor = glows.length ? glows[glows.length - 1] : null;
  if (anchor) anchor.insertAdjacentHTML('afterend', renderNavbar());
  else document.body.insertAdjacentHTML('afterbegin', renderNavbar());
}
