# Meowz Website

Public website and future dashboard for the Meowz Discord bot.

## Start locally

```bash
npm install
npm start
```

## Railway variables

```env
BOT_API_URL=https://discord-bot-production-01ea.up.railway.app
BOT_API_TOKEN=optional-if-you-add-one-later
```

## Structure

```text
public/
  css/       Modular styles
  js/        Modular frontend scripts
  data/      Static website data, including changelog
server/
  api/       Bot API helper
  routes/    Website API and future auth routes
  middleware/404 handling
```

OAuth will be added in the next milestone.
