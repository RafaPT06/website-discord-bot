function getNavEls() {
  return {
    toggle: document.querySelector('[data-menu-toggle]'),
    close: document.querySelector('[data-menu-close]'),
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
  document.querySelector('[data-menu-close]')?.addEventListener('click', closeMobileMenu);
  document.addEventListener('click', (event) => {
    const { toggle, links } = getNavEls();
    if (!document.body.classList.contains('menu-open')) return;
    if (links?.contains(event.target) || toggle?.contains(event.target)) return;
    closeMobileMenu();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMobileMenu(); });
}
