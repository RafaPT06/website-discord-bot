import { setText } from './utils.js';

const els = {
  backdrop: document.querySelector('[data-page-modal]'),
  range: document.querySelector('[data-page-modal-range]'),
  input: document.querySelector('[data-page-modal-input]'),
  grid: document.querySelector('[data-page-modal-grid]'),
  close: document.querySelector('[data-page-modal-close]'),
  cancel: document.querySelector('[data-page-modal-cancel]'),
  go: document.querySelector('[data-page-modal-go]'),
};

let onSelectPage = null;

export function closePageModal() {
  if (!els.backdrop) return;
  els.backdrop.hidden = true;
  document.body.classList.remove('modal-open');
}

export function openPageModal({ currentPage, totalPages, onSelect }) {
  if (!els.backdrop || !els.input || !els.grid) return;
  onSelectPage = onSelect;

  els.backdrop.hidden = false;
  document.body.classList.add('modal-open');
  setText(els.range, `Choose a page from 1 to ${totalPages}`);
  els.input.min = '1';
  els.input.max = String(totalPages);
  els.input.value = String(currentPage);

  els.grid.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const active = page === currentPage ? 'active' : '';
    return `<button class="${active}" type="button" data-modal-page="${page}">${page}</button>`;
  }).join('');

  setTimeout(() => els.input?.focus(), 0);
}

function goToModalPage() {
  if (!els.input || !onSelectPage) return;
  const totalPages = Number.parseInt(els.input.max || '1', 10);
  const page = Number.parseInt(els.input.value, 10);
  if (!Number.isFinite(page)) return;
  onSelectPage(Math.min(totalPages, Math.max(1, page)));
  closePageModal();
}

export function initPageModal() {
  els.close?.addEventListener('click', closePageModal);
  els.cancel?.addEventListener('click', closePageModal);
  els.go?.addEventListener('click', goToModalPage);
  els.backdrop?.addEventListener('click', (event) => {
    if (event.target === els.backdrop) closePageModal();
  });
  els.input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') goToModalPage();
    if (event.key === 'Escape') closePageModal();
  });
  els.grid?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-modal-page]');
    if (!button) return;
    els.input.value = button.dataset.modalPage;
    els.grid.querySelectorAll('button').forEach((btn) => btn.classList.toggle('active', btn === button));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePageModal();
  });
}
