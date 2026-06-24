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
};

const siteEls = {
  supportLink: document.querySelector('[data-support-link]'),
  bugLink: document.querySelector('[data-bug-link]'),
  featureLink: document.querySelector('[data-feature-link]'),
};

let allCommands = [];
let activeCategory = 'all';

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

function renderCategoryTabs(commands) {
  if (!commandEls.tabs) return;
  const categories = ['all', ...new Set(commands.map((command) => command.category || 'Other'))];
  commandEls.tabs.innerHTML = categories.map((category) => {
    const label = category === 'all' ? 'All' : category;
    const active = category === activeCategory ? 'active' : '';
    return `<button class="${active}" type="button" data-category="${category}">${label}</button>`;
  }).join('');
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
    return;
  }

  commandEls.grid.innerHTML = filtered.map((command) => {
    const visibility = command.visibility || 'public';
    return `
      <article class="command-card" data-visibility="${visibility}">
        <div class="command-card-top">
          <code>/${command.name}${optionText(command)}</code>
          <span class="visibility-badge ${visibility}">${visibilityLabel(visibility)}</span>
        </div>
        <p>${command.description || 'No description provided.'}</p>
        <div class="command-meta">
          <span>${command.category || 'Other'}</span>
          <span>${command.dm ? 'DMs allowed' : 'Server only'}</span>
        </div>
      </article>
    `;
  }).join('');
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

commandEls.search?.addEventListener('input', renderCommands);
commandEls.tabs?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category || 'all';
  renderCategoryTabs(allCommands);
  renderCommands();
});

loadBotStats();
loadCommands();
loadSiteConfig();
setInterval(loadBotStats, 30000);
setInterval(loadCommands, 60000);
