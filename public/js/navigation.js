import { navEls } from './dom.js';

export function closeMobileMenu() {
  navEls.toggle?.classList.remove('is-open');
  navEls.links?.classList.remove('is-open');
  navEls.toggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

export function initNavigation() {
  navEls.toggle?.addEventListener('click', () => {
    const isOpen = navEls.links?.classList.toggle('is-open');
    navEls.toggle.classList.toggle('is-open', Boolean(isOpen));
    navEls.toggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
    document.body.classList.toggle('menu-open', Boolean(isOpen));
  });

  document.querySelectorAll('[data-nav-link]').forEach((link) => link.addEventListener('click', closeMobileMenu));
}
