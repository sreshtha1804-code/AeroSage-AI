import express from 'express';
import { REQUEST_LIMITS } from '../constants.js';
import { cleanText, FAMILY_TYPES, isUuid, MAX_PROFILE_NAME } from '../utils/validation.js';

const NOT_CONFIGURED = { error: 'Family cloud storage is not configured.' };

/** Family profile routes. `store` is a profile store (see services/profileStore.js). */
export function createFamilyRouter({ store, logger }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    if (!store.configured) {
      return res.json({ enabled: false, items: [] });
    }
    if (!isUuid(req.query.device)) {
      return res.status(400).json({ error: 'Invalid device ID.' });
    }

    try {
      return res.json({ enabled: true, items: await store.list(req.query.device) });
    } catch (error) {
      // The client falls back to on-device storage when cloud storage is unavailable.
      logger.error('[Family] list failed', { message: error.message });
      return res.json({ enabled: false, items: [] });
    }
  });

  router.post('/', async (req, res) => {
    if (!store.configured) {
      return res.status(503).json(NOT_CONFIGURED);
    }

    const { device, name, type } = req.body || {};
    const cleanName = cleanText(name, MAX_PROFILE_NAME);
    if (!isUuid(device) || !FAMILY_TYPES.includes(type) || !cleanName) {
      return res.status(400).json({ error: 'Invalid family profile information.' });
    }

    try {
      if ((await store.countFor(device)) >= REQUEST_LIMITS.profilesPerDevice) {
        return res.status(409).json({
          error: `You can save up to ${REQUEST_LIMITS.profilesPerDevice} family profiles.`,
        });
      }
      const item = await store.create({ deviceId: device, name: cleanName, type });
      return res.status(201).json({ item });
    } catch (error) {
      logger.error('[Family] create failed', { message: error.message });
      return res.status(502).json({ error: 'Unable to save family profile.' });
    }
  });

  router.delete('/:id', async (req, res) => {
    if (!store.configured) {
      return res.status(503).json(NOT_CONFIGURED);
    }

    const { id } = req.params;
    const { device } = req.query;
    if (!isUuid(id) || !isUuid(device)) {
      return res.status(400).json({ error: 'Invalid profile or device ID.' });
    }

    try {
      const deleted = await store.remove({ id, deviceId: device });
      return deleted
        ? res.json({ ok: true })
        : res.status(404).json({ error: 'Profile not found.' });
    } catch (error) {
      logger.error('[Family] delete failed', { message: error.message });
      return res.status(502).json({ error: 'Unable to delete family profile.' });
    }
  });

  return router;
}
