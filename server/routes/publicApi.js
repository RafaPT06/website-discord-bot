const express = require('express');
const { requestBotApi, getBotApiDiagnostics } = require('../api/botApi');
const { readSession } = require('../authSession');
const { renderPreviewSvg } = require('../previewRenderer');

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
const DISCORD_API_TIMEOUT_MS = Number(process.env.DISCORD_API_TIMEOUT_MS || 6500);
const OPTIONAL_DASHBOARD_LOOKUP_TIMEOUT_MS = Number(process.env.DASHBOARD_OPTIONAL_LOOKUP_TIMEOUT_MS || 1500);
const userGuildCache = new Map();

async function fetchWithTimeout(url, options = {}, timeoutMs = DISCORD_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? setTimeout(() => controller.abort(), Number(timeoutMs))
    : null;

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const error = new Error('Discord API request timed out.');
      error.statusCode = 504;
      throw error;
    }
    throw err;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function optionalLookupTimeout(label, timeoutMs = OPTIONAL_DASHBOARD_LOOKUP_TIMEOUT_MS) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ channels: [], source: null, errors: [`${label} timed out after ${timeoutMs}ms.`], timedOut: true }), timeoutMs);
  });
}

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

function requirePreviewAccess(req, res, next) {
  if (req.body?.demo === true) return next();
  return requireAuth(req, res, next);
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

  const response = await fetchWithTimeout(`${DISCORD_API}/users/@me/guilds`, {
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

  const response = await fetchWithTimeout(`${DISCORD_API}/guilds/${encodeURIComponent(guildId)}/channels`, {
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


async function requestDiscordGuildRoles(guildId) {
  const token = getDiscordBotToken();
  if (!token) {
    const error = new Error('No Discord bot token is configured for role lookup.');
    error.statusCode = 503;
    throw error;
  }
  const response = await fetchWithTimeout(`${DISCORD_API}/guilds/${encodeURIComponent(guildId)}/roles`, {
    headers: { authorization: `Bot ${token}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Discord role API returned ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

function normalizeDiscordRole(role) {
  if (!role?.id || !role?.name || role.name === '@everyone') return null;
  return {
    id: String(role.id),
    name: String(role.name),
    color: role.color || 0,
    position: Number.isFinite(Number(role.position)) ? Number(role.position) : 0,
    managed: Boolean(role.managed),
    editable: !role.managed,
  };
}

function sortDashboardRoles(roles) {
  return roles
    .map(normalizeDiscordRole)
    .filter(Boolean)
    .sort((a, b) => (b.position - a.position) || a.name.localeCompare(b.name));
}

async function getDashboardServerRoles(guildId) {
  const errors = [];
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(guildId)}/roles`);
    const raw = Array.isArray(data?.roles) ? data.roles : (Array.isArray(data) ? data : []);
    const roles = sortDashboardRoles(raw);
    return { roles, source: 'bot-api', errors };
  } catch (err) {
    errors.push(`BOT_API_URL role route: ${err.message || 'unavailable'}`);
  }
  try {
    const raw = await requestDiscordGuildRoles(guildId);
    return { roles: sortDashboardRoles(raw), source: 'discord-api', errors };
  } catch (err) {
    errors.push(`Discord role API: ${err.message || 'unavailable'}`);
  }
  return { roles: [], source: null, errors };
}

async function requestDiscordGuildUserSearch(guildId, query, limit = 8) {
  const token = getDiscordBotToken();
  if (!token) {
    const error = new Error('No Discord bot token is configured for user search.');
    error.statusCode = 503;
    throw error;
  }
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];
  const looksLikeId = /^\d{15,22}$/.test(trimmed);
  const endpoint = looksLikeId
    ? `${DISCORD_API}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(trimmed)}`
    : `${DISCORD_API}/guilds/${encodeURIComponent(guildId)}/members/search?query=${encodeURIComponent(trimmed)}&limit=${encodeURIComponent(Math.max(1, Math.min(25, Number(limit) || 8)))}`;
  const response = await fetchWithTimeout(endpoint, { headers: { authorization: `Bot ${token}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Discord member API returned ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return Array.isArray(data) ? data : (data ? [data] : []);
}

function normalizeMemberSearchResult(member) {
  const user = member?.user || member;
  if (!user?.id) return null;
  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${String(user.avatar).startsWith('a_') ? 'gif' : 'png'}?size=96`
    : null;
  return {
    userId: String(user.id),
    username: user.username ? `@${user.username}` : null,
    displayName: member?.nick || user.global_name || user.globalName || user.username || String(user.id),
    avatarUrl: avatar,
  };
}

function fallbackAccessPayload(req, kind = 'moderation') {
  const ownerId = getOwnerId();
  const defaultUsers = [];
  if (ownerId) defaultUsers.push({ userId: ownerId, displayName: 'Bot Owner', username: null, source: 'bot_owner' });
  if (req.sessionData?.user?.id) {
    defaultUsers.push({
      userId: req.sessionData.user.id,
      displayName: req.sessionData.user.globalName || req.sessionData.user.username || 'Current Manager',
      username: req.sessionData.user.username ? `@${req.sessionData.user.username}` : null,
      avatarUrl: null,
      source: 'manage_server',
    });
  }
  return { ok: true, defaultUsers, users: [], allowedUsers: [], fallback: true, kind };
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
  const channelData = await Promise.race([
    getDashboardServerChannels(req.params.guildId),
    optionalLookupTimeout('Dashboard channel lookup'),
  ]);

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


async function proxyBotGuildSetting(req, res, botPath, options = {}) {
  try {
    const data = await requestBotApi(botPath, options);
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not reach the bot API.' });
  }
}

async function requestFirstBotApi(paths, options = {}) {
  const errors = [];
  for (const path of paths) {
    try {
      const data = await requestBotApi(path, options);
      return { data, path, errors };
    } catch (err) {
      errors.push(`${path}: ${err.message || 'unavailable'}`);
      if (![404, 405, 501, 502, 503, 504].includes(Number(err.statusCode || 0))) throw err;
    }
  }
  const error = new Error(errors[errors.length - 1] || 'Bot API routes are unavailable.');
  error.statusCode = 503;
  error.errors = errors;
  throw error;
}

function levelRewardPaths(guildId, level = null) {
  const guild = encodeURIComponent(guildId);
  const encodedLevel = level === null ? null : encodeURIComponent(level);
  const bases = [
    `/api/guilds/${guild}/level-rewards`,
    `/api/guilds/${guild}/leveling/rewards`,
    `/api/guilds/${guild}/levels/rewards`,
  ];
  return encodedLevel === null ? bases : bases.map((base) => `${base}/${encodedLevel}`);
}

function moderationAccessPaths(guildId, userId = null) {
  const guild = encodeURIComponent(guildId);
  const encodedUser = userId === null ? null : encodeURIComponent(userId);
  const bases = [
    `/api/guilds/${guild}/moderation-access`,
    `/api/guilds/${guild}/moderation/bypass`,
    `/api/guilds/${guild}/moderation/trusted-users`,
    `/api/guilds/${guild}/trusted-users`,
  ];
  return encodedUser === null ? bases : bases.map((base) => `${base}/${encodedUser}`);
}

function normalizeLevelRewardsPayload(data = {}) {
  const raw = Array.isArray(data?.rewards) ? data.rewards
    : Array.isArray(data?.levelRewards) ? data.levelRewards
    : Array.isArray(data) ? data
    : [];
  return { ...data, ok: data?.ok !== false, rewards: raw };
}



router.post('/dashboard/preview/:kind', requirePreviewAccess, async (req, res) => {
  try {
    const kind = String(req.params.kind || '').trim();
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const sessionUser = req.sessionData?.user || {};
    const svg = renderPreviewSvg(kind, {
      ...payload,
      userName: payload.userName || sessionUser.globalName || sessionUser.username || 'Rafa',
      memberCount: payload.memberCount || 11,
      serverName: payload.serverName || 'PERSONAL',
      avatarUrl: payload.avatarUrl || null,
    });
    res.json({ ok: true, kind, svg, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(err.statusCode || 400).json({ ok: false, error: err.message || 'Could not generate preview.' });
  }
});

router.get('/dashboard/servers/:guildId/roles', requireAuth, requireManageableInstalledServer, async (req, res) => {
  const roleData = await getDashboardServerRoles(req.params.guildId);
  res.status(roleData.roles.length ? 200 : 200).json({
    ok: true,
    roles: roleData.roles,
    source: roleData.source,
    errors: roleData.errors,
    updatedAt: new Date().toISOString(),
  });
});

router.get('/dashboard/servers/:guildId/welcome', requireAuth, requireManageableInstalledServer, async (req, res) => {
  await proxyBotGuildSetting(req, res, `/api/guilds/${encodeURIComponent(req.params.guildId)}/welcome`);
});

router.put('/dashboard/servers/:guildId/welcome', requireAuth, requireManageableInstalledServer, async (req, res) => {
  await proxyBotGuildSetting(req, res, `/api/guilds/${encodeURIComponent(req.params.guildId)}/welcome`, { method: 'PUT', body: JSON.stringify(req.body || {}) });
});

router.get('/dashboard/servers/:guildId/leveling', requireAuth, requireManageableInstalledServer, async (req, res) => {
  await proxyBotGuildSetting(req, res, `/api/guilds/${encodeURIComponent(req.params.guildId)}/leveling`);
});

router.put('/dashboard/servers/:guildId/leveling', requireAuth, requireManageableInstalledServer, async (req, res) => {
  await proxyBotGuildSetting(req, res, `/api/guilds/${encodeURIComponent(req.params.guildId)}/leveling`, { method: 'PUT', body: JSON.stringify(req.body || {}) });
});

router.get('/dashboard/servers/:guildId/level-rewards', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const result = await requestFirstBotApi(levelRewardPaths(req.params.guildId));
    res.json({ ...normalizeLevelRewardsPayload(result.data), sourcePath: result.path });
  } catch (err) {
    res.json({ ok: true, rewards: [], fallback: true, errors: err.errors || [err.message || 'Level reward API is not available yet.'] });
  }
});

router.post('/dashboard/servers/:guildId/level-rewards', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const result = await requestFirstBotApi(levelRewardPaths(req.params.guildId), { method: 'POST', body: JSON.stringify(req.body || {}) });
    res.json({ ...(result.data || { ok: true }), sourcePath: result.path });
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not save level reward.', errors: err.errors || [] });
  }
});

router.delete('/dashboard/servers/:guildId/level-rewards/:level', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const result = await requestFirstBotApi(levelRewardPaths(req.params.guildId, req.params.level), { method: 'DELETE' });
    res.json({ ...(result.data || { ok: true }), sourcePath: result.path });
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not remove level reward.', errors: err.errors || [] });
  }
});

router.get('/dashboard/servers/:guildId/logs', requireAuth, requireManageableInstalledServer, async (req, res) => {
  await proxyBotGuildSetting(req, res, `/api/guilds/${encodeURIComponent(req.params.guildId)}/logs`);
});

router.put('/dashboard/servers/:guildId/logs', requireAuth, requireManageableInstalledServer, async (req, res) => {
  await proxyBotGuildSetting(req, res, `/api/guilds/${encodeURIComponent(req.params.guildId)}/logs`, { method: 'PUT', body: JSON.stringify(req.body || {}) });
});

router.get('/dashboard/servers/:guildId/moderation', requireAuth, requireManageableInstalledServer, async (req, res) => {
  await proxyBotGuildSetting(req, res, `/api/guilds/${encodeURIComponent(req.params.guildId)}/moderation`);
});

router.put('/dashboard/servers/:guildId/moderation', requireAuth, requireManageableInstalledServer, async (req, res) => {
  await proxyBotGuildSetting(req, res, `/api/guilds/${encodeURIComponent(req.params.guildId)}/moderation`, { method: 'PUT', body: JSON.stringify(req.body || {}) });
});


router.get('/dashboard/servers/:guildId/users/search', requireAuth, requireManageableInstalledServer, async (req, res) => {
  const query = String(req.query.q || req.query.query || '').trim();
  const limit = Math.max(1, Math.min(25, Number(req.query.limit || '10') || 10));
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(req.params.guildId)}/users/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(limit)}`);
    return res.json(data);
  } catch (err) {
    try {
      const members = await requestDiscordGuildUserSearch(req.params.guildId, query, limit);
      const users = members.map(normalizeMemberSearchResult).filter(Boolean);
      return res.json({ ok: true, users, source: 'discord-api', fallback: true });
    } catch (fallbackErr) {
      return res.status(fallbackErr.statusCode || err.statusCode || 502).json({ ok: false, error: fallbackErr.message || err.message || 'Could not search users.' });
    }
  }
});

router.get('/dashboard/servers/:guildId/moderation-access', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const result = await requestFirstBotApi(moderationAccessPaths(req.params.guildId));
    res.json({ ...(result.data || {}), ok: result.data?.ok !== false, sourcePath: result.path });
  } catch (err) {
    res.json({ ...fallbackAccessPayload(req, 'moderation'), errors: err.errors || [err.message || 'Moderation access API unavailable.'] });
  }
});

router.post('/dashboard/servers/:guildId/moderation-access', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const result = await requestFirstBotApi(moderationAccessPaths(req.params.guildId), {
      method: 'POST',
      body: JSON.stringify({ userId: req.body?.userId }),
    });
    res.json({ ...(result.data || { ok: true }), sourcePath: result.path });
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not add moderation bypass user.', errors: err.errors || [] });
  }
});

router.delete('/dashboard/servers/:guildId/moderation-access/:userId', requireAuth, requireManageableInstalledServer, async (req, res) => {
  try {
    const result = await requestFirstBotApi(moderationAccessPaths(req.params.guildId, req.params.userId), {
      method: 'DELETE',
    });
    res.json({ ...(result.data || { ok: true }), sourcePath: result.path });
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not remove moderation bypass user.', errors: err.errors || [] });
  }
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
