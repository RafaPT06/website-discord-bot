const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 560;
const CARD_X = 38;
const CARD_Y = 38;
const CARD_WIDTH = 1124;
const CARD_HEIGHT = 484;
const FONT_STACK = `Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif`;

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeLines(message, fallbackLines, variables = {}) {
  const template = String(message || '').trim() || fallbackLines.join('\n');
  const rendered = template
    .replaceAll('{user}', String(variables.userName || 'Rafa'))
    .replaceAll('{server}', String(variables.serverName || 'PERSONAL'))
    .replaceAll('{memberCount}', String(variables.memberCount || '11'));
  const lines = rendered.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return fallbackLines;
  return lines.slice(0, 3);
}

function initial(value = 'R') {
  return escapeXml(String(value || 'R').trim().charAt(0).toUpperCase() || 'R');
}

function renderAvatarCircle({ id, x, y, size, avatarUrl, fallbackText, ring = 'rgba(255,255,255,.18)' }) {
  const r = size / 2;
  if (avatarUrl) {
    return `
      <defs>
        <clipPath id="${id}">
          <circle cx="${x + r}" cy="${y + r}" r="${r}" />
        </clipPath>
      </defs>
      <circle cx="${x + r}" cy="${y + r}" r="${r}" fill="#090f14" stroke="${ring}" stroke-width="10" />
      <image href="${escapeXml(avatarUrl)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})" />`;
  }
  return `
    <circle cx="${x + r}" cy="${y + r}" r="${r}" fill="#162033" stroke="${ring}" stroke-width="10" />
    <text x="${x + r}" y="${y + r + 18}" text-anchor="middle" font-size="54" font-family="${FONT_STACK}" font-weight="800" fill="#ffffff">${fallbackText}</text>`;
}

function bubbleSet() {
  const bubbles = [
    [80, -88, 320, 0.06], [300, 42, 240, 0.05], [550, -70, 300, 0.045], [820, 14, 280, 0.05],
    [968, -48, 220, 0.05], [36, 240, 220, 0.04], [225, 185, 190, 0.03], [430, 172, 250, 0.04],
    [670, 144, 190, 0.03], [846, 160, 220, 0.04], [984, 220, 210, 0.03], [530, 298, 280, 0.05],
    [780, 310, 280, 0.05], [1015, 320, 200, 0.045], [170, 328, 210, 0.035], [10, 92, 190, 0.035],
  ];
  return bubbles.map(([x, y, size, alpha]) => `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="rgba(255,255,255,${alpha})" />`).join('');
}

function cardFrame(type = 'welcome') {
  const accent = type === 'goodbye' ? '#d9d9de' : '#9f5cff';
  const accentDark = type === 'goodbye' ? '#b9bcc6' : '#6236d9';
  return `
    <defs>
      <linearGradient id="card-sheen-${type}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,.045)" />
        <stop offset="100%" stop-color="rgba(255,255,255,.01)" />
      </linearGradient>
    </defs>
    <rect x="${CARD_X}" y="${CARD_Y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="34" fill="rgba(0,0,0,.68)" stroke="rgba(255,255,255,.08)" stroke-width="2" />
    <rect x="${CARD_X}" y="${CARD_Y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="34" fill="url(#card-sheen-${type})" />
    ${bubbleSet()}
    <path d="M48 452 C 68 342, 246 346, 320 404 C 356 432, 364 480, 368 522 L 48 522 Z" fill="${accentDark}" opacity="0.96" />
    <path d="M62 416 C 104 392, 178 394, 224 426 C 254 446, 276 484, 280 522 L 62 522 Z" fill="${accent}" opacity="0.96" />
    <path d="M968 38 C 1084 20, 1152 50, 1162 130 C 1165 162, 1147 196, 1110 202 L 1002 202 C 1002 202, 978 174, 976 140 C 972 92, 958 60, 968 38 Z" fill="${accent}" opacity="0.95" />`;
}

function renderGreetingPreviewSvg(payload = {}) {
  const type = payload.type === 'goodbye' ? 'goodbye' : 'welcome';
  const lines = normalizeLines(
    payload.message,
    type === 'goodbye' ? ['GOODBYE RAFA', 'LEFT', String(payload.serverName || 'PERSONAL')] : ['WELCOME RAFA', 'TO', String(payload.serverName || 'PERSONAL')],
    payload,
  );
  const [first, second, third] = lines.map((line) => escapeXml(String(line || '').toUpperCase()));
  const memberBadge = payload.showMember === false ? '' : `
    <g>
      <rect x="470" y="76" width="260" height="48" rx="14" fill="rgba(255,255,255,.14)" />
      <text x="600" y="107" text-anchor="middle" font-size="24" font-family="${FONT_STACK}" font-weight="800" letter-spacing=".04em" fill="#ffffff">MEMBER #${escapeXml(payload.memberCount || 11)}</text>
    </g>`;
  const avatar = payload.showAvatar === false ? '' : renderAvatarCircle({ id: `avatar-${type}`, x: 520, y: 145, size: 160, avatarUrl: payload.avatarUrl || '', fallbackText: initial(payload.userName) });
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${DEFAULT_WIDTH}" height="${DEFAULT_HEIGHT}" viewBox="0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}" role="img" aria-label="${escapeXml(type)} card preview">
    ${cardFrame(type)}
    ${memberBadge}
    ${avatar}
    <g fill="#ffffff" text-anchor="middle" font-family="${FONT_STACK}" style="font-variant-emoji:emoji">
      <text x="600" y="362" font-size="54" font-weight="800">${first || ''}</text>
      <text x="600" y="414" font-size="28" font-weight="700" letter-spacing=".08em">${second || ''}</text>
      <text x="600" y="470" font-size="50" font-weight="800">${third || ''}</text>
    </g>
  </svg>`;
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(value) {
  try {
    return new Intl.NumberFormat('en-US').format(Number(value) || 0);
  } catch {
    return String(value || 0);
  }
}

function renderLevelUpPreviewSvg(payload = {}) {
  const level = toNumber(payload.level, 10);
  const nextLevel = toNumber(payload.nextLevel, level + 1);
  const currentXp = Math.max(1, toNumber(payload.currentXp, 4820));
  const requiredXp = Math.max(currentXp, toNumber(payload.requiredXp, 5400));
  const totalXp = Math.max(requiredXp, toNumber(payload.totalXp, 15420));
  const progress = Math.max(2, Math.min(100, Math.round((currentXp / requiredXp) * 100)));
  const username = escapeXml(String(payload.userName || 'Rafa').toUpperCase());
  const avatar = renderAvatarCircle({ id: 'avatar-levelup', x: 72, y: 150, size: 150, avatarUrl: payload.avatarUrl || '', fallbackText: initial(payload.userName), ring: 'rgba(255,255,255,.16)' });
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${DEFAULT_WIDTH}" height="${DEFAULT_HEIGHT}" viewBox="0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}" role="img" aria-label="Level up card preview">
    ${cardFrame('welcome')}
    ${avatar}
    <g fill="#ffffff" font-family="${FONT_STACK}" style="font-variant-emoji:emoji">
      <text x="328" y="190" font-size="54" font-weight="800" letter-spacing=".015em">LEVEL UP!</text>
      <text x="328" y="246" font-size="34" font-weight="700">${username}</text>
      <text x="884" y="174" font-size="24" font-weight="700" fill="rgba(255,255,255,.78)" letter-spacing=".06em">LEVEL</text>
      <text x="884" y="224" font-size="42" font-weight="800">${level} &gt; ${nextLevel}</text>
      <text x="884" y="272" font-size="26" font-weight="800">${formatNumber(currentXp)}/${formatNumber(requiredXp)} XP</text>
      <rect x="328" y="314" width="730" height="56" rx="28" fill="rgba(255,255,255,.42)" />
      <rect x="328" y="314" width="${Math.max(52, Math.round(730 * (progress / 100)))}" height="56" rx="28" fill="#ffffff" />
      <text x="610" y="430" text-anchor="middle" font-size="30" font-weight="800">TOTAL : ${formatNumber(totalXp)} XP</text>
    </g>
  </svg>`;
}

function renderPreviewSvg(kind, payload = {}) {
  if (kind === 'welcome') return renderGreetingPreviewSvg({ ...payload, type: 'welcome' });
  if (kind === 'goodbye') return renderGreetingPreviewSvg({ ...payload, type: 'goodbye' });
  if (kind === 'level-up') return renderLevelUpPreviewSvg(payload);
  const error = new Error('Unsupported preview type.');
  error.statusCode = 400;
  throw error;
}

module.exports = { renderPreviewSvg };
