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
};

const navEls = {
  toggle: document.querySelector('[data-menu-toggle]'),
  links: document.querySelector('[data-nav-links]'),
};

const changelogList = document.querySelector('[data-changelog-list]');

let allCommands = [];
let activeCategory = 'all';
let currentPage = 1;
let expandedCommand = null;
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

  getPaginationPages(totalPages).forEach((page, index) => {
    if (page === 'jump') {
      buttons.push(`<button class="pagination-jump" type="button" data-page="jump" data-jump-index="${index}" aria-label="Choose page">...</button>`);
      return;
    }

    buttons.push(`<button class="${page === currentPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>`);
  });

  buttons.push(`<button class="pagination-edge" type="button" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`);
  commandEls.pagination.innerHTML = buttons.join('');
}

function renderCommandDetails(command) {
  const options = Array.isArray(command.options) ? command.options : [];
  const optionList = options.length
    ? `<ul>${options.map((option) => `<li><strong>${escapeHtml(option.name)}</strong> — ${option.required ? 'Required' : 'Optional'}${option.description ? ` · ${escapeHtml(option.description)}` : ''}</li>`).join('')}</ul>`
    : '<p>No parameters.</p>';

  return `
    <tr class="command-details-row">
      <td colspan="4">
        <div class="command-details">
          <div class="command-details-panel">
            <h4>Usage</h4>
            <code>${escapeHtml(commandUsage(command))}</code>
          </div>
          <div class="command-details-panel">
            <h4>Access</h4>
            <p>${escapeHtml(visibilityLabel(command.visibility || 'public'))} · ${command.dm ? 'Can be used in DMs' : 'Server only'}</p>
          </div>
          <div class="command-details-panel">
            <h4>Parameters</h4>
            ${optionList}
          </div>
          <div class="command-details-panel">
            <h4>Notes</h4>
            <p>${escapeHtml(command.description || 'No extra notes available yet.')}</p>
          </div>
        </div>
      </td>
    </tr>
  `;
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
    const isOpen = expandedCommand === command.name;
    return `
      <tr class="command-row" data-command-name="${escapeHtml(command.name)}">
        <td><span class="command-name">/${escapeHtml(command.name)}</span></td>
        <td class="command-description">${escapeHtml(command.description || 'No description provided.')}</td>
        <td><span class="command-chip">${escapeHtml(command.category || 'Other')}</span></td>
        <td><span class="visibility-badge ${escapeHtml(visibility)}">${visibilityLabel(visibility)}</span></td>
      </tr>
      ${isOpen ? renderCommandDetails(command) : ''}
    `;
  }).join('');

  renderPagination(totalPages);
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
  expandedCommand = null;
  renderCommands();
});

commandEls.tabs?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category || 'all';
  currentPage = 1;
  expandedCommand = null;
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
    const requested = window.prompt(`Choose a page from 1 to ${totalPages}:`, String(currentPage));
    if (requested === null) return;

    const page = Number.parseInt(requested, 10);
    if (!Number.isFinite(page)) return;
    currentPage = Math.min(totalPages, Math.max(1, page));
  } else currentPage = Number(action) || 1;

  expandedCommand = null;
  renderCommands();
});

window.addEventListener('resize', () => renderCommands());

commandEls.body?.addEventListener('click', (event) => {
  const row = event.target.closest('[data-command-name]');
  if (!row) return;
  const name = row.dataset.commandName;
  expandedCommand = expandedCommand === name ? null : name;
  renderCommands();
});

if (statEls.footerYear) statEls.footerYear.textContent = new Date().getFullYear();
loadBotStats();
loadCommands();
loadChangelog();
setInterval(loadBotStats, 30000);
setInterval(loadCommands, 60000);
