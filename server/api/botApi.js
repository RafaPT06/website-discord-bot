async function requestBotApi(pathname, options = {}) {
  const botApiUrl = process.env.BOT_API_URL;
  const botApiToken = process.env.BOT_API_TOKEN;
  const timeoutMs = Number(process.env.BOT_API_TIMEOUT_MS || 8000);

  if (!botApiUrl) {
    const error = new Error('BOT_API_URL is not configured on the website service.');
    error.statusCode = 503;
    throw error;
  }

  const headers = { ...(options.headers || {}) };
  if (botApiToken) headers.authorization = `Bearer ${botApiToken}`;
  if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${botApiUrl.replace(/\/$/, '')}${pathname}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    const error = new Error(err.name === 'AbortError' ? 'Bot API request timed out.' : `Could not reach BOT_API_URL: ${err.message}`);
    error.statusCode = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Bot API returned ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

function getBotApiDiagnostics() {
  const botApiUrl = process.env.BOT_API_URL || '';
  return {
    configured: Boolean(botApiUrl),
    hasToken: Boolean(process.env.BOT_API_TOKEN),
    urlHost: botApiUrl ? (() => { try { return new URL(botApiUrl).host; } catch { return 'invalid-url'; } })() : null,
    timeoutMs: Number(process.env.BOT_API_TIMEOUT_MS || 8000),
  };
}

module.exports = { requestBotApi, getBotApiDiagnostics };
