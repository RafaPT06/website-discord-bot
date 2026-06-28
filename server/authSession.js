const crypto = require('crypto');

const SESSION_COOKIE = 'meowz_session';
const STATE_COOKIE = 'meowz_oauth_state';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const STATE_MAX_AGE_SECONDS = 10 * 60;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing SESSION_SECRET.');
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function cookieOptions(maxAgeSeconds) {
  const parts = [
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function setCookie(res, name, value, maxAgeSeconds) {
  res.append('Set-Cookie', `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ${cookieOptions(maxAgeSeconds)}`);
}

function clearCookie(res, name) {
  res.append('Set-Cookie', `${encodeURIComponent(name)}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function createSignedValue(payload) {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function readSignedValue(value) {
  if (!value || !value.includes('.')) return null;

  const [encoded, signature] = value.split('.');
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setOAuthState(res, state) {
  setCookie(res, STATE_COOKIE, createSignedValue({ state, exp: Date.now() + STATE_MAX_AGE_SECONDS * 1000 }), STATE_MAX_AGE_SECONDS);
}

function readOAuthState(req) {
  const cookies = parseCookies(req);
  return readSignedValue(cookies[STATE_COOKIE]);
}

function clearOAuthState(res) {
  clearCookie(res, STATE_COOKIE);
}

function setSession(res, sessionData) {
  const payload = sessionData?.user ? sessionData : { user: sessionData };
  setCookie(
    res,
    SESSION_COOKIE,
    createSignedValue({ ...payload, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }),
    SESSION_MAX_AGE_SECONDS
  );
}

function readSession(req) {
  const cookies = parseCookies(req);
  return readSignedValue(cookies[SESSION_COOKIE]);
}

function clearSession(res) {
  clearCookie(res, SESSION_COOKIE);
}

module.exports = {
  setOAuthState,
  readOAuthState,
  clearOAuthState,
  setSession,
  readSession,
  clearSession,
};
