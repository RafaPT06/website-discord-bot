function normalizeBotApiUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/\/+$/, '');
  }
}

function joinApiPath(baseUrl, pathname) {
  const cleanBase = normalizeBotApiUrl(baseUrl);
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${cleanBase}${cleanPath}`;
}

async function requestBotApi(pathname, options = {}) {
  const botApiUrl = normalizeBotApiUrl(process.env.BOT_API_URL);
  const botApiToken = process.env.BOT_API_TOKEN;
  const timeoutMs = Number(process.env.BOT_API_TIMEOUT_MS || 8000);

  if (!botApiUrl) {
    const error = new Error('BOT_API_URL is not configured on the website service. Add the bot service public/internal URL in Railway variables.');
    error.statusCode = 503;
    throw error;
  }

  let target;
  try {
    target = joinApiPath(botApiUrl, pathname);
    // Validate URL early so Railway misconfiguration is obvious in diagnostics.
    new URL(target);
  } catch {
    const error = new Error('BOT_API_URL is invalid. Use a full URL such as https://your-bot.up.railway.app.');
    error.statusCode = 503;
    throw error;
  }

  const headers = { accept: 'application/json', ...(options.headers || {}) };
  if (botApiToken) headers.authorization = `Bearer ${botApiToken}`;
  if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(target, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    const error = new Error(err.name === 'AbortError' ? `Bot API request timed out after ${timeoutMs}ms.` : `Could not reach BOT_API_URL: ${err.message}`);
    error.statusCode = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Bot API returned ${response.status}${text && !data ? `: ${text.slice(0, 160)}` : ''}`);
    error.statusCode = response.status;
    error.botApiStatus = response.status;
    throw error;
  }

  if (!data || typeof data !== 'object') {
    const error = new Error('Bot API did not return JSON. Check that BOT_API_URL points to the bot API service, not the public website.');
    error.statusCode = 502;
    throw error;
  }

  return data;
}

function getBotApiDiagnostics() {
  const botApiUrl = normalizeBotApiUrl(process.env.BOT_API_URL);
  let urlHost = null;
  let urlValid = false;
  if (botApiUrl) {
    try {
      const parsed = new URL(botApiUrl);
      urlHost = parsed.host;
      urlValid = ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      urlHost = 'invalid-url';
    }
  }
  return {
    configured: Boolean(botApiUrl),
    urlValid,
    hasToken: Boolean(process.env.BOT_API_TOKEN),
    urlHost,
    timeoutMs: Number(process.env.BOT_API_TIMEOUT_MS || 8000),
    expectedEndpoints: ['/api/stats', '/api/guilds', '/api/commands'],
  };
}

module.exports = { requestBotApi, getBotApiDiagnostics, normalizeBotApiUrl };
