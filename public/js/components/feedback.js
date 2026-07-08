import { escapeHtml } from '../utils.js';

export function emptyState(title, text) {
  return `<div class="dash-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

export function errorCard(title, text) {
  return `<div class="dash-empty dash-error"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

export function loadingCard(text = 'Loading') {
  const safe = escapeHtml(text || 'Loading');
  return `<div class="dash-card dash-loading skeleton-panel" aria-busy="true" aria-live="polite">
    <span>${safe}</span>
    <div class="skeleton-stack" aria-hidden="true">
      <i class="skeleton-line"></i>
      <i class="skeleton-line short"></i>
      <i class="skeleton-line"></i>
      <i class="skeleton-block"></i>
    </div>
  </div>`;
}

export function loadingInline(title = 'Loading...', text = 'Please wait.') {
  return `<div class="dash-empty skeleton-panel" aria-busy="true" aria-live="polite"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}
