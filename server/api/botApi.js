function botApiConfig(options = {}) {
  const botApiUrl = process.env.BOT_API_URL;
  const botApiToken = process.env.BOT_API_TOKEN;
  const timeoutMs = Number(options.timeoutMs || process.env.BOT_API_TIMEOUT_MS || 8000);

  if (!botApiUrl) {
    const error = new Error('BOT_API_URL is not configured on the website service.');
    error.statusCode = 503;
    throw error;
  }

  const headers = { ...(options.headers || {}) };
  if (botApiToken) headers.authorization = `Bearer ${botApiToken}`;
  if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';

  return { botApiUrl, headers, timeoutMs };
}

async function fetchBotApi(pathname, options = {}) {
  const { botApiUrl, headers, timeoutMs } = botApiConfig(options);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    const { timeoutMs: _ignoredTimeout, ...fetchOptions } = options;
    response = await fetch(`${botApiUrl.replace(/\/$/, '')}${pathname}`, {
      ...fetchOptions,
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

  return response;
}

async function requestBotApi(pathname, options = {}) {
  const response = await fetchBotApi(pathname, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Bot API returned ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

async function requestBotApiBuffer(pathname, options = {}) {
  const response = await fetchBotApi(pathname, options);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.error || `Bot API returned ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
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

module.exports = { requestBotApi, requestBotApiBuffer, getBotApiDiagnostics };
