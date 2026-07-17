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
      const error = new Error('Discord request timed out.');
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

function normalizeRoleName(value) {
  const name = String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!name || name.length > 100) {
    const error = new Error('Role name must be between 1 and 100 characters.');
    error.statusCode = 400;
    throw error;
  }
  if (name.toLowerCase() === '@everyone') {
    const error = new Error('The @everyone role cannot be created or replaced.');
    error.statusCode = 400;
    throw error;
  }
  return name;
}

async function createDashboardRole(guildId, name, createdBy) {
  try {
    return await requestBotApi(`/api/guilds/${encodeURIComponent(guildId)}/roles`, {
      method: 'POST',
      timeoutMs: 7000,
      body: JSON.stringify({ name, createdBy }),
    });
  } catch (err) {
    const status = Number(err.statusCode || 0);
    if ([404, 405, 501].includes(status)) {
      const deploymentError = new Error('The deployed Meowz bot service is outdated and does not support role creation yet. Redeploy the bot service from the latest main branch, then try again.');
      deploymentError.statusCode = 503;
      throw deploymentError;
    }
    throw err;
  }
}

router.post('/dashboard/servers/:guildId/roles', requireAuth, requireDashboardServerAccess, async (req, res) => {
  try {
    const name = normalizeRoleName(req.body?.name);
    const data = await createDashboardRole(req.guildId, name, req.sessionData?.user?.id || null);
    return res.status(data?.created ? 201 : 200).json(data);
  } catch (err) {
    return res.status(err.statusCode || 502).json({
      ok: false,
      error: err.message || 'Could not create the Discord role.',
      diagnostics: getBotApiDiagnostics(),
    });
  }
});

module.exports = { router };
