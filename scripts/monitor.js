#!/usr/bin/env node
const { spawnSync } = require('child_process');

const args = [
  'playwright',
  'test',
  'tests/monitor.spec.js',
  '--reporter=line'
];

const passthrough = process.argv.slice(2).filter(Boolean);
args.push(...passthrough);

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    MONITOR_URL:
      process.env.MONITOR_URL ||
      process.env.MEOWZ_BASE_URL ||
      process.env.WEBSITE_URL ||
      process.env.PUBLIC_URL ||
      'https://meowz.up.railway.app',
  },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
