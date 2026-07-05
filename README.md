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
