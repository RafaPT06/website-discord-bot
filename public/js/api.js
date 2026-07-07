import { DEMO_BOT_STATS, DEMO_DASHBOARD, DEMO_IMAGE_ACCESS, DEMO_WELCOME_SETTINGS, demoServerById, isDemoRoute } from './demoData.js';

const memoryCache = new Map();

async function fetchJson(url, options = {}) {
  const { cacheKey, cacheMs = 0, ...fetchOptions } = options;
  if (cacheKey && cacheMs > 0) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.at < cacheMs) return cached.data;
  }

  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(fetchOptions.headers || {}) },
    ...fetchOptions,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with ${response.status}`);
  }

  if (cacheKey && cacheMs > 0) memoryCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export function getBotStats() {
  if (isDemoRoute()) return Promise.resolve({ ...DEMO_BOT_STATS, updatedAt: new Date().toISOString() });
  return fetchJson('/api/bot-stats', { cacheKey: 'bot-stats', cacheMs: 15000 });
}

export function getBotCommands() {
  return fetchJson('/api/bot-commands', { cacheKey: 'bot-commands', cacheMs: 30000 });
}

export function getChangelog() {
  return fetchJson('/data/changelog.json', { cacheKey: 'changelog', cacheMs: 30000 });
}

export function getDashboardGuilds(mode = 'user') {
  const normalized = mode === 'owner' ? 'owner' : 'user';
  if (isDemoRoute()) {
    const data = { ...DEMO_DASHBOARD, ownerMode: normalized === 'owner' };
    if (normalized !== 'owner') data.installed = DEMO_DASHBOARD.installed.filter((server) => server.manageable);
    return Promise.resolve(data);
  }
  return fetchJson(`/api/dashboard/guilds?mode=${encodeURIComponent(normalized)}`, { cacheKey: `dashboard-guilds:${normalized}`, cacheMs: 10000 });
}

export function getDashboardServer(guildId) {
  if (isDemoRoute()) return Promise.resolve({ ok: true, server: demoServerById(guildId), updatedAt: new Date().toISOString(), demo: true });
  return fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}`, { cacheKey: `dashboard-server:${guildId}`, cacheMs: 10000 });
}


export function getWelcomeSettings(guildId) {
  if (isDemoRoute()) return Promise.resolve({ ...DEMO_WELCOME_SETTINGS, demo: true });
  return fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/welcome`, { cacheKey: `welcome-settings:${guildId}`, cacheMs: 8000 });
}

export async function saveWelcomeSettings(guildId, settings) {
  if (isDemoRoute()) throw new Error('Demo mode is read-only. Real changes are disabled in preview mode.');
  const data = await fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/welcome`, {
    method: 'PUT',
    body: JSON.stringify(settings || {}),
  });
  memoryCache.delete(`welcome-settings:${guildId}`);
  memoryCache.delete(`dashboard-server:${guildId}`);
  return data;
}

export function getImageAccess(guildId) {
  if (isDemoRoute()) return Promise.resolve({ ...DEMO_IMAGE_ACCESS });
  return fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/image-access`, { cacheKey: `image-access:${guildId}`, cacheMs: 15000 });
}

export async function addImageAccessUser(guildId, userId) {
  if (isDemoRoute()) throw new Error('Demo mode is read-only. Real changes are disabled in preview mode.');
  const data = await fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/image-access`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  memoryCache.delete(`image-access:${guildId}`);
  return data;
}

export async function removeImageAccessUser(guildId, userId) {
  if (isDemoRoute()) throw new Error('Demo mode is read-only. Real changes are disabled in preview mode.');
  const data = await fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/image-access/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  memoryCache.delete(`image-access:${guildId}`);
  return data;
}
