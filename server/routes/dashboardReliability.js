const express = require('express');
const { requestBotApi, getBotApiDiagnostics } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const USER_GUILDS_CACHE_MS = 45_000;
const BOT_GUILDS_CACHE_MS = 10_000;
const userGuildCache = new Map();
let botGuildCache = null;

function getOwnerId() {
  return String(process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DASHBOARD_OWNER_ID || '').trim();
}

function isBotOwner(session) {
  const ownerId = getOwnerId();
  return Boolean(ownerId && session?.user?.id === ownerId);
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

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: options.signal || controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed with ${response.status}.`);
      error.statusCode = response.status;
      throw error;
    }
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') {
      const error = new Error('Discord permission check timed out.');
      error.statusCode = 504;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function getUserGuilds(session) {
  if (!session?.accessToken) {
    const error = new Error('Discord session is missing guild access. Log out and log in again.');
    error.statusCode = 401;
    throw error;
  }
  const userId = session.user?.id || 'unknown';
  const cacheKey = `${userId}:${session.accessToken.slice(-12)}`;
  const cached = userGuildCache.get(cacheKey);
  if (cached && Date.now() - cached.at < USER_GUILDS_CACHE_MS) return cached.guilds;
  const guilds = await fetchJsonWithTimeout(`${DISCORD_API}/users/@me/guilds`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  const normalized = Array.isArray(guilds) ? guilds : [];
  userGuildCache.set(cacheKey, { at: Date.now(), guilds: normalized });
  return normalized;
}

async function getInstalledGuildIds() {
  if (botGuildCache && Date.now() - botGuildCache.at < BOT_GUILDS_CACHE_MS) return botGuildCache.ids;
  const data = await requestBotApi('/api/guilds', { timeoutMs: 5500 });
  const ids = new Set((Array.isArray(data?.guilds) ? data.guilds : []).map((guild) => String(guild.id)));
  botGuildCache = { at: Date.now(), ids };
  return ids;
}

async function requireDashboardServerAccess(req, res, next) {
  const guildId = String(req.params.guildId || '').trim();
  if (!/^\d{15,25}$/.test(guildId)) return res.status(400).json({ ok: false, error: 'Invalid Discord server ID.' });
  try {
    const installedIds = await getInstalledGuildIds();
    if (!installedIds.has(guildId)) return res.status(404).json({ ok: false, error: 'Meowz is not installed in this server.' });
    if (!isBotOwner(req.sessionData)) {
      const guilds = await getUserGuilds(req.sessionData);
      const guild = guilds.find((item) => String(item.id) === guildId);
      if (!guild || !hasManageGuild(guild.permissions)) {
        return res.status(403).json({ ok: false, error: 'Manage Server permission is required.' });
      }
    }
    req.guildId = guildId;
    return next();
  } catch (err) {
    return res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not verify server access.' });
  }
}

function discordAvatar(user, size = 96) {
  if (!user?.id || !user?.avatar) return null;
  const ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

function mergeDefaultAccessUsers(req, data = {}) {
  const defaults = Array.isArray(data.defaultUsers) ? [...data.defaultUsers] : [];
  const seen = new Set(defaults.map((user) => String(user.userId || user.id || '')).filter(Boolean));
  const ownerId = getOwnerId();
  if (ownerId && !seen.has(ownerId)) {
    defaults.unshift({ userId: ownerId, displayName: 'Bot Owner', username: null, avatarUrl: null, source: 'bot_owner', removable: false });
    seen.add(ownerId);
  }
  const sessionUser = req.sessionData?.user;
  if (sessionUser?.id && !seen.has(String(sessionUser.id))) {
    defaults.push({
      userId: String(sessionUser.id),
      displayName: sessionUser.globalName || sessionUser.username || 'Current Manager',
      username: sessionUser.username ? `@${sessionUser.username}` : null,
      avatarUrl: discordAvatar(sessionUser),
      source: isBotOwner(req.sessionData) ? 'bot_owner' : 'manage_server',
      removable: false,
    });
  }
  return { ...data, defaultUsers: defaults };
}

function normalizeSnowflake(value, label, { nullable = false } = {}) {
  if ((value === null || value === '' || value === undefined) && nullable) return null;
  const clean = String(value || '').trim();
  if (!/^\d{15,25}$/.test(clean)) {
    const error = new Error(`Invalid ${label}.`);
    error.statusCode = 400;
    throw error;
  }
  return clean;
}

function normalizeLevel(value) {
  const level = Number(value);
  if (!Number.isInteger(level) || level < 1 || level > 1000) {
    const error = new Error('Reward level must be a whole number between 1 and 1000.');
    error.statusCode = 400;
    throw error;
  }
  return level;
}

function normalizeLevelingPayload(body = {}) {
  const xp = Number(body.xpPerMessage);
  const cooldown = Number(body.cooldownSeconds);
  if (!Number.isFinite(xp) || xp < 1 || xp > 500) {
    const error = new Error('XP per message must be between 1 and 500.');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(cooldown) || cooldown < 5 || cooldown > 3600) {
    const error = new Error('Cooldown must be between 5 and 3600 seconds.');
    error.statusCode = 400;
    throw error;
  }
  return {
    enabled: Boolean(body.enabled),
    channelId: normalizeSnowflake(body.channelId, 'level-up channel ID', { nullable: true }),
    xpPerMessage: Math.round(xp),
    cooldownSeconds: Math.round(cooldown),
    stackRoles: Boolean(body.stackRoles),
  };
}

function normalizeModerationPayload(body = {}) {
  return {
    enabled: Boolean(body.enabled),
    warningsEnabled: Boolean(body.warningsEnabled),
    automodEnabled: Boolean(body.automodEnabled),
    antiSpam: Boolean(body.antiSpam),
    linkFilter: Boolean(body.linkFilter),
    inviteFilter: Boolean(body.inviteFilter),
    modLogChannelId: normalizeSnowflake(body.modLogChannelId, 'moderation log channel ID', { nullable: true }),
    blockedWords: String(body.blockedWords || '').trim().slice(0, 2000),
  };
}

function apiError(res, err, fallback) {
  return res.status(err.statusCode || 502).json({
    ok: false,
    error: err.message || fallback,
    errors: Array.isArray(err.errors) ? err.errors : [],
    diagnostics: getBotApiDiagnostics(),
  });
}

router.get('/dashboard/servers/:guildId/leveling', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    return res.json(await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/leveling`, { timeoutMs: 6500 }));
  } catch (err) {
    return apiError(res, err, 'Could not load leveling settings.');
  }
});

router.put('/dashboard/servers/:guildId/leveling', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    const payload = normalizeLevelingPayload(req.body || {});
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/leveling`, {
      method: 'PUT',
      timeoutMs: 6500,
      body: JSON.stringify(payload),
    });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not save leveling settings.');
  }
});

router.get('/dashboard/servers/:guildId/level-rewards', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/level-rewards`, { timeoutMs: 6500 });
    const rewards = Array.isArray(data?.rewards) ? data.rewards : [];
    return res.json({ ...data, ok: data?.ok !== false, rewards, available: true, sourcePath: `/api/guilds/${req.guildId}/level-rewards` });
  } catch (err) {
    return apiError(res, err, 'Could not load level rewards.');
  }
});

router.post('/dashboard/servers/:guildId/level-rewards', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    const level = normalizeLevel(req.body?.level);
    const roleId = normalizeSnowflake(req.body?.roleId, 'role ID');
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/level-rewards`, {
      method: 'POST',
      timeoutMs: 6500,
      body: JSON.stringify({ level, roleId }),
    });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not save level reward.');
  }
});

router.delete('/dashboard/servers/:guildId/level-rewards/:level', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    const level = normalizeLevel(req.params.level);
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/level-rewards/${encodeURIComponent(level)}`, {
      method: 'DELETE',
      timeoutMs: 6500,
    });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not remove level reward.');
  }
});

router.get('/dashboard/servers/:guildId/moderation', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    return res.json(await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/moderation`, { timeoutMs: 6500 }));
  } catch (err) {
    return apiError(res, err, 'Could not load moderation settings.');
  }
});

router.put('/dashboard/servers/:guildId/moderation', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    const payload = normalizeModerationPayload(req.body || {});
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/moderation`, {
      method: 'PUT',
      timeoutMs: 6500,
      body: JSON.stringify(payload),
    });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not save moderation settings.');
  }
});

router.get('/dashboard/servers/:guildId/moderation-access', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/moderation-access`, { timeoutMs: 4500 });
    return res.json({ ...mergeDefaultAccessUsers(req, data), ok: data?.ok !== false, available: true, sourcePath: `/api/guilds/${req.guildId}/moderation-access` });
  } catch (err) {
    return res.json({
      ...mergeDefaultAccessUsers(req, { users: [] }),
      ok: true,
      available: false,
      fallback: true,
      retryable: true,
      errors: [err.message || 'Moderation access API unavailable.'],
      updatedAt: new Date().toISOString(),
    });
  }
});

router.post('/dashboard/servers/:guildId/moderation-access', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    const userId = normalizeSnowflake(req.body?.userId, 'Discord user ID');
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/moderation-access`, {
      method: 'POST',
      timeoutMs: 6500,
      body: JSON.stringify({ userId, addedBy: req.sessionData?.user?.id || null }),
    });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not add moderation bypass user.');
  }
});

router.delete('/dashboard/servers/:guildId/moderation-access/:userId', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    const userId = normalizeSnowflake(req.params.userId, 'Discord user ID');
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.guildId)}/moderation-access/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      timeoutMs: 6500,
    });
    return res.json(data);
  } catch (err) {
    return apiError(res, err, 'Could not remove moderation bypass user.');
  }
});

module.exports = { router };
