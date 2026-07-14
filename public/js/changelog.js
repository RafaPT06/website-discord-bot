import { escapeHtml } from './utils.js';
import { getLocale } from './components/i18n.js';

const changelogList = document.querySelector('[data-changelog-list]');
const CHANGELOG_SOURCES = [
  '/data/changelog-latest.json',
  '/data/changelog.json',
  '/data/changelog-foundation.json',
];

let changelogEntries = [];
let selectedMonth = 'all';
let failedSourceCount = 0;

async function fetchChangelogSource(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const text = await response.text();
  if (!text.trim()) return [];

  let entries;
  try {
    entries = JSON.parse(text);
  } catch {
    throw new Error(`${url} did not return valid JSON`);
  }

  if (!Array.isArray(entries)) throw new Error(`${url} did not return a changelog list`);
  return entries;
}

function normalizeEntry(entry) {
  const title = entry?.title || entry?.version || '';
  const date = entry?.date || '';
  const rawChanges = Array.isArray(entry?.changes)
    ? entry.changes
    : Array.isArray(entry?.items)
      ? entry.items.map((item) => (typeof item === 'string'
        ? { type: entry.type || 'Update', text: item }
        : { type: item?.type || entry.type || 'Update', text: item?.text || item?.title || '' }))
      : [];

  const changes = rawChanges
    .map((change) => {
      if (typeof change === 'string') return { type: entry.type || 'Update', text: change };
      return {
        type: change?.type || entry.type || 'Update',
        text: change?.text || change?.title || '',
      };
    })
    .filter((change) => String(change.text || '').trim());

  return {
    title: String(title || '').trim(),
    date: String(date || '').trim(),
    changes,
  };
}

function monthKey(date) {
  const match = String(date || '').match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : 'unknown';
}

function monthLabel(key) {
  const match = String(key || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return 'Other updates';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

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

function updateMonthQuery(month) {
  const url = new URL(window.location.href);
  if (month === 'all') url.searchParams.delete('month');
  else url.searchParams.set('month', month);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function renderEntry(entry) {
  return `
    <article class="changelog-card">
      <div class="changelog-card-top">
        <h3>${escapeHtml(entry.title)}</h3>
        <time class="changelog-date" datetime="${escapeHtml(entry.date)}">${escapeHtml(displayDate(entry.date))}</time>
      </div>
      <ul class="change-list">
        ${entry.changes.map((change) => `
          <li><span class="change-type ${escapeHtml((change.type || '').toLowerCase())}">${escapeHtml(change.type)}</span><span>${escapeHtml(change.text)}</span></li>
        `).join('')}
      </ul>
    </article>
  `;
}

function renderMonthGroup(key, entries) {
  const label = monthLabel(key);
  return `
    <section class="changelog-month-group" data-changelog-month-group="${escapeHtml(key)}">
      <div class="changelog-month-heading">
        <div><span>Archive</span><h2>${escapeHtml(label)}</h2></div>
        <b>${entries.length} update${entries.length === 1 ? '' : 's'}</b>
      </div>
      <div class="changelog-month-list">${entries.map(renderEntry).join('')}</div>
    </section>
  `;
}

function availableMonths() {
  return [...new Set(changelogEntries.map((entry) => monthKey(entry.date)))]
    .filter((key) => key !== 'unknown')
    .sort((a, b) => b.localeCompare(a));
}

function renderChangelog() {
  const months = availableMonths();
  if (selectedMonth !== 'all' && !months.includes(selectedMonth)) selectedMonth = 'all';

  const visible = selectedMonth === 'all'
    ? changelogEntries
    : changelogEntries.filter((entry) => monthKey(entry.date) === selectedMonth);

  const grouped = new Map();
  visible.forEach((entry) => {
    const key = monthKey(entry.date);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });

  const summary = selectedMonth === 'all'
    ? `${visible.length} update${visible.length === 1 ? '' : 's'} across ${months.length} month${months.length === 1 ? '' : 's'}`
    : `${visible.length} update${visible.length === 1 ? '' : 's'} in ${monthLabel(selectedMonth)}`;

  changelogList.innerHTML = `
    <div class="changelog-toolbar">
      <div class="changelog-toolbar-copy">
        <span>Update archive</span>
        <strong>${escapeHtml(summary)}</strong>
      </div>
      <label class="changelog-month-filter">
        <span>Filter by month</span>
        <select data-changelog-month-select>
          <option value="all" ${selectedMonth === 'all' ? 'selected' : ''}>All months</option>
          ${months.map((month) => `<option value="${escapeHtml(month)}" ${selectedMonth === month ? 'selected' : ''}>${escapeHtml(monthLabel(month))}</option>`).join('')}
        </select>
      </label>
    </div>
    ${failedSourceCount ? '<div class="changelog-source-note" role="status"><span>Some archived entries could not be reached, so the available updates are being shown.</span><button type="button" data-changelog-retry>Retry</button></div>' : ''}
    ${visible.length
      ? [...grouped.entries()].map(([key, entries]) => renderMonthGroup(key, entries)).join('')
      : '<div class="empty-card">No updates were found for this month.</div>'}
  `;
}

function renderLoadError() {
  changelogList.innerHTML = `
    <div class="empty-card changelog-load-error" role="alert">
      <strong>Could not load the changelog.</strong>
      <span>The update files could not be reached. Check the connection and try again.</span>
      <button type="button" data-changelog-retry>Retry</button>
    </div>`;
}

export async function loadChangelog() {
  if (!changelogList) return;

  changelogList.setAttribute('aria-busy', 'true');
  const results = await Promise.allSettled(CHANGELOG_SOURCES.map(fetchChangelogSource));
  const loadedEntries = results
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value);

  failedSourceCount = results.filter((result) => result.status === 'rejected').length;

  const seen = new Set();
  changelogEntries = loadedEntries
    .map(normalizeEntry)
    .filter((entry) => {
      if (!entry.title || !entry.date || !entry.changes.length) return false;
      const key = `${entry.date}:${entry.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  changelogList.removeAttribute('aria-busy');

  if (!changelogEntries.length) {
    if (failedSourceCount === CHANGELOG_SOURCES.length) renderLoadError();
    else changelogList.innerHTML = '<div class="empty-card">No changelog entries are available yet.</div>';
    return;
  }

  const months = availableMonths();
  const requestedMonth = new URLSearchParams(window.location.search).get('month');
  selectedMonth = requestedMonth && months.includes(requestedMonth) ? requestedMonth : 'all';
  renderChangelog();
}

changelogList?.addEventListener('change', (event) => {
  const select = event.target.closest('[data-changelog-month-select]');
  if (!select) return;
  selectedMonth = select.value || 'all';
  updateMonthQuery(selectedMonth);
  renderChangelog();
});

changelogList?.addEventListener('click', (event) => {
  const retry = event.target.closest('[data-changelog-retry]');
  if (!retry) return;
  changelogList.innerHTML = '<article class="changelog-card skeleton-block"></article><article class="changelog-card skeleton-block"></article>';
  loadChangelog();
});

window.addEventListener('meowz:language-change', () => {
  if (changelogEntries.length) renderChangelog();
});
