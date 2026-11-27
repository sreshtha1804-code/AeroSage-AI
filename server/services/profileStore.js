import { TIMEOUTS_MS } from '../constants.js';

/**
 * Supabase (PostgREST) access for family profiles. Callers must pass validated UUIDs: they are
 * interpolated into query strings, so validation is what prevents filter injection.
 * The service key is used only here, on the server.
 */
export function createProfileStore({ url, key, fetchImpl, timeoutMs = TIMEOUTS_MS.supabase }) {
  const configured = Boolean(url && key);

  const call = async (endpoint, options = {}) => {
    const response = await fetchImpl(`${url}/rest/v1/${endpoint}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...options.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => []);
    if (!response.ok) {
      throw new Error(`Supabase returned HTTP ${response.status}`);
    }
    return data;
  };

  return {
    configured,
    list: (deviceId) =>
      call(`profiles?device_id=eq.${deviceId}&select=id,name,type&order=created_at`),
    countFor: async (deviceId) =>
      (await call(`profiles?device_id=eq.${deviceId}&select=id`)).length,
    async create({ deviceId, name, type }) {
      const [row] = await call('profiles', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId, name, type }),
      });
      if (!row) {
        throw new Error('Supabase returned no row');
      }
      return { id: row.id, name: row.name, type: row.type };
    },
    /** @returns {Promise<boolean>} whether a profile was deleted */
    async remove({ id, deviceId }) {
      const deleted = await call(`profiles?id=eq.${id}&device_id=eq.${deviceId}`, {
        method: 'DELETE',
      });
      return !Array.isArray(deleted) || deleted.length > 0;
    },
  };
}
