const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = (process.env.MONITOR_URL || 'https://meowz.up.railway.app').replace(/\/$/, '');
const ARTIFACT_DIR = path.join(process.cwd(), 'monitor-artifacts');
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function artifactName(route) {
  const clean = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-');
  return `${clean || 'page'}.png`;
}

async function openAndCheck(page, route, expectedText) {
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      const url = response.url();
      const isExpectedAuthProbe = url.includes('/api/auth/me') && [401, 403].includes(status);
      if (!isExpectedAuthProbe) {
        failedRequests.push(`${status} ${url}`);
      }
    }
  });

  const url = `${BASE_URL}${route}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response, `${route} should return a response`).toBeTruthy();
  expect(response.status(), `${route} should not be 404/500`).toBeLessThan(400);

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: path.join(ARTIFACT_DIR, artifactName(route)), fullPage: true });

  await expect(page.locator('body')).toContainText(expectedText, { timeout: 15000 });

  const bodyText = await page.locator('body').innerText();
  expect(bodyText, `${route} should not stay stuck on login loading`).not.toMatch(/Checking login\.\.\./i);
  expect(bodyText, `${route} should not show a generic 404 page`).not.toMatch(/Cannot GET|404 Not Found/i);

  const realMissingAssets = failedRequests.filter((entry) => !entry.includes('/favicon.ico'));
  expect(realMissingAssets, `${route} should not have missing API/assets`).toEqual([]);

  const severeConsoleErrors = consoleErrors.filter((entry) => !/favicon|ResizeObserver/i.test(entry));
  expect(severeConsoleErrors, `${route} should not log console errors`).toEqual([]);
}

test.describe('Meowz public website monitor', () => {
  test('homepage loads bot status and live stats', async ({ page }) => {
    await openAndCheck(page, '/', 'Meowz');
    await expect(page.locator('body')).toContainText(/Bot online|Live|Checking bot status/i, { timeout: 15000 });
  });

  test('documentation loads slash command reference', async ({ page }) => {
    await openAndCheck(page, '/docs', 'Slash command reference');
  });

  test('changelog loads', async ({ page }) => {
    await openAndCheck(page, '/changelog', 'Changelog');
  });

  test('demo entry loads with banner and fake user', async ({ page }) => {
    await openAndCheck(page, '/demo', 'Demo Mode');
    await expect(page.locator('body')).toContainText(/Demo|Preview/i);
  });

  test('demo dashboard loads without real auth', async ({ page }) => {
    await openAndCheck(page, '/demo/dashboard', 'Demo Mode');
    await expect(page.locator('body')).toContainText(/Owner View|User View|server/i);
    await expect(page.locator('body')).not.toContainText(/Login with Discord|required/i);
  });

  test('demo settings loads without real auth', async ({ page }) => {
    await openAndCheck(page, '/demo/settings', 'Demo Mode');
    await expect(page.locator('body')).toContainText(/Settings|Theme|Language/i);
    await expect(page.locator('body')).not.toContainText(/Login with Discord|required/i);
  });
});
