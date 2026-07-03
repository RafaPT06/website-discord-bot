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
  return fetchJson(`/api/dashboard/guilds?mode=${encodeURIComponent(normalized)}`, { cacheKey: `dashboard-guilds:${normalized}`, cacheMs: 10000 });
}

export function getDashboardServer(guildId) {
  return fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}`, { cacheKey: `dashboard-server:${guildId}`, cacheMs: 10000 });
}

export function getImageAccess(guildId) {
  return fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/image-access`, { cacheKey: `image-access:${guildId}`, cacheMs: 15000 });
}

export async function addImageAccessUser(guildId, userId) {
  const data = await fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/image-access`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  memoryCache.delete(`image-access:${guildId}`);
  return data;
}

export async function removeImageAccessUser(guildId, userId) {
  const data = await fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/image-access/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  memoryCache.delete(`image-access:${guildId}`);
  return data;
}

export function getWelcomeSettings(guildId) {
  return fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/welcome`, { cacheKey: `welcome-settings:${guildId}`, cacheMs: 10000 });
}

export async function saveWelcomeSettings(guildId, settings) {
  const data = await fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/welcome`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  memoryCache.delete(`welcome-settings:${guildId}`);
  return data;
}
