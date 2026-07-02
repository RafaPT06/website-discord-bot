const express = require('express');
const { requestBotApi } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const USER_GUILDS_CACHE_MS = 45 * 1000;
const userGuildCache = new Map();
let botOwnerCache = null;

async function getBotOwnerId() {
  const envOwner = process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DISCORD_OWNER_ID;
  if (envOwner) return envOwner;
  if (botOwnerCache && Date.now() - botOwnerCache.at < 60 * 1000) return botOwnerCache.ownerId;
  try {
    const data = await requestBotApi('/api/owner');
    botOwnerCache = { at: Date.now(), ownerId: data.ownerId || null };
    return botOwnerCache.ownerId;
  } catch {
    return null;
  }
}

async function isBotOwner(session) {
  const ownerId = await getBotOwnerId();
  return Boolean(ownerId && session?.user?.id && String(ownerId) === String(session.user.id));
}


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

async function getDashboardGuildData(session, options = {}) {
  const [botData, userGuilds] = await Promise.all([
    requestBotApi('/api/guilds'),
    getUserGuilds(session),
  ]);

  const botGuilds = new Map((botData.guilds || []).map((guild) => [guild.id, guild]));
  const manageable = userGuilds.filter((guild) => hasManageGuild(guild.permissions));
  const isOwner = await isBotOwner(session);
  const wantsOwnerMode = options.mode === 'owner' && isOwner;

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
        canManage: true,
        ownerViewOnly: false,
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

  if (!wantsOwnerMode) {
    return { installed, available, botGuilds, manageable, isOwner, mode: 'user' };
  }

  const manageableIds = new Set(manageable.map((guild) => guild.id));
  const allInstalled = Array.from(botGuilds.values()).map((guild) => ({
    id: guild.id,
    name: guild.name,
    iconUrl: botGuildIcon(guild),
    memberCount: guild.memberCount ?? null,
    manageUrl: `/dashboard/server/${encodeURIComponent(guild.id)}`,
    canManage: manageableIds.has(guild.id),
    ownerViewOnly: !manageableIds.has(guild.id),
  })).sort((a, b) => a.name.localeCompare(b.name));

  return { installed: allInstalled, available: [], botGuilds, manageable, isOwner, mode: 'owner' };
}


async function requireManageableInstalledServer(req, res, next) {
  try {
    let data = await getDashboardGuildData(req.sessionData, { mode: req.query.mode });
    let server = data.installed.find((guild) => guild.id === req.params.guildId);

    // The bot owner must be able to manage/view every server where Meowz is installed,
    // even when they do not personally have Discord's Manage Server permission there.
    // Some feature routes are opened without ?mode=owner, so retry in owner mode before
    // rejecting access. Normal users still keep the Manage Server requirement.
    if (!server && data.isOwner) {
      data = await getDashboardGuildData(req.sessionData, { mode: 'owner' });
      server = data.installed.find((guild) => guild.id === req.params.guildId);
    }

    if (!server) {
      return res.status(403).json({ ok: false, error: 'You can only manage servers where you have Manage Server and Meowz is installed.' });
    }

    req.dashboardServer = server;
    req.dashboardMode = data.mode;
    req.isDashboardOwner = data.isOwner;
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
    const requestedMode = req.query.mode === 'owner' ? 'owner' : 'user';
    const data = await getDashboardGuildData(req.sessionData, { mode: requestedMode });
    res.json({
      ok: true,
      installed: data.installed,
      available: data.available,
      isOwner: data.isOwner,
      mode: data.mode,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load dashboard servers.' });
  }
});

router.get('/dashboard/servers/:guildId', requireAuth, requireManageableInstalledServer, (req, res) => {
  res.json({ ok: true, server: req.dashboardServer, mode: req.dashboardMode, isOwner: req.isDashboardOwner, updatedAt: new Date().toISOString() });
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


router.get('/dashboard/servers/:guildId/leveling', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/leveling`);
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load leveling settings.' });
  }
});

router.put('/dashboard/servers/:guildId/leveling', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/leveling`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
        xpPerMessage: req.body?.xpPerMessage,
        cooldownSeconds: req.body?.cooldownSeconds,
        channelId: req.body?.channelId,
      }),
    });
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not save leveling settings.' });
  }
});


router.get('/dashboard/servers/:guildId/welcome', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/welcome`);
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load welcome settings.' });
  }
});

router.put('/dashboard/servers/:guildId/welcome', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/welcome`, {
      method: 'PUT',
      body: JSON.stringify({
        welcomeEnabled: typeof req.body?.welcomeEnabled === 'boolean' ? req.body.welcomeEnabled : undefined,
        goodbyeEnabled: typeof req.body?.goodbyeEnabled === 'boolean' ? req.body.goodbyeEnabled : undefined,
        welcomeChannelId: req.body?.welcomeChannelId,
        goodbyeChannelId: req.body?.goodbyeChannelId,
        welcomeMessage: req.body?.welcomeMessage,
        goodbyeMessage: req.body?.goodbyeMessage,
      }),
    });
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not save welcome settings.' });
  }
});

router.get('/dashboard/servers/:guildId/logs', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/logs`);
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load log settings.' });
  }
});

router.put('/dashboard/servers/:guildId/logs', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/logs`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
        channelId: req.body?.channelId,
        messageEvents: typeof req.body?.messageEvents === 'boolean' ? req.body.messageEvents : undefined,
        memberEvents: typeof req.body?.memberEvents === 'boolean' ? req.body.memberEvents : undefined,
        moderationEvents: typeof req.body?.moderationEvents === 'boolean' ? req.body.moderationEvents : undefined,
      }),
    });
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not save log settings.' });
  }
});

router.get('/dashboard/servers/:guildId/moderation', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/moderation`);
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load moderation settings.' });
  }
});

router.put('/dashboard/servers/:guildId/moderation', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/moderation`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
        warningsEnabled: typeof req.body?.warningsEnabled === 'boolean' ? req.body.warningsEnabled : undefined,
        automodEnabled: typeof req.body?.automodEnabled === 'boolean' ? req.body.automodEnabled : undefined,
        modLogChannelId: req.body?.modLogChannelId,
        blockedWords: req.body?.blockedWords,
      }),
    });
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not save moderation settings.' });
  }
});

module.exports = { router };
