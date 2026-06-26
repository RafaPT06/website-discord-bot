import { statEls } from './dom.js';
import { clearSkeletons, formatNumber, setText } from './utils.js';

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

export async function loadBotStats() {
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

export function initFooterYear() {
  if (statEls.footerYear) statEls.footerYear.textContent = new Date().getFullYear();
}
