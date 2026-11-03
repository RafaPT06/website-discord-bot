const express = require('express');
const { readSession } = require('../authSession');

const router = express.Router();
let tokenCache = null;
const queries = new Map();

function authenticated(req, res, next) {
  if (!readSession(req)?.user) return res.status(401).json({ ok: false, error: 'Discord login required.' });
  next();
}

function throttle(req, res, next) {
  const session = readSession(req);
  const id = String(session?.user?.id || '');
  const now = Date.now();
  const item = queries.get(id);
  if (item && now - item.at < 1200) return res.status(429).json({ ok: false, error: 'Wait a moment before searching again.' });
  queries.set(id, { at: now });
  if (queries.size > 2000) for (const [key, value] of queries) if (now - value.at > 60000) queries.delete(key);
  next();
}

async function accessToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    const error = new Error('Spotify integration is not configured on the website service.');
    error.statusCode = 503;
    throw error;
  }
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.value;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error('Spotify authentication is temporarily unavailable.');
    error.statusCode = 502;
    throw error;
  }
  tokenCache = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return tokenCache.value;
}

async function spotifyGet(path) {
  const token = await accessToken();
  const response = await fetch('https://api.spotify.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) tokenCache = null;
  if (!response.ok) {
    const error = new Error(response.status === 429 ? 'Spotify rate limit reached. Try again later.' : 'Spotify could not return this music information.');
    error.statusCode = response.status === 429 ? 429 : 502;
    throw error;
  }
  return response.json();
}

function safeTrack(track) {
  return {
    id: String(track?.id || ''),
    title: String(track?.name || ''),
    artists: Array.isArray(track?.artists) ? track.artists.map(artist => artist.name).slice(0, 5) : [],
    album: String(track?.album?.name || ''),
    durationMs: Number(track?.duration_ms || 0),
    url: /^https:\/\/open\.spotify\.com\/track\//.test(track?.external_urls?.spotify || '') ? track.external_urls.spotify : null,
    image: track?.album?.images?.find(image => /^https:\/\//.test(image.url || ''))?.url || null,
  };
}

router.get('/music/spotify/status', authenticated, (req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET), connected: false, mode: 'catalog', playbackSupported: false });
});

router.get('/music/spotify/search', authenticated, throttle, async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2 || query.length > 100) return res.status(400).json({ ok: false, error: 'Enter a search between 2 and 100 characters.' });
  try {
    const params = new URLSearchParams({ q: query, type: 'track', limit: '12', market: 'PT' });
    const data = await spotifyGet('/search?' + params);
    res.set('Cache-Control', 'private, no-store');
    res.json({ ok: true, tracks: (data.tracks?.items || []).map(safeTrack) });
  } catch (error) {
    res.status(error.statusCode || 502).json({ ok: false, error: error.message || 'Spotify search failed.' });
  }
});

module.exports = { router };
