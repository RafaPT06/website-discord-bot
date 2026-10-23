const express = require('express');
const { requestBotApi, requestBotApiBuffer } = require('../api/botApi');
const { readSession } = require('../authSession');

const router = express.Router();

function requirePreviewAccess(req, res, next) {
  if (req.body?.demo === true) return next();
  const session = readSession(req);
  if (!session?.user) return res.status(401).json({ ok: false, error: 'Login required.' });
  req.sessionData = session;
  return next();
}

function guildIdFromRequest(req, payload = {}) {
  const direct = String(payload.guildId || payload.serverId || '').trim();
  if (/^\d{15,25}$/.test(direct)) return direct;

  const referer = String(req.get('referer') || '');
  const match = referer.match(/\/(?:dashboard|demo)\/server\/(\d{15,25})(?:[/?#]|$)/i);
  return match?.[1] || null;
}

function discordAvatar(user, size = 256) {
  if (!user?.id || !user?.avatar) return null;
  const ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

async function resolveDashboardMember(guildId, userId) {
  if (!guildId || !userId) return null;
  try {
    const data = await requestBotApi(`/api/guilds/${encodeURIComponent(guildId)}/users/search?q=${encodeURIComponent(userId)}&limit=1`, {
      timeoutMs: 4500,
    });
    const users = Array.isArray(data?.users) ? data.users : [];
    return users.find((user) => String(user.userId || user.id || '') === String(userId)) || users[0] || null;
  } catch {
    return null;
  }
}

router.post('/api/dashboard/preview/:kind', requirePreviewAccess, async (req, res) => {
  try {
    const kind = String(req.params.kind || '').trim().toLowerCase();
    if (!['welcome', 'goodbye', 'level-up'].includes(kind)) {
      return res.status(400).json({ ok: false, error: 'Unsupported preview type.' });
    }

    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const sessionUser = req.sessionData?.user || null;
    const guildId = guildIdFromRequest(req, payload);
    const member = payload.demo === true ? null : await resolveDashboardMember(guildId, sessionUser?.id);

    const sessionName = sessionUser?.globalName || sessionUser?.global_name || sessionUser?.username || null;
    const resolvedName = member?.displayName || member?.globalName || member?.username || sessionName
      || payload.displayName || payload.userName || payload.username || 'Member';
    const resolvedAvatar = member?.avatarUrl || discordAvatar(sessionUser) || payload.avatarUrl || null;

    const result = await requestBotApiBuffer(`/api/previews/${encodeURIComponent(kind)}`, {
      method: 'POST',
      timeoutMs: 12_000,
      body: JSON.stringify({
        ...payload,
        guildId,
        userId: sessionUser?.id || payload.userId || null,
        userName: resolvedName,
        displayName: resolvedName,
        avatarUrl: resolvedAvatar,
      }),
    });

    res.setHeader('Content-Type', result.contentType.startsWith('image/') ? result.contentType : 'image/png');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.send(result.buffer);
  } catch (err) {
    return res.status(err.statusCode || 502).json({ ok: false, error: err.message || 'Could not generate preview.' });
  }
});

module.exports = { router };
