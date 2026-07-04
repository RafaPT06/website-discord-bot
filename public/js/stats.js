import { getBotStats } from './api.js';
import { formatNumber, setText } from './utils.js';

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

function clearSkeletons() {
  document.querySelectorAll('.skeleton-card').forEach((el) => el.classList.remove('skeleton-card'));
}

function setBotName(name) {
  const safeName = name || 'Meowz';
  setText(statEls.botName, safeName);
  setText(statEls.botNameHeading, safeName);
  setText(statEls.botNameShort, safeName);
  setText(statEls.footerBotName, safeName);
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

export async function loadBotStats() {
  try {
    const data = await getBotStats();
    if (!data.ok) throw new Error(data.error || 'Stats unavailable');

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
    setText(statEls.updated, err?.message ? `Stats unavailable: ${err.message}` : 'Connect BOT_API_URL in Railway to show live stats');
    setBotName('Meowz');
    setAvatar(null, 'Meowz');
    clearSkeletons();
  }
}

export function initStats() {
  if (statEls.footerYear) statEls.footerYear.textContent = new Date().getFullYear();
  loadBotStats();
  setInterval(loadBotStats, 30000);
}
