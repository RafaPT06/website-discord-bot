import { getBotCommands } from './api.js';
import { appState, PAGE_SIZE } from './state.js';
import { escapeHtml, isMobileScreen, setText } from './utils.js';
import { getPaginationPages } from './pagination.js';
import { openPageModal } from './pageModal.js';

const els = {
  body: document.querySelector('[data-commands-body]'),
  search: document.querySelector('[data-command-search]'),
  tabs: document.querySelector('[data-category-tabs]'),
  summary: document.querySelector('[data-command-summary]'),
  pagination: document.querySelector('[data-command-pagination]'),
  detail: document.querySelector('[data-command-detail]'),
  sheetBackdrop: document.querySelector('[data-command-sheet-backdrop]'),
};

function visibilityLabel(value) {
  if (value === 'owner') return 'Owner';
  if (value === 'admin') return 'Admin';
  return 'Public';
}

function optionText(command) {
  const options = Array.isArray(command.options) ? command.options : [];
  if (!options.length) return '';
  const names = options.slice(0, 3).map((option) => `${option.required ? '<' : '['}${option.name}${option.required ? '>' : ']'}`);
  const more = options.length > 3 ? ' ...' : '';
  return ` ${names.join(' ')}${more}`;
}

function commandUsage(command) {
  return `/${command.name}${optionText(command)}`;
}

function getFilteredCommands() {
  const query = (els.search?.value || '').trim().toLowerCase();
  return appState.commands.filter((command) => {
    const matchesCategory = appState.activeCategory === 'all' || command.category === appState.activeCategory;
    const haystack = `${command.name} ${command.description} ${command.category} ${command.visibility}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
}

function renderCategoryTabs() {
  if (!els.tabs) return;
  const categories = ['all', ...new Set(appState.commands.map((command) => command.category || 'Other'))];
  els.tabs.innerHTML = categories.map((category) => {
    const label = category === 'all' ? 'All' : category;
    const active = category === appState.activeCategory ? 'active' : '';
    return `<button class="${active}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(label)}</button>`;
  }).join('');
}

function renderPagination(totalPages) {
  if (!els.pagination) return;
  if (totalPages <= 1) {
    els.pagination.innerHTML = '';
    return;
  }

  const buttons = [];
  buttons.push(`<button class="pagination-edge" type="button" data-page="prev" ${appState.currentPage === 1 ? 'disabled' : ''}>Previous</button>`);

  getPaginationPages(appState.currentPage, totalPages).forEach((page) => {
    if (page === 'jump') {
      buttons.push('<button class="pagination-jump" type="button" data-page="jump" aria-label="Choose page">...</button>');
      return;
    }
    buttons.push(`<button class="${page === appState.currentPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>`);
  });

  buttons.push(`<button class="pagination-edge" type="button" data-page="next" ${appState.currentPage === totalPages ? 'disabled' : ''}>Next</button>`);
  els.pagination.innerHTML = buttons.join('');
}

function renderCommandDetail(command) {
  if (!els.detail) return;

  if (!command) {
    els.detail.className = 'command-detail-panel command-detail-empty';
    els.detail.innerHTML = `
      <div class="command-detail-placeholder">
        <span>Documentation</span>
        <h3>Select a command</h3>
        <p>Choose any command from the list to view usage, parameters, access and notes without moving the command table.</p>
      </div>
    `;
    if (els.sheetBackdrop) els.sheetBackdrop.hidden = true;
    document.body.classList.remove('sheet-open');
    return;
  }

  const options = Array.isArray(command.options) ? command.options : [];
  const optionList = options.length
    ? `<div class="detail-option-list">${options.map((option) => `
        <div class="detail-option">
          <div>
            <strong>${escapeHtml(option.name)}</strong>
            <span>${option.required ? 'Required' : 'Optional'}</span>
          </div>
          <p>${escapeHtml(option.description || 'No description provided.')}</p>
        </div>
      `).join('')}</div>`
    : '<p class="detail-muted">No parameters.</p>';

  const visibility = command.visibility || 'public';
  const usage = commandUsage(command);

  els.detail.className = 'command-detail-panel is-open';
  els.detail.innerHTML = `
    <div class="command-detail-top">
      <div>
        <span class="detail-eyebrow">${escapeHtml(command.category || 'Other')}</span>
        <h3>/${escapeHtml(command.name)}</h3>
        <p>${escapeHtml(command.description || 'No description provided.')}</p>
      </div>
      <button class="command-detail-close" type="button" data-command-detail-close aria-label="Close command details">×</button>
    </div>

    <div class="detail-section">
      <div class="detail-section-head">
        <h4>Usage</h4>
        <button class="copy-command" type="button" data-copy-command="${escapeHtml(usage)}">Copy</button>
      </div>
      <code>${escapeHtml(usage)}</code>
    </div>

    <div class="detail-section">
      <h4>Access</h4>
      <div class="detail-badges">
        <span class="visibility-badge ${escapeHtml(visibility)}">${visibilityLabel(visibility)}</span>
        <span class="command-chip">${command.dm ? 'DMs allowed' : 'Server only'}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Parameters</h4>
      ${optionList}
    </div>

    <div class="detail-section">
      <h4>Notes</h4>
      <p class="detail-muted">${escapeHtml(command.description || 'No extra notes available yet.')}</p>
    </div>
  `;

  const mobile = isMobileScreen();
  if (els.sheetBackdrop) els.sheetBackdrop.hidden = !mobile;
  document.body.classList.toggle('sheet-open', mobile);
}

function renderCommands() {
  if (!els.body) return;
  const filtered = getFilteredCommands();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (appState.currentPage > totalPages) appState.currentPage = totalPages;

  const start = (appState.currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  setText(
    els.summary,
    `${filtered.length} of ${appState.commands.length} slash commands shown${appState.activeCategory !== 'all' ? ` in ${appState.activeCategory}` : ''}. Page ${appState.currentPage} of ${totalPages}.`
  );

  if (!visible.length) {
    els.body.innerHTML = '<tr><td colspan="4"><div class="empty-card">No commands found.</div></td></tr>';
    renderPagination(0);
    return;
  }

  els.body.innerHTML = visible.map((command) => {
    const visibility = command.visibility || 'public';
    const isSelected = appState.selectedCommand === command.name;
    return `
      <tr class="command-row ${isSelected ? 'is-selected' : ''}" data-command-name="${escapeHtml(command.name)}">
        <td><span class="command-name">/${escapeHtml(command.name)}</span></td>
        <td class="command-description">${escapeHtml(command.description || 'No description provided.')}</td>
        <td><span class="command-chip">${escapeHtml(command.category || 'Other')}</span></td>
        <td><span class="visibility-badge ${escapeHtml(visibility)}">${visibilityLabel(visibility)}</span></td>
      </tr>
    `;
  }).join('');

  renderPagination(totalPages);

  if (appState.selectedCommand && !filtered.some((command) => command.name === appState.selectedCommand)) {
    closeCommandDetails();
  }
}

function selectCommandByName(name, updateHash = true) {
  const command = appState.commands.find((item) => item.name === name);
  if (!command) return;
  appState.selectedCommand = name;
  renderCommands();
  renderCommandDetail(command);
  if (updateHash) history.replaceState(null, '', `#command-${encodeURIComponent(name)}`);
}

function closeCommandDetails() {
  appState.selectedCommand = null;
  renderCommandDetail(null);
  renderCommands();
}

export async function loadCommands() {
  try {
    const data = await getBotCommands();
    if (!data.ok) throw new Error(data.error || 'Commands unavailable');

    appState.commands = Array.isArray(data.commands) ? data.commands : [];
    renderCategoryTabs();
    renderCommands();

    const hashMatch = decodeURIComponent(window.location.hash || '').match(/^#command-(.+)$/);
    if (hashMatch) selectCommandByName(hashMatch[1], false);
  } catch {
    setText(els.summary, 'Could not load slash commands from the bot API.');
    if (els.body) els.body.innerHTML = '<tr><td colspan="4"><div class="empty-card">Commands API offline.</div></td></tr>';
  }
}

function initSearch() {
  els.search?.addEventListener('input', () => {
    appState.currentPage = 1;
    appState.selectedCommand = null;
    renderCommands();
  });
}

function initCategoryTabs() {
  els.tabs?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    appState.activeCategory = button.dataset.category || 'all';
    appState.currentPage = 1;
    appState.selectedCommand = null;
    renderCategoryTabs();
    renderCommands();
  });
}

function initPagination() {
  els.pagination?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    const filtered = getFilteredCommands();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const action = button.dataset.page;

    if (action === 'prev') appState.currentPage = Math.max(1, appState.currentPage - 1);
    else if (action === 'next') appState.currentPage = Math.min(totalPages, appState.currentPage + 1);
    else if (action === 'jump') {
      openPageModal({
        currentPage: appState.currentPage,
        totalPages,
        onSelect: (page) => {
          appState.currentPage = page;
          appState.selectedCommand = null;
          renderCommands();
        },
      });
      return;
    } else appState.currentPage = Number(action) || 1;

    appState.selectedCommand = null;
    renderCommands();
  });
}

function initCommandSelection() {
  els.body?.addEventListener('click', (event) => {
    const row = event.target.closest('[data-command-name]');
    if (!row) return;
    const name = row.dataset.commandName;
    if (appState.selectedCommand === name) {
      if (isMobileScreen()) selectCommandByName(name);
      else closeCommandDetails();
      return;
    }
    selectCommandByName(name);
  });

  els.detail?.addEventListener('click', async (event) => {
    const closeButton = event.target.closest('[data-command-detail-close]');
    if (closeButton) {
      closeCommandDetails();
      return;
    }

    const copyButton = event.target.closest('[data-copy-command]');
    if (!copyButton) return;
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copyCommand || '');
      copyButton.textContent = 'Copied';
      setTimeout(() => { copyButton.textContent = 'Copy'; }, 1200);
    } catch {
      copyButton.textContent = 'Failed';
      setTimeout(() => { copyButton.textContent = 'Copy'; }, 1200);
    }
  });

  els.sheetBackdrop?.addEventListener('click', closeCommandDetails);
}

function initResponsiveDetailRefresh() {
  window.addEventListener('resize', () => {
    renderCommands();
    if (appState.selectedCommand) {
      const command = appState.commands.find((item) => item.name === appState.selectedCommand);
      renderCommandDetail(command);
    }
  });
}

export function initDocumentation() {
  if (!els.body) return;
  initSearch();
  initCategoryTabs();
  initPagination();
  initCommandSelection();
  initResponsiveDetailRefresh();
  loadCommands();
  setInterval(loadCommands, 60000);
}
