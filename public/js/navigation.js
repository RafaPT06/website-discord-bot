function getNavEls() {
  return {
    toggle: document.querySelector('[data-menu-toggle]'),
    close: document.querySelector('[data-menu-close]'),
    dialog: document.querySelector('[data-mobile-nav-dialog]'),
    surface: document.querySelector('[data-mobile-nav-surface]'),
  };
}

function normalizeRoute(pathname = window.location.pathname) {
  if (pathname === '/' || pathname === '') return '/';
  if (pathname.startsWith('/demo/dashboard/server/')) return '/dashboard';
  if (pathname.startsWith('/dashboard/server/')) return '/dashboard';
  if (pathname === '/demo/settings') return '/dashboard/settings';
  if (pathname === '/dashboard/settings') return '/dashboard/settings';
  if (pathname === '/demo/dashboard') return '/dashboard';
  return pathname.replace(/\/$/, '');
}

function isDialogOpen(dialog) {
  return Boolean(dialog?.open || dialog?.classList.contains('is-open'));
}

function lockPageScroll(lock) {
  document.documentElement.classList.toggle('mobile-nav-open', lock);
  document.body.classList.toggle('mobile-nav-open', lock);
}

function focusFirstControl(dialog) {
  const first = dialog?.querySelector('[data-menu-close], a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
  if (first instanceof HTMLElement) first.focus({ preventScroll: true });
}

function closeMobileMenu({ restoreFocus = true } = {}) {
  const { toggle, dialog } = getNavEls();
  if (!dialog || !isDialogOpen(dialog)) return;

  dialog.classList.remove('is-opening', 'is-open');
  toggle?.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded', 'false');
  lockPageScroll(false);

  if (dialog.open) dialog.close();
  else dialog.removeAttribute('open');

  if (restoreFocus && toggle instanceof HTMLElement) toggle.focus({ preventScroll: true });
}

function openMobileMenu() {
  const { toggle, dialog } = getNavEls();
  if (!dialog || isDialogOpen(dialog)) return;

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');

  dialog.classList.add('is-opening');
  requestAnimationFrame(() => dialog.classList.add('is-open'));
  toggle?.classList.add('is-open');
  toggle?.setAttribute('aria-expanded', 'true');
  lockPageScroll(true);
  focusFirstControl(dialog);
}

function setActiveRoute() {
  const path = normalizeRoute();
  document.querySelectorAll('[data-route]').forEach((link) => {
    const isActive = link.dataset.route === path;
    link.classList.toggle('active', isActive);
    if (isActive && link.matches('a')) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function initNavigation() {
  setActiveRoute();

  const { toggle, close, dialog, surface } = getNavEls();

  toggle?.addEventListener('click', () => {
    if (isDialogOpen(dialog)) closeMobileMenu();
    else openMobileMenu();
  });

  close?.addEventListener('click', () => closeMobileMenu());

  dialog?.addEventListener('click', (event) => {
    if (!surface?.contains(event.target)) closeMobileMenu();
  });

  dialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMobileMenu();
  });

  dialog?.addEventListener('close', () => {
    const { toggle } = getNavEls();
    dialog.classList.remove('is-opening', 'is-open');
    toggle?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
    lockPageScroll(false);
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('[data-nav-link]');
    if (link) closeMobileMenu({ restoreFocus: false });
  });

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 821px)').matches) closeMobileMenu({ restoreFocus: false });
  });
}
