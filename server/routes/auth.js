const crypto = require('crypto');
const express = require('express');
const {
  setOAuthState,
  readOAuthState,
  clearOAuthState,
  setSession,
  readSession,
  clearSession,
} = require('../authSession');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function getRedirectUri(req) {
  return process.env.DISCORD_REDIRECT_URI || `${getBaseUrl(req)}/auth/discord/callback`;
}

function redirectWithError(res, message) {
  const encoded = encodeURIComponent(message || 'Discord login failed.');
  return res.redirect(`/?auth=error&message=${encoded}`);
}

function formatDiscordUser(user) {
  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name || null,
    avatar: user.avatar || null,
    accentColor: user.accent_color || null,
  };
}

router.get('/discord', (req, res) => {
  try {
    const clientId = requiredEnv('DISCORD_CLIENT_ID');
    const redirectUri = getRedirectUri(req);
    const state = crypto.randomBytes(24).toString('hex');

    setOAuthState(res, state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
      prompt: 'consent',
    });

    return res.redirect(`${DISCORD_AUTHORIZE_URL}?${params.toString()}`);
  } catch (err) {
    return redirectWithError(res, err.message);
  }
});

router.get('/discord/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return redirectWithError(res, String(error));
    if (!code || !state) return redirectWithError(res, 'Missing OAuth code or state.');

    const savedState = readOAuthState(req);
    clearOAuthState(res);

    if (!savedState?.state || savedState.state !== state) {
      return redirectWithError(res, 'Invalid OAuth state. Try logging in again.');
    }

    const clientId = requiredEnv('DISCORD_CLIENT_ID');
    const clientSecret = requiredEnv('DISCORD_CLIENT_SECRET');
    const redirectUri = getRedirectUri(req);

    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok) {
      return redirectWithError(res, tokenData?.error_description || tokenData?.error || 'Could not exchange Discord code.');
    }

    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userResponse.json().catch(() => null);
    if (!userResponse.ok || !userData?.id) {
      return redirectWithError(res, 'Could not fetch Discord user.');
    }

    setSession(res, {
      user: formatDiscordUser(userData),
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type || 'Bearer',
      expiresAt: tokenData.expires_in ? Date.now() + Number(tokenData.expires_in) * 1000 : null,
    });
    return res.redirect('/dashboard?auth=success');
  } catch (err) {
    return redirectWithError(res, err.message);
  }
});

router.get('/logout', (req, res) => {
  clearSession(res);
  return res.redirect('/?logout=success');
});

router.get('/me', (req, res) => {
  const session = readSession(req);
  if (!session?.user) return res.json({ authenticated: false, user: null });
  return res.json({ authenticated: true, user: session.user });
});

module.exports = { router };
