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



### Bot stats requirements

The website reads live stats through its own `/api/bot-stats` proxy, then the website service calls the bot service through `BOT_API_URL`. On Railway, set these on the **website** service:

```env
BOT_API_URL=https://your-bot-service.up.railway.app
BOT_API_TOKEN=optional_shared_token_if_the_bot_api_requires_it
BOT_API_TIMEOUT_MS=8000
SESSION_SECRET=random_long_secret
```

The bot service must expose one of these JSON endpoints: `/api/stats`, `/stats`, or `/api/bot/stats`. The response can use `servers`, `guilds`, or `guildCount`; `users`, `members`, or `userCount`; and `commands` or `commandCount`.

## Commands

```bash
npm install
npm start
```
