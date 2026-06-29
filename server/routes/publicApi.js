const express = require('express');
const { requestBotApi } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const USER_GUILDS_CACHE_MS = 45 * 1000;
const userGuildCache = new Map();


function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session?.user) return res.status(401).json({ ok: false, error: 'Login required.' });
  req.sessionData = session;
  return next();
}

function hasManageGuild(permissions) {
  try {
    const value = BigInt(permissions || '0');
    return (value & ADMINISTRATOR) === ADMINISTRATOR || (value & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

function discordGuildIcon(guild) {
  if (!guild?.icon) return null;
  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=128`;
}

function botGuildIcon(guild) {
  if (guild?.iconUrl) return guild.iconUrl;
  if (!guild?.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
}

function getInviteUrl(guildId) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return 'https://discord.com/oauth2/authorize';
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: '8',
    scope: 'bot applications.commands',
    guild_id: guildId,
    disable_guild_select: 'true',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function getUserGuilds(session) {
  const accessToken = session.accessToken;
  if (!accessToken) {
    const error = new Error('Discord session is missing guild access. Log out and log in again.');
    error.statusCode = 401;
    throw error;
  }

  const userId = session.user?.id || 'unknown';
  const cacheKey = `${userId}:${accessToken.slice(-12)}`;
  const cached = userGuildCache.get(cacheKey);
  if (cached && Date.now() - cached.at < USER_GUILDS_CACHE_MS) {
    return cached.guilds;
  }

  const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? 'Discord is rate limiting server permission checks. Wait a few seconds and try again.'
        : data?.message || 'Could not fetch Discord guilds. Log out and log in again.'
    );
    error.statusCode = response.status;
    throw error;
  }

  const guilds = Array.isArray(data) ? data : [];
  userGuildCache.set(cacheKey, { at: Date.now(), guilds });
  return guilds;
}

async function getDashboardGuildData(session) {
  const [botData, userGuilds] = await Promise.all([
    requestBotApi('/api/guilds'),
    getUserGuilds(session),
  ]);

  const botGuilds = new Map((botData.guilds || []).map((guild) => [guild.id, guild]));
  const manageable = userGuilds.filter((guild) => hasManageGuild(guild.permissions));

  const installed = [];
  const available = [];

  for (const guild of manageable) {
    const botGuild = botGuilds.get(guild.id);
    if (botGuild) {
      installed.push({
        id: guild.id,
        name: botGuild.name || guild.name,
        iconUrl: botGuildIcon(botGuild) || discordGuildIcon(guild),
        memberCount: botGuild.memberCount ?? null,
        manageUrl: `/dashboard/server/${encodeURIComponent(guild.id)}`,
      });
    } else {
      available.push({
        id: guild.id,
        name: guild.name,
        iconUrl: discordGuildIcon(guild),
        inviteUrl: getInviteUrl(guild.id),
      });
    }
  }

  installed.sort((a, b) => a.name.localeCompare(b.name));
  available.sort((a, b) => a.name.localeCompare(b.name));

  return { installed, available, botGuilds, manageable };
}

async function requireManageableInstalledServer(req, res, next) {
  try {
    const data = await getDashboardGuildData(req.sessionData);
    const server = data.installed.find((guild) => guild.id === req.params.guildId);
    if (!server) return res.status(403).json({ ok: false, error: 'You can only manage servers where you have Manage Server and Meowz is installed.' });
    req.dashboardServer = server;
    return next();
  } catch (err) {
    return res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not verify server access.' });
  }
}

router.get('/status', (req, res) => {
  res.json({ ok: true, status: 'online', name: 'Meowz Website', updatedAt: new Date().toISOString() });
});

router.get('/me', (req, res) => {
  const session = readSession(req);
  if (!session?.user) return res.json({ authenticated: false, user: null });
  return res.json({ authenticated: true, user: session.user });
});

router.get('/bot-stats', async (req, res) => {
  try {
    const data = await requestBotApi('/api/stats');
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not reach the bot API.' });
  }
});

router.get('/bot-commands', async (req, res) => {
  try {
    const data = await requestBotApi('/api/commands');
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not reach the bot API.' });
  }
});

router.get('/dashboard/guilds', requireAuth, async (req, res) => {
  try {
    const data = await getDashboardGuildData(req.sessionData);
    res.json({ ok: true, installed: data.installed, available: data.available, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load dashboard servers.' });
  }
});

router.get('/dashboard/servers/:guildId', requireAuth, requireManageableInstalledServer, (req, res) => {
  res.json({ ok: true, server: req.dashboardServer, updatedAt: new Date().toISOString() });
});

router.get('/dashboard/servers/:guildId/image-access', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/image-access`);
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load image access.' });
  }
});

router.post('/dashboard/servers/:guildId/image-access', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/image-access`, {
      method: 'POST',
      body: JSON.stringify({ userId: req.body?.userId }),
    });
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not add user.' });
  }
});

router.delete('/dashboard/servers/:guildId/image-access/:userId', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/image-access/${encodeURIComponent(req.params.userId)}`, {
      method: 'DELETE',
    });
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not remove user.' });
  }
});

module.exports = { router };
