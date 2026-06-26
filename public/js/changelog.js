import { getChangelog } from './api.js';
import { escapeHtml } from './utils.js';

const changelogList = document.querySelector('[data-changelog-list]');

export async function loadChangelog() {
  if (!changelogList) return;
  try {
    const entries = await getChangelog();
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
  } catch {
    changelogList.innerHTML = '<div class="empty-card">Could not load changelog.</div>';
  }
}
