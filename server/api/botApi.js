function normalizeBotApiStats(data = {}) {
  return {
    ok: data.ok !== false,
    botName: data.botName || data.name || data.username || 'Meowz',
    botTag: data.botTag || data.tag || (data.online === false ? 'Offline' : 'Online and ready'),
    avatarUrl: data.avatarUrl || data.avatar || null,
    servers: data.servers ?? data.guilds ?? data.guildCount ?? 0,
    users: data.users ?? data.members ?? data.userCount ?? 0,
    commands: data.commands ?? data.commandCount ?? 0,
    ping: data.ping ?? data.wsPing ?? null,
    uptime: data.uptime || data.uptimeText || '—',
    online: data.online !== false,
    inviteUrl: data.inviteUrl || null,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

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

async function requestFirstBotApi(paths, options = {}) {
  let lastError = null;
  for (const pathname of paths) {
    try {
      return await requestBotApi(pathname, options);
    } catch (err) {
      lastError = err;
      if (err.statusCode === 401 || err.statusCode === 403) break;
    }
  }
  throw lastError || new Error('Could not reach the bot API.');
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

module.exports = { requestBotApi, requestFirstBotApi, normalizeBotApiStats, getBotApiDiagnostics };
