let currentAction = null;
let confirmText = '';
let returnFocus = null;

function dialog() {
  return document.querySelector('[data-dashboard-action-dialog]');
}

function close() {
  const element = dialog();
  if (element?.open) element.close();
  currentAction = null;
  confirmText = '';
  if (returnFocus?.isConnected) requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
  returnFocus = null;
}

export function openDashboardDialog(options = {}) {
  const element = dialog();
  if (!element) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  currentAction = options.onConfirm || null;
  confirmText = String(options.confirmText || '');

  element.querySelector('[data-action-label]').textContent = options.label || 'Confirm action';
  element.querySelector('[data-action-title]').textContent = options.title || 'Are you sure?';
  element.querySelector('[data-action-description]').textContent = options.description || '';
  element.querySelector('[data-action-icon]').textContent = options.icon || '!';

  const impact = element.querySelector('[data-action-impact]');
  impact.hidden = !options.impact;
  impact.textContent = options.impact || '';

  const field = element.querySelector('[data-action-confirm-field]');
  const input = element.querySelector('[data-action-confirm-input]');
  field.hidden = !confirmText;
  element.querySelector('[data-action-confirm-name]').textContent = confirmText;
  input.value = '';

  const submit = element.querySelector('[data-action-submit]');
  submit.textContent = options.confirmLabel || 'Confirm';
  submit.dataset.pendingLabel = options.pendingLabel || 'Working...';
  submit.disabled = Boolean(confirmText);

  element.showModal();
  requestAnimationFrame(() => (confirmText ? input : element.querySelector('[data-action-cancel]'))?.focus());
}

export function initDashboardDialog() {
  const element = dialog();
  if (!element || element.dataset.ready === 'true') return;
  element.dataset.ready = 'true';
  element.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  element.addEventListener('click', async (event) => {
    if (event.target === element || event.target.closest('[data-action-cancel]')) {
      close();
      return;
    }
    const submit = event.target.closest('[data-action-submit]');
    if (!submit || !currentAction) return;
    const action = currentAction;
    const original = submit.textContent;
    submit.disabled = true;
    submit.textContent = submit.dataset.pendingLabel || 'Working...';
    try {
      await action();
      close();
    } catch (error) {
      console.error('Dashboard action failed:', error);
      submit.disabled = false;
      submit.textContent = original;
    }
  });
  element.querySelector('[data-action-confirm-input]')?.addEventListener('input', (event) => {
    const submit = element.querySelector('[data-action-submit]');
    if (submit) submit.disabled = event.target.value !== confirmText;
  });
}
