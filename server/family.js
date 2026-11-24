import express from 'express';
import { FAMILY_TYPES, MAX_PROFILE_NAME, cleanText, isUuid } from './validation.js';

export const MAX_PROFILES_PER_DEVICE = 20;

/**
 * Family profile routes backed by Supabase (PostgREST). All Supabase access uses the
 * server-side service key; the browser never sees it.
 */
export function createFamilyRouter({ supabaseUrl, supabaseKey, fetchImpl, logger = console }) {
  const router = express.Router();
  const configured = Boolean(supabaseUrl && supabaseKey);

  const supabase = (endpoint, options = {}) =>
    fetchImpl(`${supabaseUrl}/rest/v1/${endpoint}`, {
      ...options,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...options.headers,
      },
      signal: AbortSignal.timeout(10000),
    });

  router.get('/', async (req, res) => {
    if (!configured) return res.json({ enabled: false, items: [] });
    if (!isUuid(req.query.device)) return res.status(400).json({ error: 'Invalid device ID.' });

    try {
      const response = await supabase(
        `profiles?device_id=eq.${req.query.device}&select=id,name,type&order=created_at`,
      );
      if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}`);
      return res.json({ enabled: true, items: await response.json() });
    } catch (error) {
      // The client falls back to on-device storage when cloud storage is unavailable.
      logger.error('[Family GET]', error.message);
      return res.json({ enabled: false, items: [] });
    }
  });

  router.post('/', async (req, res) => {
    if (!configured)
      return res.status(503).json({ error: 'Family cloud storage is not configured.' });

    const { device, name, type } = req.body || {};
    const cleanName = cleanText(name, MAX_PROFILE_NAME);
    if (!isUuid(device) || !FAMILY_TYPES.includes(type) || !cleanName) {
      return res.status(400).json({ error: 'Invalid family profile information.' });
    }

    try {
      const existing = await supabase(`profiles?device_id=eq.${device}&select=id`);
      if (!existing.ok) throw new Error(`Supabase returned HTTP ${existing.status}`);
      if ((await existing.json()).length >= MAX_PROFILES_PER_DEVICE) {
        return res
          .status(409)
          .json({ error: `You can save up to ${MAX_PROFILES_PER_DEVICE} family profiles.` });
      }

      const response = await supabase('profiles', {
        method: 'POST',
        body: JSON.stringify({ device_id: device, name: cleanName, type }),
      });
      const data = await response.json().catch(() => []);
      if (!response.ok || !data[0]) throw new Error(`Supabase returned HTTP ${response.status}`);

      const { id, name: savedName, type: savedType } = data[0];
      return res.status(201).json({ item: { id, name: savedName, type: savedType } });
    } catch (error) {
      logger.error('[Family POST]', error.message);
      return res.status(502).json({ error: 'Unable to save family profile.' });
    }
  });

  router.delete('/:id', async (req, res) => {
    if (!configured)
      return res.status(503).json({ error: 'Family cloud storage is not configured.' });

    const { id } = req.params;
    const { device } = req.query;
    if (!isUuid(id) || !isUuid(device)) {
      return res.status(400).json({ error: 'Invalid profile or device ID.' });
    }

    try {
      const response = await supabase(`profiles?id=eq.${id}&device_id=eq.${device}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}`);
      const deleted = await response.json().catch(() => []);
      if (Array.isArray(deleted) && deleted.length === 0) {
        return res.status(404).json({ error: 'Profile not found.' });
      }
      return res.json({ ok: true });
    } catch (error) {
      logger.error('[Family DELETE]', error.message);
      return res.status(502).json({ error: 'Unable to delete family profile.' });
    }
  });

  return router;
}
