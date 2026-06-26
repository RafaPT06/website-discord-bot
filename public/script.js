const statEls = {
  servers: document.querySelector('[data-stat="servers"]'),
  users: document.querySelector('[data-stat="users"]'),
  commands: document.querySelector('[data-stat="commands"]'),
  ping: document.querySelector('[data-stat="ping"]'),
  uptime: document.querySelector('[data-stat="uptime"]'),
  status: document.querySelector('[data-stat="status"]'),
  botName: document.querySelector('[data-bot-name]'),
  botNameHeading: document.querySelector('[data-bot-name-heading]'),
  botNameShort: document.querySelector('[data-bot-name-short]'),
  footerBotName: document.querySelector('[data-footer-bot-name]'),
  botTag: document.querySelector('[data-bot-tag]'),
  avatar: document.querySelector('[data-bot-avatar]'),
  avatarSmall: document.querySelector('[data-bot-avatar-small]'),
  updated: document.querySelector('[data-updated]'),
  statusPill: document.querySelector('[data-status-pill]'),
  inviteLink: document.querySelector('[data-invite-link]'),
  footerYear: document.querySelector('[data-footer-year]'),
};

const commandEls = {
  body: document.querySelector('[data-commands-body]'),
  search: document.querySelector('[data-command-search]'),
  tabs: document.querySelector('[data-category-tabs]'),
  summary: document.querySelector('[data-command-summary]'),
  pagination: document.querySelector('[data-command-pagination]'),
  detail: document.querySelector('[data-command-detail]'),
  sheetBackdrop: document.querySelector('[data-command-sheet-backdrop]'),
};

const pageModalEls = {
  backdrop: document.querySelector('[data-page-modal]'),
  range: document.querySelector('[data-page-modal-range]'),
  input: document.querySelector('[data-page-modal-input]'),
  grid: document.querySelector('[data-page-modal-grid]'),
  close: document.querySelector('[data-page-modal-close]'),
  cancel: document.querySelector('[data-page-modal-cancel]'),
  go: document.querySelector('[data-page-modal-go]'),
};

const navEls = {
  toggle: document.querySelector('[data-menu-toggle]'),
  links: document.querySelector('[data-nav-links]'),
};

const changelogList = document.querySelector('[data-changelog-list]');

let allCommands = [];
let activeCategory = 'all';
let currentPage = 1;
let selectedCommand = null;
const PAGE_SIZE = 10;

function formatNumber(value) {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function clearSkeletons() {
  document.querySelectorAll('.skeleton-card').forEach((el) => el.classList.remove('skeleton-card'));
}

function setBotName(name) {
  const safeName = name || 'Meowz';
  setText(statEls.botName, safeName);
  setText(statEls.botNameHeading, safeName);
  setText(statEls.botNameShort, safeName);
  setText(statEls.footerBotName, safeName);
  document.title = `${safeName} — Commands & Stats`;
}

function setAvatar(url, fallbackName) {
  const letter = (fallbackName || 'M').trim().charAt(0).toUpperCase() || 'M';
  for (const el of [statEls.avatar, statEls.avatarSmall]) {
    if (!el) continue;
    if (url) {
      el.style.backgroundImage = `url('${url}')`;
      el.textContent = '';
      el.classList.add('has-image');
    } else {
      el.style.backgroundImage = '';
      el.textContent = letter;
      el.classList.remove('has-image');
    }
  }
}

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
  return allCommands.filter((command) => {
    const matchesCategory = activeCategory === 'all' || command.category === activeCategory;
    const haystack = `${command.name} ${command.description} ${command.category} ${command.visibility}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
}

function renderCategoryTabs(commands) {
  if (!commandEls.tabs) return;
  const categories = ['all', ...new Set(commands.map((command) => command.category || 'Other'))];
  commandEls.tabs.innerHTML = categories.map((category) => {
    const label = category === 'all' ? 'All' : category;
    const active = category === activeCategory ? 'active' : '';
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
  const start = Math.max(2, currentPage - siblingCount);
  const end = Math.min(totalPages - 1, currentPage + siblingCount);

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
  buttons.push(`<button class="pagination-edge" type="button" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>`);

  getPaginationPages(totalPages).forEach((page) => {
    if (page === 'jump') {
      buttons.push(`<button class="pagination-jump" type="button" data-page="jump" aria-label="Choose page">...</button>`);
      return;
    }

    buttons.push(`<button class="${page === currentPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>`);
  });

  buttons.push(`<button class="pagination-edge" type="button" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`);
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
  pageModalEls.input.value = String(currentPage);

  pageModalEls.grid.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const active = page === currentPage ? 'active' : '';
    return `<button class="${active}" type="button" data-modal-page="${page}">${page}</button>`;
  }).join('');

  setTimeout(() => pageModalEls.input?.focus(), 0);
}

function goToModalPage() {
  if (!pageModalEls.input) return;
  const totalPages = Number.parseInt(pageModalEls.input.max || '1', 10);
  const page = Number.parseInt(pageModalEls.input.value, 10);
  if (!Number.isFinite(page)) return;
  currentPage = Math.min(totalPages, Math.max(1, page));
  selectedCommand = null;
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
    commandEls.sheetBackdrop.hidden = true;
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
  commandEls.sheetBackdrop.hidden = !isMobile;
  document.body.classList.toggle('sheet-open', isMobile);
}

function selectCommandByName(name, updateHash = true) {
  const command = allCommands.find((item) => item.name === name);
  if (!command) return;
  selectedCommand = name;
  renderCommands();
  renderCommandDetail(command);
  if (updateHash) history.replaceState(null, '', `#command-${encodeURIComponent(name)}`);
}

function closeCommandDetails() {
  selectedCommand = null;
  renderCommandDetail(null);
  renderCommands();
}

function renderCommands() {
  if (!commandEls.body) return;
  const filtered = getFilteredCommands();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  setText(
    commandEls.summary,
    `${filtered.length} of ${allCommands.length} slash commands shown${activeCategory !== 'all' ? ` in ${activeCategory}` : ''}. Page ${currentPage} of ${totalPages}.`
  );

  if (!visible.length) {
    commandEls.body.innerHTML = '<tr><td colspan="4"><div class="empty-card">No commands found.</div></td></tr>';
    renderPagination(0);
    return;
  }

  commandEls.body.innerHTML = visible.map((command) => {
    const visibility = command.visibility || 'public';
    const isSelected = selectedCommand === command.name;
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
  if (selectedCommand && !filtered.some((command) => command.name === selectedCommand)) {
    closeCommandDetails();
  }
}

async function loadBotStats() {
  try {
    const res = await fetch('/api/bot-stats', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Stats unavailable');

    const botName = data.botName || 'Meowz';
    setBotName(botName);
    setAvatar(data.avatarUrl, botName);
    setText(statEls.servers, formatNumber(data.servers));
    setText(statEls.users, formatNumber(data.users));
    setText(statEls.commands, formatNumber(data.commands));
    setText(statEls.ping, typeof data.ping === 'number' ? `${data.ping}ms` : '—');
    setText(statEls.uptime, data.uptime || '—');
    setText(statEls.status, data.online ? 'Live' : 'Offline');
    setText(statEls.botTag, data.botTag || (data.online ? 'Online and ready' : 'Offline'));
    setText(statEls.statusPill, data.online ? 'Bot online' : 'Bot offline');
    setText(statEls.updated, `Updated ${new Date(data.updatedAt).toLocaleTimeString()}`);
    clearSkeletons();

    if (statEls.inviteLink && data.inviteUrl) {
      statEls.inviteLink.href = data.inviteUrl;
      statEls.inviteLink.target = '_blank';
      statEls.inviteLink.rel = 'noopener noreferrer';
    }
  } catch (err) {
    setText(statEls.status, 'Offline');
    setText(statEls.statusPill, 'Bot API offline');
    setText(statEls.updated, 'Connect BOT_API_URL in Railway to show live stats');
    setBotName('Meowz');
    setAvatar(null, 'Meowz');
    clearSkeletons();
  }
}

async function loadCommands() {
  try {
    const res = await fetch('/api/bot-commands', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Commands unavailable');

    allCommands = Array.isArray(data.commands) ? data.commands : [];
    renderCategoryTabs(allCommands);
    renderCommands();
    const hashMatch = decodeURIComponent(window.location.hash || '').match(/^#command-(.+)$/);
    if (hashMatch) selectCommandByName(hashMatch[1], false);
  } catch (err) {
    setText(commandEls.summary, 'Could not load slash commands from the bot API.');
    if (commandEls.body) commandEls.body.innerHTML = '<tr><td colspan="4"><div class="empty-card">Commands API offline.</div></td></tr>';
  }
}

async function loadChangelog() {
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

function closeMobileMenu() {
  navEls.toggle?.classList.remove('is-open');
  navEls.links?.classList.remove('is-open');
  navEls.toggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

navEls.toggle?.addEventListener('click', () => {
  const isOpen = navEls.links?.classList.toggle('is-open');
  navEls.toggle.classList.toggle('is-open', Boolean(isOpen));
  navEls.toggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
  document.body.classList.toggle('menu-open', Boolean(isOpen));
});

document.querySelectorAll('[data-nav-link]').forEach((link) => link.addEventListener('click', closeMobileMenu));

commandEls.search?.addEventListener('input', () => {
  currentPage = 1;
  selectedCommand = null;
  renderCommands();
});

commandEls.tabs?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category || 'all';
  currentPage = 1;
  selectedCommand = null;
  renderCategoryTabs(allCommands);
  renderCommands();
});

commandEls.pagination?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button || button.disabled) return;
  const filtered = getFilteredCommands();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const action = button.dataset.page;

  if (action === 'prev') currentPage = Math.max(1, currentPage - 1);
  else if (action === 'next') currentPage = Math.min(totalPages, currentPage + 1);
  else if (action === 'jump') {
    openPageModal(totalPages);
    return;
  } else currentPage = Number(action) || 1;

  selectedCommand = null;
  renderCommands();
});

window.addEventListener('resize', () => {
  renderCommands();
  if (selectedCommand) {
    const command = allCommands.find((item) => item.name === selectedCommand);
    renderCommandDetail(command);
  }
});

commandEls.body?.addEventListener('click', (event) => {
  const row = event.target.closest('[data-command-name]');
  if (!row) return;
  const name = row.dataset.commandName;
  if (selectedCommand === name) {
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

if (statEls.footerYear) statEls.footerYear.textContent = new Date().getFullYear();
loadBotStats();
loadCommands();
loadChangelog();
setInterval(loadBotStats, 30000);
setInterval(loadCommands, 60000);
