import { setText } from './utils.js';

const els = {
  backdrop: document.querySelector('[data-page-modal]'),
  modal: document.querySelector('[data-page-modal] .page-modal'),
  range: document.querySelector('[data-page-modal-range]'),
  input: document.querySelector('[data-page-modal-input]'),
  grid: document.querySelector('[data-page-modal-grid]'),
  close: document.querySelector('[data-page-modal-close]'),
  cancel: document.querySelector('[data-page-modal-cancel]'),
  go: document.querySelector('[data-page-modal-go]'),
};

let onSelectPage = null;
let returnFocusTo = null;

function isOpen() {
  return Boolean(els.backdrop && !els.backdrop.hidden);
}

function focusableElements() {
  if (!els.modal) return [];
  return [...els.modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.getClientRects().length > 0);
}

export function closePageModal({ restoreFocus = true } = {}) {
  if (!els.backdrop || !isOpen()) return;
  els.backdrop.hidden = true;
  els.backdrop.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');

  const target = returnFocusTo;
  returnFocusTo = null;
  if (restoreFocus && target?.isConnected) requestAnimationFrame(() => target.focus());
}

export function openPageModal({ currentPage, totalPages, onSelect }) {
  if (!els.backdrop || !els.input || !els.grid) return;
  onSelectPage = onSelect;
  returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  els.backdrop.hidden = false;
  els.backdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  if (els.modal) els.modal.scrollTop = 0;
  setText(els.range, `Choose a page from 1 to ${totalPages}`);
  els.input.min = '1';
  els.input.max = String(totalPages);
  els.input.value = String(currentPage);

  els.grid.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const active = page === currentPage ? 'active' : '';
    return `<button class="${active}" type="button" data-modal-page="${page}" aria-pressed="${page === currentPage ? 'true' : 'false'}">${page}</button>`;
  }).join('');

  requestAnimationFrame(() => {
    els.input?.focus();
    els.input?.select();
  });
}

function goToModalPage() {
  if (!els.input || !onSelectPage) return;
  const totalPages = Number.parseInt(els.input.max || '1', 10);
  const page = Number.parseInt(els.input.value, 10);
  if (!Number.isFinite(page)) return;
  onSelectPage(Math.min(totalPages, Math.max(1, page)));
  closePageModal();
}

function trapFocus(event) {
  if (event.key !== 'Tab' || !isOpen()) return;
  const focusable = focusableElements();
  if (!focusable.length) {
    event.preventDefault();
    els.modal?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function initPageModal() {
  els.backdrop?.setAttribute('aria-hidden', els.backdrop.hidden ? 'true' : 'false');
  els.close?.addEventListener('click', () => closePageModal());
  els.cancel?.addEventListener('click', () => closePageModal());
  els.go?.addEventListener('click', goToModalPage);
  els.backdrop?.addEventListener('click', (event) => {
    if (event.target === els.backdrop) closePageModal();
  });
  els.input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') goToModalPage();
  });
  els.grid?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-modal-page]');
    if (!button) return;
    els.input.value = button.dataset.modalPage;
    els.grid.querySelectorAll('button').forEach((btn) => {
      const active = btn === button;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  });
  document.addEventListener('keydown', (event) => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePageModal();
      return;
    }
    trapFocus(event);
  });
}
