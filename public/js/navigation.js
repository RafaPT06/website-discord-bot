const navEls = {
  toggle: document.querySelector('[data-menu-toggle]'),
  links: document.querySelector('[data-nav-links]'),
};

function closeMobileMenu() {
  navEls.toggle?.classList.remove('is-open');
  navEls.links?.classList.remove('is-open');
  navEls.toggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

function setActiveRoute() {
  const path = window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/$/, '');
  document.querySelectorAll('[data-route]').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === path);
  });
}

export function initNavigation() {
  setActiveRoute();
  navEls.toggle?.addEventListener('click', () => {
    const isOpen = navEls.links?.classList.toggle('is-open');
    navEls.toggle.classList.toggle('is-open', Boolean(isOpen));
    navEls.toggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
    document.body.classList.toggle('menu-open', Boolean(isOpen));
  });

  document.querySelectorAll('[data-nav-link]').forEach((link) => link.addEventListener('click', closeMobileMenu));
}
