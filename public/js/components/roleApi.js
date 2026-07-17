import { invalidateGuildRoles } from '../api.js';
import { isDemoRoute } from '../demoData.js';

async function roleRequest(url, options, timeoutMessage) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Role request failed with ${response.status}.`);
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(timeoutMessage);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createGuildRole(guildId, name) {
  if (isDemoRoute()) throw new Error('Demo mode is read-only. Real Discord roles cannot be created.');
  const data = await roleRequest(
    `/api/dashboard/servers/${encodeURIComponent(guildId)}/roles`,
    { method: 'POST', body: JSON.stringify({ name }) },
    'Role creation timed out. Try again in a few seconds.',
  );
  if (!data?.role?.id) throw new Error('Discord created the role but did not return a usable role ID.');
  invalidateGuildRoles(guildId);
  return data;
}

export async function deleteGuildRole(guildId, roleId, expectedName) {
  if (isDemoRoute()) throw new Error('Demo mode is read-only. Real Discord roles cannot be deleted.');
  const data = await roleRequest(
    `/api/dashboard/servers/${encodeURIComponent(guildId)}/roles/${encodeURIComponent(roleId)}`,
    { method: 'DELETE', body: JSON.stringify({ expectedName }) },
    'Role deletion timed out. Try again in a few seconds.',
  );
  invalidateGuildRoles(guildId);
  return data;
}
