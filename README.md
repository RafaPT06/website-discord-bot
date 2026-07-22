# Meowz Website

Public website and Discord OAuth dashboard for Meowz.

## Routes

- `/` — Home
- `/dashboard` — Authenticated dashboard
- `/docs` — Slash command documentation
- `/changelog` — Website changelog

## Local development

Requires Node.js 18 or newer.

```bash
npm install
```

Copy `.env.example` to `.env`, replace the required placeholders, then start the website:

```bash
cp .env.example .env
npm start
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp` if needed.

The website loads `.env` before importing any server modules. Variables already provided by the shell or hosting environment take precedence, so local `.env` values do not overwrite Railway configuration. For a fully local website and bot setup, run the bot API on port `3001` and keep `BOT_API_URL=http://localhost:3001`.

The minimum local variables for OAuth and bot-backed dashboard features are:

```env
BOT_API_URL=http://localhost:3001
BOT_API_TOKEN=replace_with_shared_bot_api_token
DISCORD_CLIENT_ID=replace_with_discord_client_id
DISCORD_CLIENT_SECRET=replace_with_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback
SESSION_SECRET=replace_with_long_random_session_secret
```

Public and demo pages can load without Discord OAuth, but authenticated and bot-backed features require the corresponding variables and services.

## Railway variables

```env
BOT_API_URL=https://replace-with-your-bot-service.example
BOT_API_TOKEN=replace_with_shared_bot_api_token
DISCORD_CLIENT_ID=replace_with_discord_client_id
DISCORD_CLIENT_SECRET=replace_with_discord_client_secret
DISCORD_REDIRECT_URI=https://replace-with-your-website.example/auth/discord/callback
SESSION_SECRET=replace_with_long_random_session_secret
```

Railway-provided variables continue to take precedence over `.env`. See `.env.example` for every optional timeout, owner alias, Discord fallback, deployment metadata and monitor variable recognized by the website.

## Commands

```bash
npm start
npm run audit:css
npm run monitor
```

`npm run monitor` targets `MONITOR_URL`, falling back to the deployed public website when it is unset. Set `MONITOR_URL=http://localhost:3000` to monitor a local server.

## Dashboard channel dropdown API

Server dashboard settings use real Discord channels for dropdown fields. The website tries these sources in order:

1. `BOT_API_URL` endpoint: `GET /api/guilds/:guildId/channels`
2. Direct Discord fallback using `DISCORD_BOT_TOKEN` on the website Railway service

The response should be JSON in one of these shapes:

```json
{ "ok": true, "channels": [{ "id": "123", "name": "welcome", "type": 0, "position": 2 }] }
```

or a raw array of Discord channel objects. The website only exposes the dropdown to authenticated users who already pass the dashboard Manage Server/owner access check. Demo mode never calls this API and uses fake channels from `public/js/demoData.js`.
