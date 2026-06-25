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
  pageTitle: document.querySelector('[data-page-title]'),
  botTag: document.querySelector('[data-bot-tag]'),
  avatar: document.querySelector('[data-bot-avatar]'),
  avatarSmall: document.querySelector('[data-bot-avatar-small]'),
  updated: document.querySelector('[data-updated]'),
  statusPill: document.querySelector('[data-status-pill]'),
  inviteLink: document.querySelector('[data-invite-link]'),
};

const commandEls = {
  grid: document.querySelector('[data-commands-grid]'),
  search: document.querySelector('[data-command-search]'),
  tabs: document.querySelector('[data-category-tabs]'),
  summary: document.querySelector('[data-command-summary]'),
  detail: document.querySelector('[data-command-detail]'),
};

const changelogEls = {
  list: document.querySelector('[data-changelog-list]'),
};

const siteEls = {
  supportLink: document.querySelector('[data-support-link]'),
  bugLink: document.querySelector('[data-bug-link]'),
  featureLink: document.querySelector('[data-feature-link]'),
};

let allCommands = [];
let activeCategory = 'all';
let expandedCommandName = null;

function formatNumber(value) {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function setSafeLink(el, url) {
  if (!el || !url || url === '#') return;
  el.href = url;
  el.target = '_blank';
  el.rel = 'noopener noreferrer';
}

function setBotName(name) {
  const safeName = name || 'Discord Bot';
  setText(statEls.botName, safeName);
  setText(statEls.botNameHeading, safeName);
  setText(statEls.botNameShort, safeName);
  setText(statEls.footerBotName, safeName);
  if (document.title !== safeName) document.title = `${safeName} — Commands & Stats`;
}

function setAvatar(url, fallbackName) {
  const letter = (fallbackName || '?').trim().charAt(0).toUpperCase() || '?';

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
  const names = options.slice(0, 4).map((option) => `${option.required ? '<' : '['}${option.name}${option.required ? '>' : ']'}`);
  const more = options.length > 4 ? ' ...' : '';
  return ` ${names.join(' ')}${more}`;
}

function usageText(command) {
  return `/${command.name}${optionText(command)}`;
}

function optionTypeLabel(option) {
  if (typeof option.type === 'string') return option.type;
  const typeMap = {
    1: 'Subcommand',
    2: 'Group',
    3: 'Text',
    4: 'Integer',
    5: 'True/False',
    6: 'User',
    7: 'Channel',
    8: 'Role',
    9: 'Mentionable',
    10: 'Number',
    11: 'Attachment',
  };
  return typeMap[option.type] || 'Option';
}

function commandTips(command) {
  const tips = [];
  const name = String(command.name || '').toLowerCase();

  if (command.visibility === 'owner') tips.push('Only the bot owner should be able to use this command.');
  if (command.visibility === 'admin') tips.push('This command is intended for server managers or staff.');
  if (!command.dm) tips.push('This command only works inside servers.');
  if (name.includes('edit_image')) tips.push('Use clear prompts and mention exactly what should stay unchanged.');
  if (name.includes('level') || name.includes('rank')) tips.push('Useful for checking profile progress and XP activity.');

  return tips.length ? tips : ['Use this command directly in Discord with slash commands.'];
}

function renderCommandDetail(command) {
  if (!commandEls.detail) return;

  if (!command) {
    commandEls.detail.innerHTML = `
      <div class="command-detail-empty">
        <span>⚡</span>
        <h3>Select a command</h3>
        <p>Click any slash command to view usage, options, visibility and quick tips.</p>
      </div>
    `;
    return;
  }

  const visibility = command.visibility || 'public';
  const options = Array.isArray(command.options) ? command.options : [];
  const tips = commandTips(command);

  commandEls.detail.innerHTML = `
    <div class="command-detail-top">
      <span class="visibility-badge ${visibility}">${visibilityLabel(visibility)}</span>
      <span class="command-detail-category">${escapeHtml(command.category || 'Other')}</span>
    </div>

    <h3><code>/${escapeHtml(command.name)}</code></h3>
    <p class="command-detail-description">${escapeHtml(command.description || 'No description provided.')}</p>

    <div class="command-doc-block">
      <span>Usage</span>
      <code>${escapeHtml(usageText(command))}</code>
    </div>

    <div class="command-doc-grid">
      <div>
        <span>Where it works</span>
        <strong>${command.dm ? 'Server + DMs' : 'Server only'}</strong>
      </div>
      <div>
        <span>Category</span>
        <strong>${escapeHtml(command.category || 'Other')}</strong>
      </div>
    </div>

    <div class="command-options">
      <h4>Options</h4>
      ${options.length ? options.map((option) => `
        <div class="command-option-row">
          <div>
            <strong>${escapeHtml(option.name || 'option')}</strong>
            <p>${escapeHtml(option.description || 'No description provided.')}</p>
          </div>
          <span>${escapeHtml(optionTypeLabel(option))}${option.required ? ' • Required' : ''}</span>
        </div>
      `).join('') : '<p class="muted small-muted">This command has no options.</p>'}
    </div>

    <div class="command-options">
      <h4>Notes</h4>
      <ul class="command-tips">
        ${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderCategoryTabs(commands) {
  if (!commandEls.tabs) return;
  const categories = ['all', ...new Set(commands.map((command) => command.category || 'Other'))];
  commandEls.tabs.innerHTML = categories.map((category) => {
    const label = category === 'all' ? 'All' : category;
    const active = category === activeCategory ? 'active' : '';
    return `<button class="${active}" type="button" data-category="${category}">${label}</button>`;
  }).join('');
}

function commandDetailContent(command) {
  const visibility = command.visibility || 'public';
  const options = Array.isArray(command.options) ? command.options : [];
  const tips = commandTips(command);

  return `
    <div class="command-detail-inline">
      <div class="command-detail-top">
        <span class="visibility-badge ${visibility}">${visibilityLabel(visibility)}</span>
        <span class="command-detail-category">${escapeHtml(command.category || 'Other')}</span>
      </div>

      <div class="command-doc-block">
        <span>Usage</span>
        <code>${escapeHtml(usageText(command))}</code>
      </div>

      <div class="command-doc-grid">
        <div>
          <span>Where it works</span>
          <strong>${command.dm ? 'Server + DMs' : 'Server only'}</strong>
        </div>
        <div>
          <span>Category</span>
          <strong>${escapeHtml(command.category || 'Other')}</strong>
        </div>
      </div>

      <div class="command-options">
        <h4>Options</h4>
        ${options.length ? options.map((option) => `
          <div class="command-option-row">
            <div>
              <strong>${escapeHtml(option.name || 'option')}</strong>
              <p>${escapeHtml(option.description || 'No description provided.')}</p>
            </div>
            <span>${escapeHtml(optionTypeLabel(option))}${option.required ? ' • Required' : ''}</span>
          </div>
        `).join('') : '<p class="muted small-muted">This command has no options.</p>'}
      </div>

      <div class="command-options">
        <h4>Notes</h4>
        <ul class="command-tips">
          ${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderCommands() {
  if (!commandEls.grid) return;
  const query = (commandEls.search?.value || '').trim().toLowerCase();

  const filtered = allCommands.filter((command) => {
    const matchesCategory = activeCategory === 'all' || command.category === activeCategory;
    const haystack = `${command.name} ${command.description} ${command.category} ${command.visibility}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });

  setText(
    commandEls.summary,
    `${filtered.length} of ${allCommands.length} slash commands shown${activeCategory !== 'all' ? ` in ${activeCategory}` : ''}.`
  );

  if (!filtered.length) {
    commandEls.grid.innerHTML = '<div class="empty-card">No commands found.</div>';
    expandedCommandName = null;
    return;
  }

  if (expandedCommandName && !filtered.some((command) => command.name === expandedCommandName)) {
    expandedCommandName = null;
  }

  commandEls.grid.innerHTML = filtered.map((command) => {
    const visibility = command.visibility || 'public';
    const expanded = command.name === expandedCommandName;
    return `
      <article class="command-card ${expanded ? 'expanded' : ''}" data-visibility="${visibility}">
        <button class="command-card-trigger" type="button" data-command-name="${escapeHtml(command.name)}" aria-expanded="${expanded ? 'true' : 'false'}">
          <div class="command-card-main">
            <div class="command-card-top">
              <code>${escapeHtml(usageText(command))}</code>
              <span class="visibility-badge ${visibility}">${visibilityLabel(visibility)}</span>
            </div>
            <p>${escapeHtml(command.description || 'No description provided.')}</p>
            <div class="command-meta">
              <span>${escapeHtml(command.category || 'Other')}</span>
              <span>${command.dm ? 'DMs allowed' : 'Server only'}</span>
            </div>
          </div>
          <span class="command-chevron" aria-hidden="true">⌄</span>
        </button>
        ${expanded ? commandDetailContent(command) : ''}
      </article>
    `;
  }).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function changeTagClass(type) {
  const clean = String(type || 'changed').toLowerCase();
  if (clean.includes('new')) return 'new';
  if (clean.includes('improved')) return 'improved';
  if (clean.includes('fix')) return 'fixed';
  return 'changed';
}

function renderChangelog(entries) {
  if (!changelogEls.list) return;

  if (!Array.isArray(entries) || !entries.length) {
    changelogEls.list.innerHTML = '<div class="empty-card">No changelog entries yet.</div>';
    return;
  }

  changelogEls.list.innerHTML = entries.map((entry) => {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    return `
      <article class="changelog-card">
        <div class="changelog-version">
          <div>
            <span class="version-badge">${escapeHtml(entry.version)}</span>
            <h3>${escapeHtml(entry.title || 'Update')}</h3>
          </div>
          <time>${escapeHtml(entry.date || '')}</time>
        </div>
        <ul>
          ${changes.map((change) => `
            <li>
              <span class="change-tag ${changeTagClass(change.type)}">${escapeHtml(change.type || 'Changed')}</span>
              <p>${escapeHtml(change.text || change)}</p>
            </li>
          `).join('')}
        </ul>
      </article>
    `;
  }).join('');
}

async function loadChangelog() {
  try {
    const res = await fetch('/changelog.json', { cache: 'no-store' });
    const entries = await res.json();
    renderChangelog(entries);
  } catch (err) {
    if (changelogEls.list) {
      changelogEls.list.innerHTML = '<div class="empty-card">Could not load changelog.</div>';
    }
  }
}

async function loadBotStats() {
  try {
    const res = await fetch('/api/bot-stats', { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok || !data.ok) throw new Error(data.error || 'Stats unavailable');

    const botName = data.botName || 'Discord Bot';
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

    document.querySelectorAll('[data-invite-link]').forEach((link) => setSafeLink(link, data.inviteUrl));
  } catch (err) {
    setText(statEls.status, 'Offline');
    setText(statEls.statusPill, 'Bot API offline');
    setText(statEls.updated, 'Connect BOT_API_URL in Railway to show live stats');
    setBotName('Discord Bot');
    setAvatar(null, 'Discord Bot');
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
    if (commandEls.grid) commandEls.grid.innerHTML = '<div class="empty-card">Commands API offline.</div>';
  }
}

async function loadSiteConfig() {
  try {
    const res = await fetch('/api/site-config', { cache: 'no-store' });
    const data = await res.json();
    setSafeLink(siteEls.supportLink, data.supportServerUrl);
    setSafeLink(siteEls.bugLink, data.bugReportUrl);
    setSafeLink(siteEls.featureLink, data.featureRequestUrl);
  } catch (err) {
    // Optional links can stay as placeholders until configured in Railway variables.
  }
}

commandEls.search?.addEventListener('input', () => {
  expandedCommandName = null;
  renderCommands();
});

commandEls.grid?.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-command-name]');
  if (!trigger) return;
  const name = trigger.dataset.commandName;
  expandedCommandName = expandedCommandName === name ? null : name;
  renderCommands();
});

commandEls.tabs?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category || 'all';
  expandedCommandName = null;
  renderCategoryTabs(allCommands);
  renderCommands();
});

loadBotStats();
loadCommands();
loadChangelog();
loadSiteConfig();
setInterval(loadBotStats, 30000);
setInterval(loadCommands, 60000);
