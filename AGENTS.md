# Meowz Project Instructions

## Project

Meowz is a Discord.js v14 bot with a Node.js/Express website,
PostgreSQL database, and Railway hosting.

Repositories:
- website-discord-bot: dashboard and public website
- discord-bot: Discord bot and internal bot API

## Priorities

1. Fix functional bugs before visual polish.
2. Fix root causes instead of adding visual hacks.
3. Keep desktop, tablet, and mobile working.
4. Preserve authenticated routes.
5. Preserve read-only demo mode and fake demo data.
6. Keep server dashboards on persistent hash-based tabs.
7. Lazy-load tab data and retain cached tab state.
8. Preserve unsaved changes across tab switches.
9. Never expose Discord tokens or BOT_API_TOKEN to frontend code.

## Website design

- Dark-only Meowz theme.
- Purple and cyan gradients.
- Glass cards and rounded components.
- Responsive layouts using grid, flex, clamp, rem, percentages,
  min(), max(), and viewport units.
- Do not add phone-specific fixed layouts.
- Channel and role selection must use custom dropdown components.
- Save controls and status messages must remain reliable.
- Do not redesign the entire brand unless explicitly requested.

## Website changes

Every website change must update the changelog.

Before finishing, run:

npm run audit:css
node --check server/app.js

Also run syntax checks for every changed JavaScript file.

## Bot changes

- Preserve Discord.js v14 compatibility.
- Validate permissions and role hierarchy.
- Keep bot API endpoints authenticated.
- Never expose the Discord bot token.
- Run available Node syntax checks and tests.

## Git safety

- Work on a descriptive feature or fix branch.
- Do not edit or commit .env files.
- Do not push, merge, deploy, or delete branches without approval.
- Show the final git diff and test results before committing.

## Required completion summary

1. Root cause
2. Files changed
3. What was fixed
4. Why this approach
5. Testing checklist
6. Git commands