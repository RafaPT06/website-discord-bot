const statEls = {
  servers: document.querySelector('[data-stat="servers"]'),
  users: document.querySelector('[data-stat="users"]'),
  commands: document.querySelector('[data-stat="commands"]'),
  ping: document.querySelector('[data-stat="ping"]'),
  uptime: document.querySelector('[data-stat="uptime"]'),
  status: document.querySelector('[data-stat="status"]'),
  botName: document.querySelector('[data-bot-name]'),
  botTag: document.querySelector('[data-bot-tag]'),
  avatar: document.querySelector('[data-bot-avatar]'),
  updated: document.querySelector('[data-updated]'),
};

function formatNumber(value) {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

function setText(el, value) {
  if (el) el.textContent = value;
}

async function loadBotStats() {
  try {
    const res = await fetch('/api/bot-stats');
    const data = await res.json();

    if (!res.ok || !data.ok) throw new Error(data.error || 'Stats unavailable');

    setText(statEls.servers, formatNumber(data.servers));
    setText(statEls.users, formatNumber(data.users));
    setText(statEls.commands, formatNumber(data.commands));
    setText(statEls.ping, `${data.ping}ms`);
    setText(statEls.uptime, data.uptime || '—');
    setText(statEls.status, data.online ? 'Live' : 'Offline');
    setText(statEls.botName, data.botName || 'Ruffles Bot');
    setText(statEls.botTag, data.botTag || 'Online and ready');
    setText(statEls.updated, `Updated ${new Date(data.updatedAt).toLocaleTimeString()}`);

    if (statEls.avatar && data.avatarUrl) {
      statEls.avatar.style.backgroundImage = `url('${data.avatarUrl}')`;
      statEls.avatar.textContent = '';
    }
  } catch (err) {
    setText(statEls.status, 'Offline');
    setText(statEls.updated, 'Connect BOT_API_URL in Railway to show live stats');
  }
}

loadBotStats();
setInterval(loadBotStats, 30000);
