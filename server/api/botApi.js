async function requestBotApi(pathname) {
  const botApiUrl = process.env.BOT_API_URL;
  const botApiToken = process.env.BOT_API_TOKEN;

  if (!botApiUrl) {
    const error = new Error('BOT_API_URL is not configured on the website service.');
    error.statusCode = 503;
    throw error;
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

  return data;
}

module.exports = { requestBotApi };
