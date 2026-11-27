import express from 'express';
import { CityNotFoundError, UpstreamError } from '../errors.js';
import { buildDemoData } from '../domain/demo.js';
import { parseCity } from '../utils/validation.js';

/** GET /api/aqi?city=NAME[&demo=1] */
export function createAqiRouter({ airQualityService, logger }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const city = parseCity(req.query.city);
    if (!city) {
      return res.status(400).json({ error: 'Please enter a city name.' });
    }
    if (req.query.demo === '1') {
      return res.json(buildDemoData(city));
    }

    try {
      return res.json(await airQualityService.getAirQuality(city));
    } catch (error) {
      if (error instanceof CityNotFoundError) {
        return res
          .status(404)
          .json({ error: `Could not find "${city}". Try a nearby larger city.` });
      }
      if (!(error instanceof UpstreamError)) {
        logger.error('[AQI] unexpected error', { message: error?.message });
      }
      return res
        .status(502)
        .json({ error: 'Live air quality service is unavailable right now.', canDemo: true });
    }
  });

  return router;
}
