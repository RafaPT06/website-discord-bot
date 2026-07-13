const STATUS_MESSAGES = {
  auth: {
    success: ['Login successful', 'Discord account connected successfully.'],
    error: ['Login failed', 'Could not complete Discord login.'],
  },
  logout: {
    success: ['Logged out', 'You have been signed out successfully.'],
  },
};

let toastMutationObserver = null;
let saveBarResizeObserver = null;
let observedSaveBar = null;
let toastLayoutFrame = 0;
let viewportListenersBound = false;

function ensureToastHost() {
  let host = document.querySelector('[data-toast-host]');
  if (host) return host;
  host = document.createElement('div');
  host.className = 'toast-host';
  host.setAttribute('data-toast-host', '');
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-atomic', 'false');
  document.body.appendChild(host);
  return host;
}

function syncVisualViewportMetrics() {
  const viewport = window.visualViewport;
  const hiddenBottom = viewport
    ? Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop))
    : 0;
  document.documentElement.style.setProperty('--dashboard-visual-bottom-gap', `${Math.ceil(hiddenBottom)}px`);
}

function syncToastStackMetrics() {
  toastLayoutFrame = 0;
  syncVisualViewportMetrics();

  const saveBar = document.querySelector('.dash-save-bar[data-global-save-bar]');
  if (saveBar !== observedSaveBar) {
    saveBarResizeObserver?.disconnect();
    observedSaveBar = saveBar;
    if (saveBar && 'ResizeObserver' in window) {
      saveBarResizeObserver ||= new ResizeObserver(scheduleToastLayoutSync);
      saveBarResizeObserver.observe(saveBar);
    }
  }

  const saveHeight = saveBar ? Math.ceil(saveBar.getBoundingClientRect().height) : 0;
  const stackGap = saveHeight ? 12 : 0;
  document.documentElement.style.setProperty('--dashboard-toast-lift', `${saveHeight + stackGap}px`);
}

function scheduleToastLayoutSync() {
  if (toastLayoutFrame) return;
  toastLayoutFrame = requestAnimationFrame(syncToastStackMetrics);
}

function bindViewportListeners() {
  if (viewportListenersBound) return;
  viewportListenersBound = true;
  window.addEventListener('resize', scheduleToastLayoutSync, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleToastLayoutSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleToastLayoutSync, { passive: true });
  syncVisualViewportMetrics();
}

function startToastLayoutTracking() {
  bindViewportListeners();
  if (!toastMutationObserver && document.body) {
    toastMutationObserver = new MutationObserver(scheduleToastLayoutSync);
    toastMutationObserver.observe(document.body, { childList: true, subtree: true });
  }
  scheduleToastLayoutSync();
}

function stopToastLayoutTrackingIfIdle() {
  const host = document.querySelector('[data-toast-host]');
  if (host?.querySelector('.status-toast')) return;

  toastMutationObserver?.disconnect();
  toastMutationObserver = null;
  saveBarResizeObserver?.disconnect();
  observedSaveBar = null;
  document.documentElement.style.setProperty('--dashboard-toast-lift', '0px');
}

export function showStatusToast(type = 'info', title = 'Status updated', message = '') {
  const host = ensureToastHost();
  const toast = document.createElement('div');
  toast.className = `status-toast status-toast-${type}`;
  toast.innerHTML = `
    <div class="status-toast-indicator" aria-hidden="true"></div>
    <div>
      <strong>${title}</strong>
      ${message ? `<span>${message}</span>` : ''}
    </div>
    <button type="button" aria-label="Dismiss notification">×</button>
  `;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    toast.classList.add('is-leaving');
    setTimeout(() => {
      toast.remove();
      scheduleToastLayoutSync();
      stopToastLayoutTrackingIfIdle();
    }, 180);
  };

  toast.querySelector('button')?.addEventListener('click', close);
  host.appendChild(toast);
  startToastLayoutTracking();
  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
    scheduleToastLayoutSync();
  });
  setTimeout(close, 4200);
}

function removeHandledParams(params) {
  ['auth', 'logout', 'message'].forEach((key) => params.delete(key));
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', next);
}

export function initStatusToasts() {
  bindViewportListeners();

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