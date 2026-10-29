const express = require('express');
const { requestBotApi, getBotApiDiagnostics } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const ACCESS_CACHE_MS = 30_000;
const guildAccessCache = new Map();

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

function accessCacheKey(session, guildId) {
  return `${String(session?.user?.id || 'unknown')}:${guildId}`;
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

  const cacheKey = accessCacheKey(req.sessionData, guildId);
  const cached = guildAccessCache.get(cacheKey);
  if (cached && Date.now() - cached.at < ACCESS_CACHE_MS) {
    req.guildId = guildId;
    return next();
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

    guildAccessCache.set(cacheKey, { at: Date.now() });
    req.guildId = guildId;
    return next();
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message || 'Could not verify Discord server access.' });
  }
}

function apiError(res, err, fallback) {
  return res.status(err.statusCode || 502).json({
    ok: false,
    error: err.message || fallback,
    diagnostics: getBotApiDiagnostics(),
  });
}

function normalizeSnapshotName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name) return null;
  if (name.length > 80) {
    const error = new Error('Snapshot name must be 80 characters or fewer.');
    error.statusCode = 400;
    throw error;
  }
  return name;
}

function normalizeSnapshotReason(value) {
  const reason = String(value || '').trim().replace(/\s+/g, ' ');
  if (!reason) return null;
  if (reason.length > 240) {
    const error = new Error('Snapshot reason must be 240 characters or fewer.');
    error.statusCode = 400;
    throw error;
  }
  return reason;
}

router.get('/dashboard/servers/:guildId/layout', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/layout`, { timeoutMs: 10_000 });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not load the server layout.');
  }
});

router.get('/dashboard/servers/:guildId/layout/snapshots', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/layout/snapshots`, { timeoutMs: 10_000 });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not load server layout snapshots.');
  }
});

router.post('/dashboard/servers/:guildId/layout/snapshots', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const payload = {
      name: normalizeSnapshotName(req.body?.name),
      reason: normalizeSnapshotReason(req.body?.reason),
      source: 'dashboard',
    };
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/layout/snapshots`, {
      method: 'POST',
      timeoutMs: 20_000,
      body: JSON.stringify(payload),
    });
    return res.status(201).json(data);
  } catch (err) {
    return apiError(res, err, 'Could not create a server layout snapshot.');
  }
});

router.get('/dashboard/servers/:guildId/layout/snapshots/:snapshotId', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const snapshotId = encodeURIComponent(String(req.params.snapshotId || '').trim());
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/layout/snapshots/${snapshotId}`, { timeoutMs: 10_000 });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not load that server layout snapshot.');
  }
});

router.get('/dashboard/servers/:guildId/layout/snapshots/:snapshotId/diff', requireAuth, requireServerAccess, async (req, res) => {
  try {
    const snapshotId = encodeURIComponent(String(req.params.snapshotId || '').trim());
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/layout/snapshots/${snapshotId}/diff`, { timeoutMs: 15_000 });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not compare the server with that snapshot.');
  }
});

module.exports = { router };
