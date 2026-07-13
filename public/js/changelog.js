import { getChangelog } from './api.js';
import { escapeHtml } from './utils.js';

const changelogList = document.querySelector('[data-changelog-list]');

async function getLatestChangelogEntries() {
  try {
    const response = await fetch('/data/changelog-latest.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const entries = await response.json();
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function normalizeEntry(entry) {
  const title = entry.title || entry.version || '';
  const date = entry.date || '';
  const rawChanges = Array.isArray(entry.changes)
    ? entry.changes
    : Array.isArray(entry.items)
      ? entry.items.map((item) => ({ type: entry.type || 'Update', text: item }))
      : [];

  const changes = rawChanges
    .map((change) => {
      if (typeof change === 'string') return { type: entry.type || 'Update', text: change };
      return { type: change.type || entry.type || 'Update', text: change.text || change.title || '' };
    })
    .filter((change) => change.text && change.text.trim());

  return {
    title: String(title || '').trim(),
    date: String(date || '').trim(),
    changes,
  };
}

function renderEntry(entry) {
  return `
    <article class="changelog-card">
      <div class="changelog-card-top">
        <h3>${escapeHtml(entry.title)}</h3>
        <span class="changelog-date">${escapeHtml(entry.date)}</span>
      </div>
      <ul class="change-list">
        ${entry.changes.map((change) => `
          <li><span class="change-type ${escapeHtml((change.type || '').toLowerCase())}">${escapeHtml(change.type)}</span><span>${escapeHtml(change.text)}</span></li>
        `).join('')}
      </ul>
    </article>
  `;
}

export async function loadChangelog() {
  if (!changelogList) return;
  try {
    const [latestEntries, entries] = await Promise.all([
      getLatestChangelogEntries(),
      getChangelog(),
    ]);

    const seen = new Set();
    const visibleEntries = [...latestEntries, ...(Array.isArray(entries) ? entries : [])]
      .map(normalizeEntry)
      .filter((entry) => {
        if (!entry.title || !entry.date || !entry.changes.length) return false;
        const key = `${entry.date}:${entry.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    changelogList.innerHTML = visibleEntries.length
      ? visibleEntries.map(renderEntry).join('')
      : '<div class="empty-card">No changelog entries are available yet.</div>';
  } catch {
    changelogList.innerHTML = '<div class="empty-card">Could not load changelog.</div>';
  }
}
