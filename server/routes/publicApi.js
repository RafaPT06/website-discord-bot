const express = require('express');
const { requestBotApi } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();

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
