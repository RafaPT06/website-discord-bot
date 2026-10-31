const originalFetch = window.fetch.bind(window);
const inFlight = new Map();
const shortCache = new Map();
const failureCache = new Map();
const CACHE_MS = 2500;
const RATE_LIMIT_COOLDOWN_MS = 15000;

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input?.url || '';
}

function requestMethod(input, init = {}) {
  return String(init.method || input?.method || 'GET').toUpperCase();
}

function isDashboardReadPath(path) {
  if (/^\/api\/dashboard\/servers\/[^/]+$/.test(path)) return true;
  if (/^\/api\/dashboard\/servers\/[^/]+\/layout(?:\/snapshots(?:\/[^/]+(?:\/(?:diff|restore-plan))?)?)?$/.test(path)) return true;
  return /^\/api\/dashboard\/servers\/[^/]+\/(?:welcome|leveling|level-rewards|roles|ai-image-access|image-access|logs|moderation|moderation-access|starboard|backups)$/.test(path);
}

function dedupeKey(input, init = {}) {
  if (requestMethod(input, init) !== 'GET') return null;
  const raw = requestUrl(input);
  if (!raw) return null;
  const url = new URL(raw, window.location.origin);
  if (url.origin !== window.location.origin || !isDashboardReadPath(url.pathname)) return null;
  return `${requestMethod(input, init)}:${url.pathname}${url.search}`;
}

function readCachedResponse(cache, key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) { cache.delete(key); return null; }
  return cached.response.clone();
}

function invalidateDashboardReads(input, init = {}) {
  const method = requestMethod(input, init);
  if (method === 'GET') return;
  const raw = requestUrl(input);
  if (!raw) return;
  const url = new URL(raw, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/dashboard/servers/')) return;
  for (const key of [...shortCache.keys(), ...failureCache.keys()]) {
    if (key.includes(url.pathname) || key.startsWith(`GET:${url.pathname.split('/').slice(0, 5).join('/')}`)) {
      shortCache.delete(key); failureCache.delete(key);
    }
  }
}

window.fetch = async function meowzDashboardFetch(input, init = {}) {
  const key = dedupeKey(input, init);
  if (!key) { invalidateDashboardReads(input, init); return originalFetch(input, init); }
  const cachedSuccess = readCachedResponse(shortCache, key); if (cachedSuccess) return cachedSuccess;
  const cachedFailure = readCachedResponse(failureCache, key); if (cachedFailure) return cachedFailure;
  if (inFlight.has(key)) { const response = await inFlight.get(key); return response.clone(); }
  const request = originalFetch(input, init).then((response) => {
    if (response.ok) { shortCache.set(key,{response:response.clone(),expiresAt:Date.now()+CACHE_MS}); failureCache.delete(key); }
    else if (response.status === 429) failureCache.set(key,{response:response.clone(),expiresAt:Date.now()+RATE_LIMIT_COOLDOWN_MS});
    return response;
  }).finally(()=>inFlight.delete(key));
  inFlight.set(key,request); const response=await request; return response.clone();
};
