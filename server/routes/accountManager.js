const express = require('express');

const router = express.Router();

const HOST_USER_ID = 3104567111;
const MANAGED_ALT_IDS = new Set([9039839654]);
const ALLOWED_COMMANDS = new Set(['status', 'index', 'help']);
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestBuckets = new Map();

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

function getBaseEmbed(body) {
  const version = cleanString(body.version, 20) || 'unknown';
  return {
    color: 0x8b5cf6,
    footer: { text: `Account Manager v${version}` },
    timestamp: new Date().toISOString(),
  };
}

function buildHelpEmbeds(body) {
  const base = getBaseEmbed(body);
  const rawCommands = Array.isArray(body.commands) ? body.commands.slice(0, 100) : [];
  const commands = rawCommands.map((entry) => {
    const command = cleanString(entry?.command, 80);
    const aliases = Array.isArray(entry?.aliases)
      ? entry.aliases.slice(0, 20).map((alias) => cleanString(alias, 50)).filter(Boolean)
      : [];
    const description = cleanString(entry?.description, 500) || 'No description.';
    return { command, aliases, description };
  }).filter((entry) => entry.command);

  if (commands.length === 0) {
    return [{
      ...base,
      title: 'Account Manager — Help',
      description: 'The client did not provide a command registry.',
    }];
  }

  const fields = commands.map((entry) => {
    const primary = entry.command.replace(/^,/, '');
    const aliases = entry.aliases
      .map((alias) => alias.replace(/^,/, ''))
      .filter((alias) => alias && alias !== primary);
    const aliasLine = aliases.length > 0
      ? `**Aliases:** ${aliases.map((alias) => `\`,${alias}\``).join(', ')}\n`
      : '';

    return {
      name: entry.command,
      value: `${aliasLine}${entry.description}`.slice(0, 1024),
      inline: false,
    };
  });

  const embeds = [];
  for (let i = 0; i < fields.length; i += 20) {
    const pageFields = fields.slice(i, i + 20);
    const page = Math.floor(i / 20) + 1;
    const pages = Math.ceil(fields.length / 20);
    embeds.push({
      ...base,
      title: page === 1 ? 'Account Manager — Help' : `Account Manager — Help (${page}/${pages})`,
      description: page === 1 ? `**${commands.length} commands** from the live v${cleanString(body.version, 20) || 'unknown'} registry.` : undefined,
      fields: pageFields,
    });
  }

  return embeds.slice(0, 10);
}

function buildEmbeds(body) {
  const command = cleanString(body.command, 20);
  const alt = cleanString(body.alt, 40) || 'Unknown alt';
  const altUserId = Number(body.altUserId);
  const host = cleanString(body.host, 40) || 'Unknown host';
  const base = getBaseEmbed(body);

  if (command === 'status') {
    return [{
      ...base,
      title: 'Account Manager — Status',
      fields: [
        { name: 'Alt', value: `${alt} (${altUserId})`, inline: true },
        { name: 'Host', value: host, inline: true },
        { name: 'Mode', value: cleanString(body.mode, 30) || 'none', inline: true },
        { name: 'Character', value: body.characterReady === true ? 'Ready' : 'Not ready', inline: true },
        { name: 'Chat', value: cleanString(body.chat, 50) || 'unknown', inline: true },
      ],
    }];
  }

  if (command === 'index') {
    const count = Math.max(0, Math.min(20, Math.floor(Number(body.count) || 0)));
    return [{
      ...base,
      title: 'Account Manager — Index',
      description: `Managing **${count}** account${count === 1 ? '' : 's'}.`,
      fields: [{ name: 'Alt', value: `${alt} (${altUserId})`, inline: true }],
    }];
  }

  return buildHelpEmbeds(body);
}

router.post('/api/account-manager', express.json({ limit: '32kb' }), async (req, res) => {
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
        embeds: buildEmbeds(body),
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
