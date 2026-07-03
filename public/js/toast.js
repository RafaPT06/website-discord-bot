const STATUS_MESSAGES = {
  auth: {
    success: ['Login successful', 'Discord account connected successfully.'],
    error: ['Login failed', 'Could not complete Discord login.'],
  },
  logout: {
    success: ['Logged out', 'You have been signed out successfully.'],
  },
};

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

  const close = () => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector('button')?.addEventListener('click', close);
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(close, 4200);
}

function removeHandledParams(params) {
  ['auth', 'logout', 'message'].forEach((key) => params.delete(key));
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', next);
}

export function initStatusToasts() {
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
