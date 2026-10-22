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

function dedupeKey(input, init = {}) {
  if (requestMethod(input, init) !== 'GET') return null;
  const raw = requestUrl(input);
  if (!raw) return null;

  const url = new URL(raw, window.location.origin);
  if (url.origin !== window.location.origin) return null;

  const path = url.pathname;
  const isFeatureRequest = /^\/api\/dashboard\/servers\/[^/]+\/(starboard|backups)$/.test(path);
  const isServerSnapshot = /^\/api\/dashboard\/servers\/[^/]+$/.test(path);
  if (!isFeatureRequest && !isServerSnapshot) return null;

  return `${requestMethod(input, init)}:${url.pathname}${url.search}`;
}

function readCachedResponse(cache, key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.response.clone();
}

window.fetch = async function meowzDashboardFetch(input, init = {}) {
  const key = dedupeKey(input, init);
  if (!key) return originalFetch(input, init);

  const cachedSuccess = readCachedResponse(shortCache, key);
  if (cachedSuccess) return cachedSuccess;

  const cachedFailure = readCachedResponse(failureCache, key);
  if (cachedFailure) return cachedFailure;

  if (inFlight.has(key)) {
    const response = await inFlight.get(key);
    return response.clone();
  }

  const request = originalFetch(input, init)
    .then((response) => {
      if (response.ok) {
        shortCache.set(key, {
          response: response.clone(),
          expiresAt: Date.now() + CACHE_MS,
        });
        failureCache.delete(key);
      } else if (response.status === 429) {
        failureCache.set(key, {
          response: response.clone(),
          expiresAt: Date.now() + RATE_LIMIT_COOLDOWN_MS,
        });
      }
      return response;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  const response = await request;
  return response.clone();
};
