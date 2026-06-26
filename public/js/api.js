async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with ${response.status}`);
  }

  return data;
}

export function getBotStats() {
  return fetchJson('/api/bot-stats');
}

export function getBotCommands() {
  return fetchJson('/api/bot-commands');
}

export function getChangelog() {
  return fetchJson('/data/changelog.json');
}
