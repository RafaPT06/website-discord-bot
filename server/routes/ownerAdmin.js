const express = require('express');
const { requestBotApi } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();
const activeRemovals = new Set();

function getOwnerId() {
  return process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DASHBOARD_OWNER_ID || '861228909851705366';
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session?.user) return res.status(401).json({ ok: false, error: 'Login required.' });
  req.sessionData = session;
  return next();
}

function requireOwner(req, res, next) {
  const ownerId = getOwnerId();
  if (!ownerId || req.sessionData?.user?.id !== ownerId) {
    return res.status(403).json({ ok: false, error: 'Only the Meowz bot owner can remove the bot from servers.' });
  }
  return next();
}

function validGuildId(value) {
  return /^\d{15,25}$/.test(String(value || '').trim());
}

router.delete('/dashboard/servers/:guildId/bot', requireAuth, requireOwner, async (req, res) => {
  const guildId = String(req.params.guildId || '').trim();
  if (!validGuildId(guildId)) {
    return res.status(400).json({ ok: false, error: 'Invalid Discord server ID.' });
  }

  if (activeRemovals.has(guildId)) {
    return res.status(409).json({ ok: false, error: 'Meowz is already being removed from this server.' });
  }

  activeRemovals.add(guildId);
  try {
    const guildData = await requestBotApi('/api/guilds', { timeoutMs: 10_000 });
    const guilds = Array.isArray(guildData?.guilds) ? guildData.guilds : [];
    const guild = guilds.find((item) => String(item?.id) === guildId);
    if (!guild) {
      return res.status(404).json({ ok: false, error: 'Meowz is not currently installed in this server.' });
    }

    const confirmation = String(req.body?.confirmation || '').trim();
    if (confirmation !== String(guild.name) && confirmation !== guildId) {
      return res.status(400).json({
        ok: false,
        error: `Type the server name exactly (${guild.name}) to confirm removal.`,
      });
    }

    const result = await requestBotApi(`/api/guilds/${encodeURIComponent(guildId)}/simulations/owner-remove-guild`, {
      method: 'POST',
      timeoutMs: 15_000,
      body: JSON.stringify({
        userId: req.sessionData.user.id,
      }),
    });

    return res.json({
      ok: true,
      removed: true,
      guildId,
      guildName: guild.name,
      message: result?.message || `Meowz was removed from ${guild.name}.`,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(err.statusCode || 502).json({
      ok: false,
      error: err.message || 'Could not remove Meowz from this server.',
    });
  } finally {
    activeRemovals.delete(guildId);
  }
});

module.exports = { router };
