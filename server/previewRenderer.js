const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 675;

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
    <text x="${x + r}" y="${y + r + 18}" text-anchor="middle" font-size="54" font-family="Arial, Helvetica, sans-serif" font-weight="800" fill="#ffffff">${fallbackText}</text>`;
}

function bubbleSet() {
  const bubbles = [
    [90, -92, 360, 0.065], [365, 65, 270, 0.045], [660, -78, 330, 0.05], [910, 84, 250, 0.055],
    [40, 320, 250, 0.04], [350, 330, 300, 0.05], [670, 300, 270, 0.04], [935, 350, 230, 0.05],
    [195, 160, 190, 0.03], [535, 170, 180, 0.035], [782, 138, 170, 0.03], [1005, -28, 160, 0.04],
  ];
  return bubbles.map(([x, y, size, alpha]) => `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="rgba(255,255,255,${alpha})" />`).join('');
}

function renderGreetingPreviewSvg(payload = {}) {
  const type = payload.type === 'goodbye' ? 'goodbye' : 'welcome';
  const lines = normalizeLines(
    payload.message,
    type === 'goodbye' ? ['GOODBYE RAFA', 'SEE YOU', 'SOON'] : ['WELCOME RAFA', 'TO', String(payload.serverName || 'PERSONAL')],
    payload,
  );
  const [first, second, third] = lines.map((line) => escapeXml(String(line || '').toUpperCase()));
  const accent = type === 'goodbye' ? '#d7d7d7' : '#8b5cf6';
  const accentDark = type === 'goodbye' ? '#b6b6b6' : '#5b21b6';
  const memberBadge = payload.showMember === false ? '' : `
    <g>
      <rect x="420" y="52" width="360" height="58" rx="16" fill="rgba(255,255,255,.14)" />
      <text x="600" y="89" text-anchor="middle" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="800" fill="#ffffff">MEMBER #${escapeXml(payload.memberCount || 11)}</text>
    </g>`;
  const avatar = payload.showAvatar === false ? '' : renderAvatarCircle({ id: `avatar-${type}`, x: 510, y: 154, size: 180, avatarUrl: payload.avatarUrl || '', fallbackText: initial(payload.userName) });
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${DEFAULT_WIDTH}" height="${DEFAULT_HEIGHT}" viewBox="0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}" role="img" aria-label="${escapeXml(type)} card preview">
    <rect width="100%" height="100%" rx="28" fill="#08090d" />
    ${bubbleSet()}
    <path d="M-70 590 C 40 350, 260 390, 380 620 C 420 700, 280 744, 65 730 C -20 724, -92 680, -70 590Z" fill="${accentDark}" opacity="0.96" />
    <path d="M980 -28 C 1090 -40, 1188 8, 1216 120 C 1225 154, 1200 188, 1140 192 C 1018 202, 934 146, 930 70 C 928 26, 940 -20, 980 -28Z" fill="${accent}" opacity="0.92" />
    ${memberBadge}
    ${avatar}
    <g fill="#ffffff" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900">
      <text x="600" y="470" font-size="64">${first || ''}</text>
      <text x="600" y="534" font-size="30">${second || ''}</text>
      <text x="600" y="592" font-size="52">${third || ''}</text>
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
  const avatar = renderAvatarCircle({ id: 'avatar-levelup', x: 72, y: 154, size: 190, avatarUrl: payload.avatarUrl || '', fallbackText: initial(payload.userName), ring: 'rgba(255,255,255,.16)' });
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${DEFAULT_WIDTH}" height="${DEFAULT_HEIGHT}" viewBox="0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}" role="img" aria-label="Level up card preview">
    <rect width="100%" height="100%" rx="28" fill="#08090d" />
    ${bubbleSet()}
    <path d="M-52 624 C 40 384, 300 402, 376 658 C 396 726, 286 760, 98 744 C 14 736, -78 704, -52 624Z" fill="#d0d0d0" opacity="0.75" />
    ${avatar}
    <g fill="#ffffff" font-family="Arial, Helvetica, sans-serif">
      <text x="350" y="214" font-size="72" font-weight="900">LEVEL UP!</text>
      <text x="350" y="282" font-size="38" font-weight="700">${username}</text>
      <text x="930" y="188" font-size="28" font-weight="700" fill="rgba(255,255,255,.74)">LEVEL</text>
      <text x="930" y="240" font-size="48" font-weight="900">${level} &gt; ${nextLevel}</text>
      <text x="930" y="292" font-size="30" font-weight="800">${formatNumber(currentXp)} / ${formatNumber(requiredXp)} XP</text>
      <rect x="350" y="366" width="760" height="74" rx="37" fill="rgba(255,255,255,.36)" />
      <rect x="350" y="366" width="${Math.max(50, Math.round(760 * (progress / 100)))}" height="74" rx="37" fill="#ffffff" />
      <text x="600" y="558" text-anchor="middle" font-size="34" font-weight="800">TOTAL : ${formatNumber(totalXp)} XP</text>
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
