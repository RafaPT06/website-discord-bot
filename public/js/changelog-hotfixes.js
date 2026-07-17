import { escapeHtml } from './utils.js';
import { getLocale } from './components/i18n.js';

const holder = document.querySelector('[data-changelog-hotfixes]');

function displayDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function render(entries) {
  if (!holder || !entries.length) return;
  holder.innerHTML = entries.map((entry) => `
    <article class="changelog-card">
      <div class="changelog-card-top">
        <h3>${escapeHtml(entry.title || '')}</h3>
        <time class="changelog-date" datetime="${escapeHtml(entry.date || '')}">${escapeHtml(displayDate(entry.date || ''))}</time>
      </div>
      <ul class="change-list">
        ${(Array.isArray(entry.items) ? entry.items : []).map((item) => `<li><span class="change-type update">Update</span><span>${escapeHtml(item)}</span></li>`).join('')}
      </ul>
    </article>
  `).join('');
}

async function loadHotfixes() {
  if (!holder) return;
  try {
    const response = await fetch('/data/changelog-hotfixes.json', { cache: 'no-store' });
    const entries = response.ok ? await response.json() : [];
    render(Array.isArray(entries) ? entries : []);
  } catch {
    holder.hidden = true;
  }
}

loadHotfixes();
window.addEventListener('meowz:language-change', loadHotfixes);
