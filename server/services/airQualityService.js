import { CityNotFoundError } from '../errors.js';
import { buildAirQualityPayload } from '../domain/airQualityPayload.js';

/**
 * Air-quality lookups with three protections against needless or failing provider calls:
 *  1. a short-lived cache of complete payloads;
 *  2. de-duplication of identical in-flight requests;
 *  3. "stale while error": when the provider fails, the last good reading is returned and
 *     clearly flagged `stale: true` instead of failing or inventing data.
 *
 * @param {object} deps
 * @param {ReturnType<import('./openMeteo.js').createOpenMeteoClient>} deps.client
 * @param {import('../utils/ttlCache.js').TtlCache} deps.payloadCache
 * @param {import('../utils/ttlCache.js').TtlCache} deps.locationCache
 * @param {{ warn: Function }} deps.logger
 * @param {() => Date} [deps.now]
 */
export function createAirQualityService({
  client,
  payloadCache,
  locationCache,
  logger,
  now = () => new Date(),
}) {
  const inFlight = new Map();

  const resolveLocation = async (city, key) => {
    const cached = locationCache.getFresh(key);
    if (cached) {
      return cached;
    }
    const location = await client.lookupCity(city);
    locationCache.set(key, location);
    return location;
  };

  const fetchLive = async (city, key) => {
    try {
      const location = await resolveLocation(city, key);
      const air = await client.fetchAirQuality(location);
      const payload = buildAirQualityPayload(location, air, now());
      payloadCache.set(key, payload);
      return payload;
    } catch (error) {
      if (error instanceof CityNotFoundError) {
        throw error;
      }
      const stale = payloadCache.getStale(key);
      if (!stale) {
        throw error;
      }
      logger.warn('[AirQuality] provider unavailable, serving last good reading', {
        code: error.code,
      });
      return {
        ...stale.value,
        stale: true,
        staleReason: 'provider_unavailable',
        staleAgeSeconds: Math.round(stale.ageMs / 1000),
      };
    }
  };

  return {
    /**
     * @param {string} city Already validated city name.
     * @throws {CityNotFoundError | import('../errors.js').UpstreamError}
     */
    async getAirQuality(city) {
      const key = city.toLowerCase();
      const fresh = payloadCache.getFresh(key);
      if (fresh) {
        return fresh;
      }

      if (!inFlight.has(key)) {
        inFlight.set(
          key,
          fetchLive(city, key).finally(() => inFlight.delete(key)),
        );
      }
      return inFlight.get(key);
    },
  };
}
