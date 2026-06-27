const express = require('express');
const { requestBotApi } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();

function getClientId() {
  return process.env.DISCORD_CLIENT_ID || '';
}

function iconUrl(guild, size = 96) {
  if (guild?.iconUrl) return guild.iconUrl;
  if (!guild?.id || !guild?.icon) return null;
  const ext = String(guild.icon).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=${size}`;
}

function normalizeBotGuild(guild) {
  const id = String(guild.id || guild.guildId || '');
  return {
    id,
    name: guild.name || guild.guildName || 'Unknown server',
    icon: guild.icon || null,
    iconUrl: iconUrl({ ...guild, id }),
    memberCount: guild.memberCount ?? guild.members ?? guild.member_count ?? null,
  };
}

function getBotGuildsFromResponse(data) {
  const raw = Array.isArray(data) ? data : (Array.isArray(data?.guilds) ? data.guilds : []);
  return raw.map(normalizeBotGuild).filter((guild) => guild.id);
}

function getInviteUrl(guildId) {
  const clientId = getClientId();
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    permissions: '8',
    scope: 'bot applications.commands',
  });

  if (guildId) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function requireSession(req, res) {
  const session = readSession(req);
  if (!session?.user) {
    res.status(401).json({ ok: false, error: 'Login required.' });
    return null;
  }
  return session;
}

async function getDashboardGuildData(session) {
  const botData = await requestBotApi('/api/guilds', { ttlMs: 30000 });
  const botGuilds = getBotGuildsFromResponse(botData);
  const botGuildMap = new Map(botGuilds.map((guild) => [guild.id, guild]));
  const manageableGuilds = Array.isArray(session.guilds) ? session.guilds : [];

  const installed = manageableGuilds
    .filter((guild) => botGuildMap.has(guild.id))
    .map((guild) => {
      const botGuild = botGuildMap.get(guild.id);
      return {
        ...guild,
        ...botGuild,
        iconUrl: botGuild.iconUrl || guild.iconUrl || iconUrl(guild),
        installed: true,
        manageUrl: `/dashboard/server/${guild.id}`,
      };
    });

  const available = manageableGuilds
    .filter((guild) => !botGuildMap.has(guild.id))
    .map((guild) => ({
      ...guild,
      iconUrl: guild.iconUrl || iconUrl(guild),
      installed: false,
      inviteUrl: getInviteUrl(guild.id),
    }));

  return { installed, available, botGuilds };
}

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    status: 'online',
    name: 'Meowz Website',
    updatedAt: new Date().toISOString(),
  });
});

router.get('/me', (req, res) => {
  const session = readSession(req);
  if (!session?.user) return res.json({ authenticated: false, user: null });
  return res.json({ authenticated: true, user: session.user });
});

router.get('/bot-stats', async (req, res) => {
  try {
    const data = await requestBotApi('/api/stats', { ttlMs: 30000 });
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not reach the bot API.' });
  }
});

router.get('/bot-commands', async (req, res) => {
  try {
    const data = await requestBotApi('/api/commands', { ttlMs: 300000 });
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not reach the bot API.' });
  }
});

router.get('/dashboard/guilds', async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  try {
    const data = await getDashboardGuildData(session);
    res.json({ ok: true, ...data, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load server dashboard.' });
  }
});

router.get('/dashboard/server/:guildId', async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  try {
    const { installed } = await getDashboardGuildData(session);
    const server = installed.find((guild) => guild.id === req.params.guildId);

    if (!server) {
      return res.status(404).json({
        ok: false,
        error: 'This server is not manageable from your Meowz dashboard.',
      });
    }

    return res.json({
      ok: true,
      server: {
        ...server,
        status: 'Installed',
        permissions: {
          manageServer: true,
        },
        comingSoon: [
          'Leveling settings',
          'Welcome messages',
          'Logs',
          'AI image access',
          'Moderation tools',
        ],
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not load server details.' });
  }
});

module.exports = { router };
