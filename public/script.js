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

function formatNumber(value) {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function setBotName(name) {
  const safeName = name || 'Discord Bot';
  setText(statEls.botName, safeName);
  setText(statEls.botNameHeading, safeName);
  setText(statEls.botNameShort, safeName);
  setText(statEls.footerBotName, safeName);
  if (document.title !== safeName) document.title = safeName;
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

    if (statEls.inviteLink && data.inviteUrl) {
      statEls.inviteLink.href = data.inviteUrl;
      statEls.inviteLink.target = '_blank';
      statEls.inviteLink.rel = 'noopener noreferrer';
    }
  } catch (err) {
    setText(statEls.status, 'Offline');
    setText(statEls.statusPill, 'Bot API offline');
    setText(statEls.updated, 'Connect BOT_API_URL in Railway to show live stats');
    setBotName('Discord Bot');
    setAvatar(null, 'Discord Bot');
  }
}

loadBotStats();
setInterval(loadBotStats, 30000);
