const cache = new Map();

function cacheKey(pathname) {
  return pathname;
}

async function requestBotApi(pathname, options = {}) {
  const { ttlMs = 0 } = options;
  const botApiUrl = process.env.BOT_API_URL;
  const botApiToken = process.env.BOT_API_TOKEN;

  if (!botApiUrl) {
    const error = new Error('BOT_API_URL is not configured on the website service.');
    error.statusCode = 503;
    throw error;
  }

  const key = cacheKey(pathname);
  const cached = cache.get(key);
  if (ttlMs && cached && Date.now() - cached.createdAt < ttlMs) {
    return cached.data;
  }

  const headers = {};
  if (botApiToken) headers.authorization = `Bearer ${botApiToken}`;

  const response = await fetch(`${botApiUrl.replace(/\/$/, '')}${pathname}`, { headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Bot API returned ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  if (ttlMs) cache.set(key, { createdAt: Date.now(), data });
  return data;
}

module.exports = { requestBotApi };
