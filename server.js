const express = require('express');

const app = express();

app.use(express.static('public'));

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    name: 'Discord Bot Website',
    message: 'Website is running',
    updatedAt: new Date().toISOString(),
  });
});

app.get('/api/bot-stats', async (req, res) => {
  const botApiUrl = process.env.BOT_API_URL;
  const botApiToken = process.env.BOT_API_TOKEN;

  if (!botApiUrl) {
    return res.status(503).json({
      ok: false,
      error: 'BOT_API_URL is not configured on the website service.',
    });
  }

  try {
    const headers = {};
    if (botApiToken) headers.authorization = `Bearer ${botApiToken}`;

    const response = await fetch(`${botApiUrl.replace(/\/$/, '')}/api/stats`, { headers });
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
});


app.get('/api/bot-commands', async (req, res) => {
  const botApiUrl = process.env.BOT_API_URL;
  const botApiToken = process.env.BOT_API_TOKEN;

  if (!botApiUrl) {
    return res.status(503).json({
      ok: false,
      error: 'BOT_API_URL is not configured on the website service.',
    });
  }

  try {
    const headers = {};
    if (botApiToken) headers.authorization = `Bearer ${botApiToken}`;

    const response = await fetch(`${botApiUrl.replace(/\/$/, '')}/api/commands`, { headers });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data?.error || `Bot API returned ${response.status}`,
      });
    }

    return res.json(data);
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Could not reach the bot API.' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Website running on port ${PORT}`);
});
