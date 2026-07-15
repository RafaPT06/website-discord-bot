import { invalidateGuildRoles } from '../api.js';
import { isDemoRoute } from '../demoData.js';

export async function createGuildRole(guildId, name) {
  if (isDemoRoute()) throw new Error('Demo mode is read-only. Real Discord roles cannot be created.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`/api/dashboard/servers/${encodeURIComponent(guildId)}/roles`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Role creation failed with ${response.status}.`);
    if (!data?.role?.id) throw new Error('Discord created the role but did not return a usable role ID.');
    invalidateGuildRoles(guildId);
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Role creation timed out. Try again in a few seconds.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
