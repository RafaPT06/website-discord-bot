import { commandEls, pageModalEls } from './dom.js';
import { docsState, PAGE_SIZE } from './state.js';
import { escapeHtml, setText } from './utils.js';

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
  const query = (commandEls.search?.value || '').trim().toLowerCase();
  return docsState.allCommands.filter((command) => {
    const matchesCategory = docsState.activeCategory === 'all' || command.category === docsState.activeCategory;
    const haystack = `${command.name} ${command.description} ${command.category} ${command.visibility}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
}

function renderCategoryTabs(commands) {
  if (!commandEls.tabs) return;
  const categories = ['all', ...new Set(commands.map((command) => command.category || 'Other'))];
  commandEls.tabs.innerHTML = categories.map((category) => {
    const label = category === 'all' ? 'All' : category;
    const active = category === docsState.activeCategory ? 'active' : '';
    return `<button class="${active}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(label)}</button>`;
  }).join('');
}

function getPaginationPages(totalPages) {
  const isSmallScreen = window.matchMedia('(max-width: 520px)').matches;
  const maxNumericButtons = isSmallScreen ? 4 : 7;

  if (totalPages <= maxNumericButtons + 2) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1];
  const siblingCount = isSmallScreen ? 0 : 1;
  const start = Math.max(2, docsState.currentPage - siblingCount);
  const end = Math.min(totalPages - 1, docsState.currentPage + siblingCount);

  if (start > 2) pages.push('jump');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push('jump');
  pages.push(totalPages);

  return pages;
}

function renderPagination(totalPages) {
  if (!commandEls.pagination) return;
  if (totalPages <= 1) {
    commandEls.pagination.innerHTML = '';
    return;
  }

  const buttons = [];
  buttons.push(`<button class="pagination-edge" type="button" data-page="prev" ${docsState.currentPage === 1 ? 'disabled' : ''}>Previous</button>`);

  getPaginationPages(totalPages).forEach((page) => {
    if (page === 'jump') {
      buttons.push('<button class="pagination-jump" type="button" data-page="jump" aria-label="Choose page">...</button>');
      return;
    }

    buttons.push(`<button class="${page === docsState.currentPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>`);
  });

  buttons.push(`<button class="pagination-edge" type="button" data-page="next" ${docsState.currentPage === totalPages ? 'disabled' : ''}>Next</button>`);
  commandEls.pagination.innerHTML = buttons.join('');
}

function closePageModal() {
  if (!pageModalEls.backdrop) return;
  pageModalEls.backdrop.hidden = true;
  document.body.classList.remove('modal-open');
}

function openPageModal(totalPages) {
  if (!pageModalEls.backdrop || !pageModalEls.input || !pageModalEls.grid) return;

  pageModalEls.backdrop.hidden = false;
  document.body.classList.add('modal-open');
  setText(pageModalEls.range, `Choose a page from 1 to ${totalPages}`);
  pageModalEls.input.min = '1';
  pageModalEls.input.max = String(totalPages);
  pageModalEls.input.value = String(docsState.currentPage);

  pageModalEls.grid.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const active = page === docsState.currentPage ? 'active' : '';
    return `<button class="${active}" type="button" data-modal-page="${page}">${page}</button>`;
  }).join('');

  setTimeout(() => pageModalEls.input?.focus(), 0);
}

function goToModalPage() {
  if (!pageModalEls.input) return;
  const totalPages = Number.parseInt(pageModalEls.input.max || '1', 10);
  const page = Number.parseInt(pageModalEls.input.value, 10);
  if (!Number.isFinite(page)) return;
  docsState.currentPage = Math.min(totalPages, Math.max(1, page));
  docsState.selectedCommand = null;
  closePageModal();
  renderCommands();
}

function renderCommandDetail(command) {
  if (!commandEls.detail) return;

  if (!command) {
    commandEls.detail.className = 'command-detail-panel command-detail-empty';
    commandEls.detail.innerHTML = `
      <div class="command-detail-placeholder">
        <span>Documentation</span>
        <h3>Select a command</h3>
        <p>Choose any command from the list to view usage, parameters, access and notes without moving the command table.</p>
      </div>
    `;
    if (commandEls.sheetBackdrop) commandEls.sheetBackdrop.hidden = true;
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

  commandEls.detail.className = 'command-detail-panel is-open';
  commandEls.detail.innerHTML = `
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

  const isMobile = window.matchMedia('(max-width: 720px)').matches;
  if (commandEls.sheetBackdrop) commandEls.sheetBackdrop.hidden = !isMobile;
  document.body.classList.toggle('sheet-open', isMobile);
}

function selectCommandByName(name, updateHash = true) {
  const command = docsState.allCommands.find((item) => item.name === name);
  if (!command) return;
  docsState.selectedCommand = name;
  renderCommands();
  renderCommandDetail(command);
  if (updateHash) history.replaceState(null, '', `#command-${encodeURIComponent(name)}`);
}

function closeCommandDetails() {
  docsState.selectedCommand = null;
  renderCommandDetail(null);
  renderCommands();
}

function renderCommands() {
  if (!commandEls.body) return;
  const filtered = getFilteredCommands();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (docsState.currentPage > totalPages) docsState.currentPage = totalPages;

  const start = (docsState.currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  setText(
    commandEls.summary,
    `${filtered.length} of ${docsState.allCommands.length} slash commands shown${docsState.activeCategory !== 'all' ? ` in ${docsState.activeCategory}` : ''}. Page ${docsState.currentPage} of ${totalPages}.`
  );

  if (!visible.length) {
    commandEls.body.innerHTML = '<tr><td colspan="4"><div class="empty-card">No commands found.</div></td></tr>';
    renderPagination(0);
    return;
  }

  commandEls.body.innerHTML = visible.map((command) => {
    const visibility = command.visibility || 'public';
    const isSelected = docsState.selectedCommand === command.name;
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
  if (docsState.selectedCommand && !filtered.some((command) => command.name === docsState.selectedCommand)) {
    closeCommandDetails();
  }
}

export async function loadCommands() {
  try {
    const res = await fetch('/api/bot-commands', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Commands unavailable');

    docsState.allCommands = Array.isArray(data.commands) ? data.commands : [];
    renderCategoryTabs(docsState.allCommands);
    renderCommands();
    const hashMatch = decodeURIComponent(window.location.hash || '').match(/^#command-(.+)$/);
    if (hashMatch) selectCommandByName(hashMatch[1], false);
  } catch (err) {
    setText(commandEls.summary, 'Could not load slash commands from the bot API.');
    if (commandEls.body) commandEls.body.innerHTML = '<tr><td colspan="4"><div class="empty-card">Commands API offline.</div></td></tr>';
  }
}

export function initDocumentation() {
  commandEls.search?.addEventListener('input', () => {
    docsState.currentPage = 1;
    docsState.selectedCommand = null;
    renderCommands();
  });

  commandEls.tabs?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    docsState.activeCategory = button.dataset.category || 'all';
    docsState.currentPage = 1;
    docsState.selectedCommand = null;
    renderCategoryTabs(docsState.allCommands);
    renderCommands();
  });

  commandEls.pagination?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    const filtered = getFilteredCommands();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const action = button.dataset.page;

    if (action === 'prev') docsState.currentPage = Math.max(1, docsState.currentPage - 1);
    else if (action === 'next') docsState.currentPage = Math.min(totalPages, docsState.currentPage + 1);
    else if (action === 'jump') {
      openPageModal(totalPages);
      return;
    } else docsState.currentPage = Number(action) || 1;

    docsState.selectedCommand = null;
    renderCommands();
  });

  window.addEventListener('resize', () => {
    renderCommands();
    if (docsState.selectedCommand) {
      const command = docsState.allCommands.find((item) => item.name === docsState.selectedCommand);
      renderCommandDetail(command);
    }
  });

  commandEls.body?.addEventListener('click', (event) => {
    const row = event.target.closest('[data-command-name]');
    if (!row) return;
    const name = row.dataset.commandName;
    if (docsState.selectedCommand === name) {
      const isMobile = window.matchMedia('(max-width: 720px)').matches;
      if (isMobile) selectCommandByName(name);
      else closeCommandDetails();
      return;
    }
    selectCommandByName(name);
  });

  commandEls.detail?.addEventListener('click', async (event) => {
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

  commandEls.sheetBackdrop?.addEventListener('click', closeCommandDetails);

  pageModalEls.close?.addEventListener('click', closePageModal);
  pageModalEls.cancel?.addEventListener('click', closePageModal);
  pageModalEls.go?.addEventListener('click', goToModalPage);
  pageModalEls.backdrop?.addEventListener('click', (event) => {
    if (event.target === pageModalEls.backdrop) closePageModal();
  });
  pageModalEls.input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') goToModalPage();
    if (event.key === 'Escape') closePageModal();
  });
  pageModalEls.grid?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-modal-page]');
    if (!button) return;
    pageModalEls.input.value = button.dataset.modalPage;
    pageModalEls.grid.querySelectorAll('button').forEach((btn) => btn.classList.toggle('active', btn === button));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePageModal();
  });
}
