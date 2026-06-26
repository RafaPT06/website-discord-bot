import { changelogList } from './dom.js';
import { escapeHtml } from './utils.js';

export async function loadChangelog() {
  if (!changelogList) return;
  try {
    const res = await fetch('/changelog.json', { cache: 'no-store' });
    const entries = await res.json();
    changelogList.innerHTML = entries.map((entry) => `
      <article class="changelog-card">
        <div class="changelog-card-top">
          <h3>${escapeHtml(entry.version)}</h3>
          <span class="changelog-date">${escapeHtml(entry.date)}</span>
        </div>
        <ul class="change-list">
          ${(entry.changes || []).map((change) => `
            <li><span class="change-type ${escapeHtml((change.type || '').toLowerCase())}">${escapeHtml(change.type)}</span><span>${escapeHtml(change.text)}</span></li>
          `).join('')}
        </ul>
      </article>
    `).join('');
  } catch (err) {
    changelogList.innerHTML = '<div class="empty-card">Could not load changelog.</div>';
  }
}
