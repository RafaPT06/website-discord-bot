const express = require('express');
const { requestBotApi, getBotApiDiagnostics } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const ACCESS_CACHE_MS = 30_000;
const guildAccessCache = new Map();

function getOwnerId() {
  return String(process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DASHBOARD_OWNER_ID || '').trim();
}

function isBotOwner(session) {
  const ownerId = getOwnerId();
  return Boolean(ownerId && String(session?.user?.id || '') === ownerId);
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

function accessCacheKey(session, guildId) {
  return `${String(session?.user?.id || 'unknown')}:${guildId}`;
}

async function requireServerAccess(req, res, next) {
  const guildId = String(req.params.guildId || '').trim();
  if (!/^\d{15,25}$/.test(guildId)) {
    return res.status(400).json({ ok: false, error: 'Invalid Discord server ID.' });
  }

  if (isBotOwner(req.sessionData)) {
    req.guildId = guildId;
    return next();
  }

  if (!req.sessionData?.accessToken) {
    return res.status(401).json({ ok: false, error: 'Discord session is missing guild access. Log out and log in again.' });
  }

  const cacheKey = accessCacheKey(req.sessionData, guildId);
  const cached = guildAccessCache.get(cacheKey);
  if (cached && Date.now() - cached.at < ACCESS_CACHE_MS) {
    req.guildId = guildId;
    return next();
  }

  try {
    const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { authorization: `Bearer ${req.sessionData.accessToken}` },
    });
    const guilds = await response.json().catch(() => []);
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: guilds?.message || 'Could not verify Discord server access.' });
    }

    const guild = (Array.isArray(guilds) ? guilds : []).find((item) => String(item.id) === guildId);
    if (!guild || !hasManageGuild(guild.permissions)) {
      return res.status(403).json({ ok: false, error: 'Manage Server permission is required.' });
    }

    guildAccessCache.set(cacheKey, { at: Date.now() });
    req.guildId = guildId;
    return next();
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message || 'Could not verify Discord server access.' });
  }
}


function apiError(res, err) {
  return res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Avatar tracker API unavailable.' });
}
router.get('/dashboard/servers/:guildId/avatar-trackers', requireAuth, requireServerAccess, async (req,res) => {
  try { return res.json(await requestBotApi('/api/guilds/' + encodeURIComponent(req.guildId) + '/avatar-trackers')); }
  catch (err) { return apiError(res,err); }
});
router.post('/dashboard/servers/:guildId/avatar-trackers', requireAuth, requireServerAccess, async (req,res) => {
  try {
    const user = String(req.body?.user || '').trim().slice(0,150);
    const channelId = String(req.body?.channelId || '').trim();
    if (!user || !/^\d{15,25}$/.test(channelId)) return res.status(400).json({ok:false,error:'Enter a Roblox user and select a channel.'});
    return res.json(await requestBotApi('/api/guilds/' + encodeURIComponent(req.guildId) + '/avatar-trackers',{method:'POST',body:JSON.stringify({user,channelId})}));
  } catch(err) { return apiError(res,err); }
});
router.patch('/dashboard/servers/:guildId/avatar-trackers/:userId', requireAuth, requireServerAccess, async (req,res) => {
  try {
    const channelId = String(req.body?.channelId || '').trim();
    if (!/^\d{15,25}$/.test(channelId)) return res.status(400).json({ok:false,error:'Select a valid channel.'});
    return res.json(await requestBotApi('/api/guilds/' + encodeURIComponent(req.guildId) + '/avatar-trackers/' + encodeURIComponent(req.params.userId),{method:'PATCH',body:JSON.stringify({channelId,enabled:req.body?.enabled===true})}));
  } catch(err) { return apiError(res,err); }
});
router.delete('/dashboard/servers/:guildId/avatar-trackers/:userId', requireAuth, requireServerAccess, async (req,res) => {
  try { return res.json(await requestBotApi('/api/guilds/' + encodeURIComponent(req.guildId) + '/avatar-trackers/' + encodeURIComponent(req.params.userId),{method:'DELETE'})); }
  catch(err) { return apiError(res,err); }
});
module.exports = { router };
