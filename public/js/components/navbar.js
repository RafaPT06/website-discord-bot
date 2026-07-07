import { MAIN_NAV_ITEMS } from './navConfig.js';
import { isDemoRoute } from '../demoData.js';

function navLink(item) {
  const authAttrs = item.auth ? ' data-auth-only hidden' : '';
  return `<a href="${item.href}" data-nav-link data-route="${item.route}"${authAttrs}>${item.label}</a>`;
}

export function renderNavbar() {
  const demo = isDemoRoute();
  const initialAuthText = demo ? 'Loading demo...' : 'Checking login...';
  const initialAuthClass = demo ? 'auth-area auth-loading is-demo' : 'auth-area auth-loading';
  return `
    <header class="nav" data-global-navbar>
      <a class="brand" href="/" aria-label="Meowz home">
        <span class="brand-icon" data-bot-avatar-small>M</span>
        <span data-bot-name-short>Meowz</span>
      </a>
      <button class="mobile-menu-button" type="button" data-menu-toggle aria-label="Open navigation" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <nav class="nav-links" data-nav-links aria-label="Main navigation">
        ${MAIN_NAV_ITEMS.map(navLink).join('')}
        <div class="${initialAuthClass}" data-auth-area>${initialAuthText}</div>
      </nav>
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
