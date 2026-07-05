function getNavEls() {
  return {
    toggle: document.querySelector('[data-menu-toggle]'),
    links: document.querySelector('[data-nav-links]'),
  };
}

function normalizeRoute(pathname = window.location.pathname) {
  if (pathname === '/' || pathname === '') return '/';
  if (pathname.startsWith('/dashboard/server/')) return '/dashboard';
  if (pathname === '/dashboard/settings') return '/dashboard/settings';
  return pathname.replace(/\/$/, '');
}

function closeMobileMenu() {
  const { toggle, links } = getNavEls();
  toggle?.classList.remove('is-open');
  links?.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

function setActiveRoute() {
  const path = normalizeRoute();
  document.querySelectorAll('[data-route]').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === path);
  });
}

export function initNavigation() {
  setActiveRoute();
  const { toggle, links } = getNavEls();
  toggle?.addEventListener('click', () => {
    const isOpen = links?.classList.toggle('is-open');
    toggle.classList.toggle('is-open', Boolean(isOpen));
    toggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
    document.body.classList.toggle('menu-open', Boolean(isOpen));
  });

  document.querySelectorAll('[data-nav-link]').forEach((link) => link.addEventListener('click', closeMobileMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMobileMenu(); });
}
