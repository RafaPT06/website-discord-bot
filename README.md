# Meowz Website

Public website and Discord OAuth dashboard for Meowz.

## Routes

- `/` — Home
- `/dashboard` — Authenticated dashboard
- `/docs` — Slash command documentation
- `/changelog` — Website changelog

## Railway variables

```env
BOT_API_URL=https://discord-bot-production-01ea.up.railway.app
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=https://meowz.up.railway.app/auth/discord/callback
SESSION_SECRET=random_long_secret
```

## Commands

```bash
npm install
npm start
```

## Dashboard channel dropdown API

Server dashboard settings use real Discord channels for dropdown fields. The website tries these sources in order:

1. `BOT_API_URL` endpoint: `GET /api/guilds/:guildId/channels`
2. Direct Discord fallback using `DISCORD_BOT_TOKEN` on the website Railway service

The response should be JSON in one of these shapes:

```json
{ "ok": true, "channels": [{ "id": "123", "name": "welcome", "type": 0, "position": 2 }] }
```

or a raw array of Discord channel objects. The website only exposes the dropdown to authenticated users who already pass the dashboard Manage Server/owner access check. Demo mode never calls this API and uses fake channels from `public/js/demoData.js`.
