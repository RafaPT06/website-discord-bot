const STATUS_MESSAGES = {
  auth: {
    success: ['Login successful', 'Discord account connected successfully.'],
    error: ['Login failed', 'Could not complete Discord login.'],
  },
  logout: {
    success: ['Logged out', 'You have been signed out successfully.'],
  },
};

let toastHost = null;
let placementObserver = null;
let saveResizeObserver = null;
let observedSaveBar = null;
let placementFrame = 0;

function visibleSaveBar() {
  return [...document.querySelectorAll('.dash-save-bar[data-global-save-bar]')]
    .find((bar) => bar.isConnected && bar.getClientRects().length) || null;
}

function syncToastLift() {
  const bar = visibleSaveBar();
  if (bar !== observedSaveBar) {
    saveResizeObserver?.disconnect();
    observedSaveBar = bar;
    if (bar && typeof ResizeObserver !== 'undefined') {
      saveResizeObserver = new ResizeObserver(scheduleToastPlacement);
      saveResizeObserver.observe(bar);
    }
  }

  const height = bar ? Math.ceil(bar.getBoundingClientRect().height + 9) : 0;
  document.documentElement.style.setProperty('--dashboard-toast-lift', `${height}px`);
}

function placeToastHost() {
  placementFrame = 0;
  if (!toastHost || !document.body) return;
  if (toastHost.parentElement !== document.body) document.body.appendChild(toastHost);
  syncToastLift();
}

function scheduleToastPlacement() {
  if (placementFrame) return;
  placementFrame = requestAnimationFrame(placeToastHost);
}

function startPlacementObserver() {
  if (placementObserver || !document.body) return;
  placementObserver = new MutationObserver(scheduleToastPlacement);
  placementObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', scheduleToastPlacement, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleToastPlacement, { passive: true });
}

function ensureToastHost() {
  if (!toastHost) toastHost = document.querySelector('[data-toast-host]');
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    toastHost.setAttribute('data-toast-host', '');
    toastHost.setAttribute('aria-live', 'polite');
    toastHost.setAttribute('aria-atomic', 'false');
  }
  if (toastHost.parentElement !== document.body) document.body.appendChild(toastHost);
  startPlacementObserver();
  scheduleToastPlacement();
  return toastHost;
}

function createToast(type, title, message) {
  const toast = document.createElement('div');
  toast.className = `status-toast status-toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const indicator = document.createElement('div');
  indicator.className = 'status-toast-indicator';
  indicator.setAttribute('aria-hidden', 'true');

  const copy = document.createElement('div');
  const heading = document.createElement('strong');
  heading.textContent = String(title || 'Status updated');
  copy.appendChild(heading);
  if (message) {
    const detail = document.createElement('span');
    detail.textContent = String(message);
    copy.appendChild(detail);
  }

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.textContent = '×';

  toast.append(indicator, copy, dismiss);
  return { toast, dismiss };
}

export function showStatusToast(type = 'info', title = 'Status updated', message = '') {
  const host = ensureToastHost();
  const { toast, dismiss } = createToast(type, title, message);
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    toast.classList.add('is-leaving');
    setTimeout(() => {
      toast.remove();
      scheduleToastPlacement();
    }, 180);
  };

  dismiss.addEventListener('click', close);
  host.appendChild(toast);
  scheduleToastPlacement();
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(close, 5000);
}

function removeHandledParams(params) {
  ['auth', 'logout', 'message'].forEach((key) => params.delete(key));
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', next);
}

export function initStatusToasts() {
  ensureToastHost();
  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  const logout = params.get('logout');
  const customMessage = params.get('message');
  let shown = false;

  if (auth && STATUS_MESSAGES.auth[auth]) {
    const [title, message] = STATUS_MESSAGES.auth[auth];
    showStatusToast(auth === 'success' ? 'success' : 'error', title, customMessage || message);
    shown = true;
  }

  if (logout && STATUS_MESSAGES.logout[logout]) {
    const [title, message] = STATUS_MESSAGES.logout[logout];
    showStatusToast('success', title, message);
    shown = true;
  }

  if (shown) removeHandledParams(params);
}
