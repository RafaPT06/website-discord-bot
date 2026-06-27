const express = require('express');
const { requestBotApi } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();


function configuredBotGuildIds() {
  return new Set(
    String(process.env.BOT_GUILD_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

async function fetchBotGuildIds() {
  const ids = configuredBotGuildIds();
  try {
    const data = await requestBotApi('/api/guilds');
    const guilds = Array.isArray(data?.guilds) ? data.guilds : Array.isArray(data) ? data : [];
    for (const guild of guilds) {
      const id = typeof guild === 'string' ? guild : guild?.id;
      if (id) ids.add(String(id));
    }
  } catch {
    // The bot API may not expose /api/guilds yet. In that case we still return available servers.
  }
  return ids;
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


router.get('/user-guilds', async (req, res) => {
  const session = readSession(req);
  if (!session?.user) return res.status(401).json({ authenticated: false, error: 'Login required.' });

  const userGuilds = Array.isArray(session.guilds) ? session.guilds : [];
  const manageableGuilds = userGuilds.filter((guild) => guild.canManage);
  const botGuildIds = await fetchBotGuildIds();

  const withBot = manageableGuilds.filter((guild) => botGuildIds.has(String(guild.id)));
  const available = manageableGuilds.filter((guild) => !botGuildIds.has(String(guild.id)));

  res.json({
    authenticated: true,
    user: session.user,
    withBot,
    available,
    botGuildDetection: botGuildIds.size ? 'active' : 'unavailable',
  });
});

router.get('/bot-stats', async (req, res) => {
  try {
    const data = await requestBotApi('/api/stats');
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({
      ok: false,
      error: err.message || 'Could not reach the bot API.',
    });
  }
});

router.get('/bot-commands', async (req, res) => {
  try {
    const data = await requestBotApi('/api/commands');
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 502).json({
      ok: false,
      error: err.message || 'Could not reach the bot API.',
    });
  }
});

module.exports = { router };
