const express = require('express');
const { requestBotApi, getBotApiDiagnostics } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const cache = new Map();

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session?.user) return res.status(401).json({ ok: false, error: 'Login required.' });
  req.musicSession = session;
  next();
}

async function requireGuildManager(req, res, next) {
  const guildId = String(req.params.guildId || '');
  if (!/^\d{16,22}$/.test(guildId)) return res.status(400).json({ ok: false, error: 'Invalid server ID.' });
  const ownerId = String(process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DASHBOARD_OWNER_ID || '');
  if (ownerId && String(req.musicSession.user.id) === ownerId) return next();
  if (!req.musicSession.accessToken) return res.status(401).json({ ok: false, error: 'Please log in again.' });
  const key = String(req.musicSession.user.id) + ':' + guildId;
  const existing = cache.get(key);
  if (existing && Date.now() - existing < 30000) return next();
  try {
    const response = await fetch(DISCORD_API + '/users/@me/guilds', {
      headers: { Authorization: 'Bearer ' + req.musicSession.accessToken },
    });
    if (!response.ok) return res.status(502).json({ ok: false, error: 'Could not verify Discord permissions.' });
    const guilds = await response.json();
    const guild = Array.isArray(guilds) && guilds.find(item => String(item.id) === guildId);
    const permissions = BigInt(guild?.permissions || '0');
    if (!guild || !(permissions & MANAGE_GUILD) && !(permissions & ADMINISTRATOR)) {
      return res.status(403).json({ ok: false, error: 'Manage Server permission is required.' });
    }
    cache.set(key, Date.now());
    next();
  } catch {
    res.status(502).json({ ok: false, error: 'Could not verify Discord permissions.' });
  }
}

function fail(res, err) {
  res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Bot API unavailable.', diagnostics: getBotApiDiagnostics() });
}
function botPath(req) { return '/api/guilds/' + encodeURIComponent(req.params.guildId) + '/music/voice'; }

router.get('/dashboard/servers/:guildId/music/voice', requireAuth, requireGuildManager, async (req, res) => {
  try { res.json(await requestBotApi(botPath(req), { timeoutMs: 12000 })); } catch (err) { fail(res, err); }
});
router.post('/dashboard/servers/:guildId/music/voice/join', requireAuth, requireGuildManager, async (req, res) => {
  const channelId = String(req.body?.channelId || '');
  if (!/^\d{16,22}$/.test(channelId)) return res.status(400).json({ ok: false, error: 'Invalid voice channel.' });
  try {
    res.json(await requestBotApi(botPath(req) + '/join', { method: 'POST', timeoutMs: 25000, body: JSON.stringify({ channelId }) }));
  } catch (err) { fail(res, err); }
});
router.post('/dashboard/servers/:guildId/music/voice/leave', requireAuth, requireGuildManager, async (req, res) => {
  try { res.json(await requestBotApi(botPath(req) + '/leave', { method: 'POST', timeoutMs: 12000, body: '{}' })); }
  catch (err) { fail(res, err); }
});

module.exports = { router };
