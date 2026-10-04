const express = require('express');

const router = express.Router();

const HOST_USER_ID = 3104567111;
const MANAGED_ALT_IDS = new Set([9039839654]);
const ALLOWED_COMMANDS = new Set(['status', 'index', 'help']);
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestBuckets = new Map();

const HELP_LINES = [
  ',bring | ,line <left/right/front/back>',
  ',follow [player] | ,unfollow',
  ',stand | ,standdown',
  ',orbit [player] [speed] [radius] | ,unorbit',
  ',ws <speed> | ,resetws',
  ',dance [1/2/3] | ,undance',
  ',wave | ,cheer | ,laugh | ,point',
  ',applaud | ,shrug | ,emote <name>',
  ',say <message> | ,reset | ,rejoin',
  ',index | ,promo | ,animid | ,meatballify | ,end',
];

function cleanString(value, maxLength = 100) {
  return String(value ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, maxLength);
}

function getClientKey(req) {
  return cleanString(req.ip || req.socket?.remoteAddress || 'unknown', 200);
}

function isRateLimited(req) {
  const key = getClientKey(req);
  const now = Date.now();
  const existing = requestBuckets.get(key);

  if (!existing || now - existing.startedAt >= WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }

  existing.count += 1;
  return existing.count > MAX_REQUESTS_PER_WINDOW;
}

function buildEmbed(body) {
  const command = cleanString(body.command, 20);
  const alt = cleanString(body.alt, 40) || 'Unknown alt';
  const altUserId = Number(body.altUserId);
  const host = cleanString(body.host, 40) || 'Unknown host';
  const version = cleanString(body.version, 20) || 'unknown';

  const base = {
    color: 0x8b5cf6,
    footer: { text: `Account Manager v${version}` },
    timestamp: new Date().toISOString(),
  };

  if (command === 'status') {
    return {
      ...base,
      title: 'Account Manager — Status',
      fields: [
        { name: 'Alt', value: `${alt} (${altUserId})`, inline: true },
        { name: 'Host', value: host, inline: true },
        { name: 'Mode', value: cleanString(body.mode, 30) || 'none', inline: true },
        { name: 'Character', value: body.characterReady === true ? 'Ready' : 'Not ready', inline: true },
        { name: 'Chat', value: cleanString(body.chat, 50) || 'unknown', inline: true },
      ],
    };
  }

  if (command === 'index') {
    const count = Math.max(0, Math.min(20, Math.floor(Number(body.count) || 0)));
    return {
      ...base,
      title: 'Account Manager — Index',
      description: `Managing **${count}** account${count === 1 ? '' : 's'}.`,
      fields: [{ name: 'Alt', value: `${alt} (${altUserId})`, inline: true }],
    };
  }

  return {
    ...base,
    title: 'Account Manager — Help',
    description: HELP_LINES.map((line) => `\`${line}\``).join('\n'),
    fields: [{ name: 'Alt', value: `${alt} (${altUserId})`, inline: true }],
  };
}

router.post('/api/account-manager', express.json({ limit: '8kb' }), async (req, res) => {
  if (isRateLimited(req)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const webhookUrl = String(process.env.ACCOUNT_MANAGER_WEBHOOK_URL || '').trim();
  if (!webhookUrl) {
    return res.status(503).json({ ok: false, error: 'webhook_not_configured' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const command = cleanString(body.command, 20).toLowerCase();
  const altUserId = Number(body.altUserId);
  const hostUserId = Number(body.hostUserId);

  if (!ALLOWED_COMMANDS.has(command)) {
    return res.status(400).json({ ok: false, error: 'unsupported_command' });
  }

  if (hostUserId !== HOST_USER_ID || !MANAGED_ALT_IDS.has(altUserId)) {
    return res.status(403).json({ ok: false, error: 'account_not_allowed' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Meowz Account Manager',
        allowed_mentions: { parse: [] },
        embeds: [buildEmbed(body)],
      }),
    });

    if (!response.ok) {
      console.error('[Account Manager] Discord webhook failed:', response.status);
      return res.status(502).json({ ok: false, error: 'discord_webhook_failed' });
    }

    return res.status(204).end();
  } catch (error) {
    console.error('[Account Manager] Discord webhook request failed:', error);
    return res.status(502).json({ ok: false, error: 'discord_webhook_failed' });
  }
});

module.exports = { router };
