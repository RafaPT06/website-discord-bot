const fs = require('node:fs');

const file = 'public/data/changelog.json';
const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
const item = 'Unified Discord embeds, welcome/goodbye, leveling, profile, leaderboard, stats and achievement cards around coordinated Meowz violet and lilac accents.';

const target = entries.find((entry) => entry?.date === '2026-07-12' && entry?.title === 'Dashboard simulation and bot stability polish');
if (!target) throw new Error('Could not find the current changelog entry.');
if (!Array.isArray(target.items)) target.items = [];
if (!target.items.includes(item)) target.items.push(item);

fs.writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`);
