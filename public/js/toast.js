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
let placementFrame = 0;

function activeSaveHost() {
  return Array.from(document.querySelectorAll('[data-server-save-host]'))
    .find((host) => host.querySelector('.dash-save-bar[data-global-save-bar]')) || null;
}

function placeToastHost() {
  placementFrame = 0;
  if (!toastHost) return;

  const saveHost = activeSaveHost();
  if (saveHost) {
    if (toastHost.parentElement !== saveHost || saveHost.firstElementChild !== toastHost) {
      saveHost.prepend(toastHost);
    }
    return;
  }

  if (toastHost.parentElement !== document.body) {
    document.body.appendChild(toastHost);
  }
}

function scheduleToastPlacement() {
  if (placementFrame) return;
  placementFrame = requestAnimationFrame(placeToastHost);
}

function startPlacementObserver() {
  if (placementObserver || !document.body) return;
  placementObserver = new MutationObserver(scheduleToastPlacement);
  placementObserver.observe(document.body, { childList: true, subtree: true });
}

function ensureToastHost() {
  if (!toastHost) {
    toastHost = document.querySelector('[data-toast-host]');
  }

  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    toastHost.setAttribute('data-toast-host', '');
    toastHost.setAttribute('aria-live', 'polite');
    toastHost.setAttribute('aria-atomic', 'false');
    document.body.appendChild(toastHost);
  }

  startPlacementObserver();
  placeToastHost();
  return toastHost;
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
      scheduleToastPlacement();
    }, 180);
  };

  toast.querySelector('button')?.addEventListener('click', close);
  host.appendChild(toast);
  scheduleToastPlacement();

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
    toast.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  setTimeout(close, 4200);
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
