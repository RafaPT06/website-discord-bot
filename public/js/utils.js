export function formatNumber(value) {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function setText(el, value) {
  if (el) el.textContent = value;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[char]));
}

export function clearSkeletons() {
  document.querySelectorAll('.skeleton-card').forEach((el) => el.classList.remove('skeleton-card'));
}
