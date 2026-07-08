import { isDemoRoute } from '../demoData.js';
import { renderMobileDrawer } from './mobileDrawer.js';

function authMarkup(demo) {
  const initialAuthText = demo ? 'Loading demo...' : 'Checking login...';
  const initialAuthClass = demo ? 'auth-area auth-loading is-demo' : 'auth-area auth-loading';
  return `<div class="${initialAuthClass}" data-auth-area>${initialAuthText}</div>`;
}

export function renderNavbar() {
  const demo = isDemoRoute();
  return `
    <header class="nav" data-global-navbar>
      <a class="brand" href="/" aria-label="Meowz home">
        <span class="brand-icon" data-bot-avatar-small>M</span>
        <span data-bot-name-short>Meowz</span>
      </a>
      <button class="mobile-menu-button" type="button" data-menu-toggle aria-label="Open navigation" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      ${renderMobileDrawer({ demo, initialAuthHtml: authMarkup(demo) })}
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
