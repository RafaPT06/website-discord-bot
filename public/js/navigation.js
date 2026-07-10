function getNavEls() {
  return {
    toggle: document.querySelector('[data-menu-toggle]'),
    dialog: document.querySelector('[data-mobile-nav-dialog]'),
    surface: document.querySelector('[data-mobile-nav-surface]'),
  };
}

function normalizeRoute(pathname = window.location.pathname) {
  if (pathname === '/' || pathname === '') return '/';
  if (pathname.startsWith('/demo/server/') || pathname.startsWith('/demo/dashboard')) return '/dashboard';
  if (pathname.startsWith('/dashboard/server/')) return '/dashboard';
  if (pathname === '/demo/settings') return '/dashboard/settings';
  if (pathname === '/dashboard/settings') return '/dashboard/settings';
  return pathname.replace(/\/$/, '');
}

let lastFocusedMenuTrigger = null;

function setDialogOpenState(isOpen) {
  const { toggle } = getNavEls();
  toggle?.classList.toggle('is-open', isOpen);
  toggle?.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('menu-open', isOpen);
}

function closeMobileMenu() {
  const { dialog } = getNavEls();
  if (!dialog?.open) {
    setDialogOpenState(false);
    return;
  }
  dialog.classList.remove('is-open');
  setDialogOpenState(false);
  dialog.close();
  lastFocusedMenuTrigger?.focus?.({ preventScroll: true });
}

function openMobileMenu() {
  const { toggle, dialog } = getNavEls();
  if (!dialog) return;
  lastFocusedMenuTrigger = toggle || document.activeElement;
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => dialog.classList.add('is-open'));
  setDialogOpenState(true);
  dialog.querySelector('[data-menu-close], a, button')?.focus?.({ preventScroll: true });
}

function setActiveRoute() {
  const path = normalizeRoute();
  document.querySelectorAll('[data-route]').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === path);
  });
}

export function initNavigation() {
  setActiveRoute();
  const { toggle, dialog, surface } = getNavEls();

  toggle?.addEventListener('click', () => {
    if (dialog?.open) closeMobileMenu();
    else openMobileMenu();
  });

  dialog?.addEventListener('click', (event) => {
    if (surface?.contains(event.target)) return;
    closeMobileMenu();
  });

  dialog?.addEventListener('close', () => setDialogOpenState(false));
  document.querySelectorAll('[data-menu-close]').forEach((btn) => btn.addEventListener('click', closeMobileMenu));
  document.querySelectorAll('[data-nav-link]').forEach((link) => link.addEventListener('click', closeMobileMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMobileMenu(); });
}
