const { chromium } = require('playwright');
const fs = require('fs/promises');
const path = require('path');

const BASE_URL = (process.env.MEOWZ_BASE_URL || 'https://meowz.up.railway.app').replace(/\/$/, '');
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const WAIT_MS = Number(process.env.MONITOR_WAIT_MS || 7000);
const SCREENSHOT_DIR = process.env.MONITOR_SCREENSHOT_DIR || 'test-results/website-monitor';
const HEADLESS = process.env.PLAYWRIGHT_HEADED !== '1';

const checks = [];

function pass(name, details = '') {
  checks.push({ ok: true, name, details });
}

function fail(name, details = '') {
  checks.push({ ok: false, name, details });
}

function warn(name, details = '') {
  checks.push({ ok: null, name, details });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pageText(page) {
  return (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).replace(/\s+/g, ' ').trim();
}

async function visible(page, selector, timeout = 1500) {
  return page.locator(selector).first().isVisible({ timeout }).catch(() => false);
}

async function screenshot(page, name) {
  await ensureDir(SCREENSHOT_DIR);
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => null);
  return file;
}

async function gotoAndWait(page, route, name) {
  const url = `${BASE_URL}${route}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((error) => {
    fail(`${name} opens`, error.message);
    return null;
  });

  if (!response) return false;
  const status = response.status();
  if (status >= 200 && status < 400) pass(`${name} opens`, `${url} (${status})`);
  else fail(`${name} opens`, `${url} returned ${status}`);

  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(WAIT_MS);
  await screenshot(page, name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  return true;
}

async function checkHome(page) {
  if (!(await gotoAndWait(page, '/', 'Homepage'))) return;
  const text = await pageText(page);

  if (text.includes('Meowz')) pass('Homepage content visible');
  else fail('Homepage content visible', 'Could not find Meowz text');

  if (text.includes('Checking login')) fail('Login initialization resolves', 'Still shows "Checking login..." after wait');
  else pass('Login initialization resolves');

  const stuckBot = text.includes('Loading bot') || text.includes('Connecting to API') || text.includes('Checking bot status');
  if (stuckBot) fail('Bot status loads', 'Bot status still shows loading/API placeholders');
  else pass('Bot status loads');

  if (text.includes('Loading live stats')) fail('Live stats load', 'Still shows "Loading live stats..." after wait');
  else pass('Live stats load');

  if (text.includes('Documentation')) pass('Documentation link visible');
  else fail('Documentation link visible');

  if (text.includes('Changelog')) pass('Changelog link visible');
  else fail('Changelog link visible');
}

async function checkDocs(page) {
  if (!(await gotoAndWait(page, '/docs', 'Documentation'))) return;
  const text = await pageText(page);
  if (text.includes('Loading slash commands')) fail('Slash command documentation loads', 'Still shows loading placeholder after wait');
  else if (/command|slash|documentation/i.test(text)) pass('Slash command documentation loads');
  else warn('Slash command documentation loads', 'Docs opened, but command content was not clearly detected');
}

async function checkChangelog(page) {
  if (!(await gotoAndWait(page, '/changelog', 'Changelog'))) return;
  const text = await pageText(page);
  if (/changelog|website updates|updates/i.test(text)) pass('Changelog page content visible');
  else warn('Changelog page content visible', 'Changelog opened, but expected text was not clearly detected');
}

async function checkDemo(page) {
  if (!(await gotoAndWait(page, '/demo', 'Demo'))) return;
  const text = await pageText(page);

  if (/Demo Mode/i.test(text)) pass('Demo banner visible');
  else fail('Demo banner visible', 'Could not find "Demo Mode" text');

  if (/read-only|Log in to make real changes/i.test(text)) pass('Demo read-only warning visible');
  else fail('Demo read-only warning visible');

  if (/Demo User/i.test(text)) pass('Fake demo user visible');
  else fail('Fake demo user visible', 'Could not find "Demo User"');

  if (/Owner View|User View/i.test(text)) pass('Owner/User toggle visible');
  else fail('Owner/User toggle visible');

  if (/server|guild/i.test(text)) pass('Demo server/dashboard data visible');
  else warn('Demo server/dashboard data visible', 'Could not clearly detect server/dashboard data');
}

async function checkDemoSubpage(page, route, name, expectedPatterns) {
  if (!(await gotoAndWait(page, route, name))) return;
  const text = await pageText(page);

  if (/Demo Mode/i.test(text)) pass(`${name} keeps demo mode`);
  else fail(`${name} keeps demo mode`, 'Demo Mode banner/text missing');

  if (/login with discord|checking login/i.test(text)) fail(`${name} bypasses Discord login`, 'Looks like it still requires login');
  else pass(`${name} bypasses Discord login`);

  const matched = expectedPatterns.some((pattern) => pattern.test(text));
  if (matched) pass(`${name} expected content visible`);
  else warn(`${name} expected content visible`, 'Opened, but expected page-specific text was not clearly detected');
}

async function checkConsoleErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

function buildSummary() {
  const failed = checks.filter((check) => check.ok === false);
  const warned = checks.filter((check) => check.ok === null);
  const passed = checks.filter((check) => check.ok === true);
  const statusIcon = failed.length ? '❌' : warned.length ? '⚠️' : '✅';

  const lines = [];
  lines.push(`${statusIcon} Meowz Website QA Report`);
  lines.push(`URL: ${BASE_URL}`);
  lines.push(`Time: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Passed: ${passed.length} | Failed: ${failed.length} | Warnings: ${warned.length}`);
  lines.push('');
  for (const check of checks) {
    const icon = check.ok === true ? '✅' : check.ok === false ? '❌' : '⚠️';
    lines.push(`${icon} ${check.name}${check.details ? ` — ${check.details}` : ''}`);
  }
  lines.push('');
  lines.push('Next focus:');
  if (failed.some((check) => /Login|Bot status|Live stats|Slash command/.test(check.name))) {
    lines.push('1. Fix shared API/auth connectivity (Railway env vars, API base URL, CORS, backend routes).');
  } else {
    lines.push('1. Keep API/auth checks monitored.');
  }
  if (failed.some((check) => /Demo/.test(check.name))) {
    lines.push('2. Fix demo mode route/data/read-only UI.');
  } else {
    lines.push('2. Continue demo mode UX checks on protected pages.');
  }
  lines.push('3. Review screenshots in the GitHub Actions artifacts for layout regressions.');

  return lines.join('\n');
}

async function sendDiscordReport(summary) {
  if (!WEBHOOK_URL) {
    console.log('DISCORD_WEBHOOK_URL is not set. Skipping Discord webhook.');
    return;
  }

  const failed = checks.filter((check) => check.ok === false).length;
  const color = failed ? 0xef4444 : 0x22c55e;

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'Meowz QA Monitor',
      embeds: [
        {
          title: failed ? '❌ Meowz Website QA found issues' : '✅ Meowz Website QA passed',
          description: summary.slice(0, 3900),
          color,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed with ${response.status}: ${await response.text().catch(() => '')}`);
  }
}

async function main() {
  await ensureDir(SCREENSHOT_DIR);
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'MeowzWebsiteMonitor/1.0 Playwright',
  });
  const page = await context.newPage();
  const consoleErrors = await checkConsoleErrors(page);

  try {
    await checkHome(page);
    await checkDocs(page);
    await checkChangelog(page);
    await checkDemo(page);
    await checkDemoSubpage(page, '/demo/settings', 'Demo Settings', [/settings/i, /theme/i, /owner view/i, /user view/i]);
    await checkDemoSubpage(page, '/demo/dashboard', 'Demo Dashboard', [/dashboard/i, /server/i, /Demo User/i]);

    if (consoleErrors.length) {
      warn('Browser console errors detected', consoleErrors.slice(0, 3).join(' | '));
    } else {
      pass('No browser console errors detected');
    }
  } finally {
    await browser.close();
  }

  const summary = buildSummary();
  await fs.writeFile(path.join(SCREENSHOT_DIR, 'summary.txt'), summary, 'utf8');
  console.log(summary);
  await sendDiscordReport(summary);

  if (checks.some((check) => check.ok === false)) process.exitCode = 1;
}

main().catch(async (error) => {
  fail('Monitor crashed', error.stack || error.message);
  const summary = buildSummary();
  console.error(summary);
  await sendDiscordReport(summary).catch((webhookError) => console.error(webhookError));
  process.exit(1);
});
