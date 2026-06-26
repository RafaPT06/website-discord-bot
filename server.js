const express = require('express');
const path = require('path');

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

function getBotApiConfig() {
  return {
    botApiUrl: process.env.BOT_API_URL,
    botApiToken: process.env.BOT_API_TOKEN,
  };
}

async function proxyBotApi(pathname, res) {
  const { botApiUrl, botApiToken } = getBotApiConfig();

  if (!botApiUrl) {
    return res.status(503).json({
      ok: false,
      error: 'BOT_API_URL is not configured on the website service.',
    });
  }

  try {
    const headers = {};
    if (botApiToken) headers.authorization = `Bearer ${botApiToken}`;

    const response = await fetch(`${botApiUrl.replace(/\/$/, '')}${pathname}`, { headers });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data?.error || `Bot API returned ${response.status}`,
      });
    }

    return res.json(data);
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: 'Could not reach the bot API.',
    });
  }
}

app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    status: 'online',
    name: 'Meowz Website',
    message: 'Website is running',
    updatedAt: new Date().toISOString(),
  });
});

app.get('/api/bot-stats', (req, res) => proxyBotApi('/api/stats', res));
app.get('/api/bot-commands', (req, res) => proxyBotApi('/api/commands', res));

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Website running on port ${PORT}`);
});
