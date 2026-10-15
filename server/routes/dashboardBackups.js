const express = require('express');
const { requestBotApi, getBotApiDiagnostics } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

function getOwnerId() {
  return String(process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DASHBOARD_OWNER_ID || '').trim();
}

function isBotOwner(session) {
  const ownerId = getOwnerId();
  return Boolean(ownerId && String(session?.user?.id || '') === ownerId);
}

function hasManageGuild(permissions) {
  try {
    const value = BigInt(permissions || '0');
    return (value & ADMINISTRATOR) === ADMINISTRATOR || (value & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session?.user) return res.status(401).json({ ok: false, error: 'Login required.' });
  req.sessionData = session;
  return next();
}

async function requireServerAccess(req, res, next) {
  const guildId = String(req.params.guildId || '').trim();
  if (!/^\d{15,25}$/.test(guildId)) {
    return res.status(400).json({ ok: false, error: 'Invalid Discord server ID.' });
  }

  if (isBotOwner(req.sessionData)) {
    req.guildId = guildId;
    return next();
  }

  if (!req.sessionData?.accessToken) {
    return res.status(401).json({ ok: false, error: 'Discord session is missing guild access. Log out and log in again.' });
  }

  try {
    const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { authorization: `Bearer ${req.sessionData.accessToken}` },
    });
    const guilds = await response.json().catch(() => []);
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: guilds?.message || 'Could not verify Discord server access.' });
    }

    const guild = (Array.isArray(guilds) ? guilds : []).find((item) => String(item.id) === guildId);
    if (!guild || !hasManageGuild(guild.permissions)) {
      return res.status(403).json({ ok: false, error: 'Manage Server permission is required.' });
    }

    req.guildId = guildId;
    return next();
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message || 'Could not verify Discord server access.' });
  }
}

function normalizeChannelId(value, enabled) {
  if (!enabled && (value === null || value === undefined || value === '')) return null;
  const channelId = String(value || '').trim();
  if (!/^\d{15,25}$/.test(channelId)) {
    const error = new Error('Choose a valid backup channel.');
    error.statusCode = 400;
    throw error;
  }
  return channelId;
}

function apiError(res, err, fallback) {
  return res.status(err.statusCode || 502).json({
    ok: false,
    error: err.message || fallback,
    diagnostics: getBotApiDiagnostics(),
  });
}

router.get('/dashboard/servers/:guildId/backups', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/backups`, { timeoutMs: 6500 });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not load backup settings.');
  }
});

router.put('/dashboard/servers/:guildId/backups', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const payload = {
      enabled,
      channelId: normalizeChannelId(req.body?.channelId, enabled),
    };

    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/backups`, {
      method: 'PUT',
      timeoutMs: 6500,
      body: JSON.stringify(payload),
    });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not save backup settings.');
  }
});

router.post('/dashboard/servers/:guildId/backups/run', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/backups/run`, {
      method: 'POST',
      timeoutMs: 30_000,
      body: JSON.stringify({}),
    });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not run backup.');
  }
});

module.exports = { router };
