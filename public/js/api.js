const memoryCache = new Map();

function cacheKey(url) {
  return `meowz-cache:${url}`;
}

function readCached(url, ttlMs) {
  if (!ttlMs) return null;

  const memoryItem = memoryCache.get(url);
  if (memoryItem && Date.now() - memoryItem.createdAt < ttlMs) {
    return memoryItem.data;
  }

  try {
    const raw = sessionStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (Date.now() - item.createdAt > ttlMs) return null;
    memoryCache.set(url, item);
    return item.data;
  } catch {
    return null;
  }
}

function writeCached(url, data, ttlMs) {
  if (!ttlMs) return;
  const item = { createdAt: Date.now(), data };
  memoryCache.set(url, item);
  try {
    sessionStorage.setItem(cacheKey(url), JSON.stringify(item));
  } catch {
    // Ignore quota/storage errors.
  }
}

async function fetchJson(url, options = {}) {
  const { ttlMs = 0 } = options;
  const cached = readCached(url, ttlMs);
  if (cached) return cached;

  const response = await fetch(url, {
    cache: ttlMs ? 'default' : 'no-store',
    credentials: 'include',
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with ${response.status}`);
  }

  writeCached(url, data, ttlMs);
  return data;
}

export function getBotStats() {
  return fetchJson('/api/bot-stats', { ttlMs: 30000 });
}

export function getBotCommands() {
  return fetchJson('/api/bot-commands', { ttlMs: 300000 });
}

export function getChangelog() {
  return fetchJson('/data/changelog.json', { ttlMs: 300000 });
}

export function getDashboardGuilds() {
  return fetchJson('/api/dashboard/guilds', { ttlMs: 30000 });
}

export function getDashboardServer(guildId) {
  return fetchJson(`/api/dashboard/server/${encodeURIComponent(guildId)}`, { ttlMs: 30000 });
}
