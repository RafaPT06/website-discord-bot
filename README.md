# Meowz Website

Public website and documentation for the Meowz Discord bot.

## Run locally

```bash
npm install
npm start
```

## Railway variables

```env
BOT_API_URL=https://discord-bot-production-01ea.up.railway.app
# Optional, only if the bot API is protected:
# BOT_API_TOKEN=your-token
```

## Structure

```text
public/
  css/        Frontend styles
  js/         Frontend modules
  404.html    Friendly not found page
  index.html  Main site
server.js     Express server/API proxy
```
