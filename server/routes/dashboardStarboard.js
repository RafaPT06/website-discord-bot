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

function normalizeThreshold(value) {
  const threshold = Number(value ?? 3);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 50) {
    const error = new Error('Starboard threshold must be a whole number between 1 and 50.');
    error.statusCode = 400;
    throw error;
  }
  return threshold;
}

function normalizeEmoji(value) {
  const emoji = String(value || '⭐').trim();
  if (!emoji || emoji.length > 64) {
    const error = new Error('Starboard emoji must be between 1 and 64 characters.');
    error.statusCode = 400;
    throw error;
  }
  return emoji;
}

function normalizeChannelId(value, enabled) {
  if (!enabled && (value === null || value === undefined || value === '')) return null;
  const channelId = String(value || '').trim();
  if (!/^\d{15,25}$/.test(channelId)) {
    const error = new Error('Choose a valid starboard channel.');
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

router.get('/dashboard/servers/:guildId/starboard', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/starboard`, { timeoutMs: 6500 });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not load starboard settings.');
  }
});

router.put('/dashboard/servers/:guildId/starboard', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const payload = {
      enabled,
      channelId: normalizeChannelId(req.body?.channelId, enabled),
      threshold: normalizeThreshold(req.body?.threshold),
      emoji: normalizeEmoji(req.body?.emoji),
    };

    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/starboard`, {
      method: 'PUT',
      timeoutMs: 6500,
      body: JSON.stringify(payload),
    });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not save starboard settings.');
  }
});

module.exports = { router };
