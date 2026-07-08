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
  links?.setAttribute('aria-hidden', 'true');
  toggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

function openMobileMenu() {
  const { toggle, links } = getNavEls();
  toggle?.classList.add('is-open');
  links?.classList.add('is-open');
  links?.setAttribute('aria-hidden', 'false');
  toggle?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
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
    if (links?.classList.contains('is-open')) closeMobileMenu();
    else openMobileMenu();
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
