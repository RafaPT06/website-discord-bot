const express = require('express');
const { requestBotApi, getBotApiDiagnostics } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_CHANNEL_TYPES = Object.freeze({
  GUILD_TEXT: 0,
  GUILD_ANNOUNCEMENT: 5,
  GUILD_FORUM: 15,
  GUILD_MEDIA: 16,
});
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const USER_GUILDS_CACHE_MS = 45 * 1000;
const userGuildCache = new Map();

function getOwnerId() {
  return process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DASHBOARD_OWNER_ID || '861228909851705366';
}

function isBotOwner(session) {
  const ownerId = getOwnerId();
  return Boolean(ownerId && session?.user?.id === ownerId);
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
  const ownerMode = options.ownerMode === true && isBotOwner(session);
  const [botData, userGuilds] = await Promise.all([
    requestBotApi('/api/guilds'),
    getUserGuilds(session),
  ]);

  const rawBotGuilds = Array.isArray(botData.guilds) ? botData.guilds : [];
  const botGuilds = new Map(rawBotGuilds.map((guild) => [guild.id, guild]));
  const manageable = userGuilds.filter((guild) => hasManageGuild(guild.permissions));
  const manageableIds = new Set(manageable.map((guild) => guild.id));

  const installed = [];
  const available = [];

  if (ownerMode) {
    for (const botGuild of rawBotGuilds) {
      installed.push({
        id: botGuild.id,
        name: botGuild.name,
        iconUrl: botGuildIcon(botGuild),
        memberCount: botGuild.memberCount ?? null,
        manageUrl: `/dashboard/server/${encodeURIComponent(botGuild.id)}`,
        accessLabel: manageableIds.has(botGuild.id) ? 'Manage Server' : 'Owner View',
        ownerView: true,
        manageable: manageableIds.has(botGuild.id),
      });
    }
  } else {
    for (const guild of manageable) {
      const botGuild = botGuilds.get(guild.id);
      if (botGuild) {
        installed.push({
          id: guild.id,
          name: botGuild.name || guild.name,
          iconUrl: botGuildIcon(botGuild) || discordGuildIcon(guild),
          memberCount: botGuild.memberCount ?? null,
          manageUrl: `/dashboard/server/${encodeURIComponent(guild.id)}`,
          accessLabel: 'Manage Server',
          ownerView: false,
          manageable: true,
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
  }

  installed.sort((a, b) => a.name.localeCompare(b.name));
  available.sort((a, b) => a.name.localeCompare(b.name));

  return { installed, available, botGuilds, manageable, isOwner: isBotOwner(session), ownerMode };
}


function normalizeDiscordChannel(channel) {
  if (!channel) return null;
  const rawType = channel.type ?? channel.channelType;
  const numericType = Number(rawType);
  const textTypes = new Set([
    DISCORD_CHANNEL_TYPES.GUILD_TEXT,
    DISCORD_CHANNEL_TYPES.GUILD_ANNOUNCEMENT,
    DISCORD_CHANNEL_TYPES.GUILD_FORUM,
    DISCORD_CHANNEL_TYPES.GUILD_MEDIA,
  ]);
  const stringType = String(rawType ?? '').toUpperCase();
  const isText = textTypes.has(numericType)
    || !stringType
    || ['0', 'TEXT', 'GUILD_TEXT', '5', 'ANNOUNCEMENT', 'GUILD_ANNOUNCEMENT', '15', 'FORUM', 'GUILD_FORUM', '16', 'MEDIA', 'GUILD_MEDIA'].includes(stringType);
  if (!isText) return null;

  const id = channel.id || channel.channelId;
  const name = channel.name || channel.label;
  if (!id || !name) return null;

  const typeName = numericType === DISCORD_CHANNEL_TYPES.GUILD_ANNOUNCEMENT ? 'GUILD_ANNOUNCEMENT'
    : numericType === DISCORD_CHANNEL_TYPES.GUILD_FORUM ? 'GUILD_FORUM'
    : numericType === DISCORD_CHANNEL_TYPES.GUILD_MEDIA ? 'GUILD_MEDIA'
    : stringType || 'GUILD_TEXT';

  return {
    id: String(id),
    name: String(name).replace(/^#\s*/, ''),
    type: typeName,
    position: Number.isFinite(Number(channel.position)) ? Number(channel.position) : 0,
  };
}

function getDiscordBotToken() {
  return process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN || process.env.DISCORD_TOKEN || '';
}

async function requestDiscordGuildChannels(guildId) {
  const token = getDiscordBotToken();
  if (!token) {
    const error = new Error('No Discord bot token is configured for channel lookup. Set DISCORD_BOT_TOKEN on the website service or expose /api/guilds/:guildId/channels from BOT_API_URL.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${DISCORD_API}/guilds/${encodeURIComponent(guildId)}/channels`, {
    headers: { authorization: `Bot ${token}` },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || `Discord channel API returned ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

function sortDashboardChannels(channels) {
  return channels
    .map(normalizeDiscordChannel)
    .filter(Boolean)
    .sort((a, b) => (a.position - b.position) || a.name.localeCompare(b.name));
}

async function getDashboardServerChannels(guildId) {
  const errors = [];

  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(guildId)}/channels`);
    const raw = Array.isArray(data?.channels) ? data.channels : (Array.isArray(data) ? data : []);
    const channels = sortDashboardChannels(raw);
    if (channels.length) return { channels, source: 'bot-api', errors };
  } catch (err) {
    errors.push(`BOT_API_URL channel route: ${err.message || 'unavailable'}`);
  }

  try {
    const raw = await requestDiscordGuildChannels(guildId);
    const channels = sortDashboardChannels(raw);
    return { channels, source: 'discord-api', errors };
  } catch (err) {
    errors.push(`Discord channel API: ${err.message || 'unavailable'}`);
  }

  return { channels: [], source: null, errors };
}

function botGuildToDashboardServer(guild, session, manageableIds = new Set()) {
  return {
    id: guild.id,
    name: guild.name,
    iconUrl: botGuildIcon(guild),
    memberCount: guild.memberCount ?? null,
    manageUrl: `/dashboard/server/${encodeURIComponent(guild.id)}`,
    accessLabel: manageableIds.has(guild.id) ? 'Manage Server' : (isBotOwner(session) ? 'Owner View' : 'Manage Server'),
    ownerView: isBotOwner(session) && !manageableIds.has(guild.id),
    manageable: manageableIds.has(guild.id),
  };
}

async function requireManageableInstalledServer(req, res, next) {
  try {
    const ownerMode = isBotOwner(req.sessionData);
    const data = await getDashboardGuildData(req.sessionData, { ownerMode });
    let server = data.installed.find((guild) => guild.id === req.params.guildId);

    if (!server && ownerMode) {
      const botGuild = data.botGuilds.get(req.params.guildId);
      if (botGuild) {
        const manageableIds = new Set(data.manageable.map((guild) => guild.id));
        server = botGuildToDashboardServer(botGuild, req.sessionData, manageableIds);
      }
    }

    if (!server) return res.status(403).json({ ok: false, error: 'You can only manage servers where you have Manage Server and Meowz is installed.' });
    req.dashboardServer = server;
    req.isDashboardOwner = ownerMode;
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
    res.status(err.statusCode || 502).json({
      ok: false,
      error: err.message || 'Could not reach the bot API.',
      diagnostics: getBotApiDiagnostics(),
    });
  }
});

router.get('/bot-stats/diagnostics', async (req, res) => {
  const diagnostics = getBotApiDiagnostics();
  let statsOk = false;
  let error = null;
  try {
    await requestBotApi('/api/stats');
    statsOk = true;
  } catch (err) {
    error = err.message || 'Could not reach the bot API.';
  }
  res.status(statsOk ? 200 : 502).json({ ok: statsOk, diagnostics, error, checkedAt: new Date().toISOString() });
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
    const requestedMode = String(req.query.mode || '').toLowerCase();
    const data = await getDashboardGuildData(req.sessionData, { ownerMode: requestedMode === 'owner' });
    res.json({
      ok: true,
      installed: data.installed,
      available: data.available,
      isOwner: data.isOwner,
      ownerMode: data.ownerMode,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load dashboard servers.' });
  }
});

router.get('/dashboard/servers/:guildId', requireAuth, requireManageableInstalledServer, async (req, res) => {
  const channelData = await getDashboardServerChannels(req.params.guildId);
  res.json({
    ok: true,
    server: { ...req.dashboardServer, channels: channelData.channels, channelSource: channelData.source },
    channelSource: channelData.source,
    channelErrors: channelData.errors,
    updatedAt: new Date().toISOString(),
  });
});

router.get('/dashboard/servers/:guildId/channels', requireAuth, requireManageableInstalledServer, async (req, res) => {
  const channelData = await getDashboardServerChannels(req.params.guildId);
  const status = channelData.channels.length ? 200 : 502;
  res.status(status).json({
    ok: channelData.channels.length > 0,
    channels: channelData.channels,
    source: channelData.source,
    errors: channelData.errors,
    updatedAt: new Date().toISOString(),
  });
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
