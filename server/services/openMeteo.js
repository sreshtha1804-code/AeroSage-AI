import { RETRY_POLICIES, TIMEOUTS_MS, AIR_QUALITY_WINDOW } from '../constants.js';
import { CityNotFoundError, UpstreamError } from '../errors.js';
import { parseAirQuality, parseLocation, PROVIDER_FIELDS } from '../domain/airQualityParser.js';
import { withRetry } from '../utils/retry.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const POLLUTANT_FIELDS = Object.values(PROVIDER_FIELDS).join(',');

const toUpstreamError = (error) => {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return new UpstreamError('timeout', 'The request to the air quality provider timed out.');
  }
  if (error instanceof SyntaxError) {
    return new UpstreamError('invalid_response', 'The provider returned invalid JSON.');
  }
  return new UpstreamError('network', 'The air quality provider could not be reached.');
};

/**
 * Client for the Open-Meteo geocoding and air-quality APIs.
 * All network access goes through the injected `fetchImpl`, so it can be mocked in tests.
 *
 * @param {object} deps
 * @param {typeof fetch} deps.fetchImpl
 * @param {{ warn: Function }} deps.logger
 * @param {object} [deps.retryPolicy]
 * @param {number} [deps.timeoutMs]
 * @param {(ms: number) => Promise<void>} [deps.sleep]
 * @param {() => number} [deps.random]
 */
export function createOpenMeteoClient({
  fetchImpl,
  logger,
  retryPolicy = RETRY_POLICIES.openMeteo,
  timeoutMs = TIMEOUTS_MS.openMeteo,
  sleep,
  random,
}) {
  /** GET `url` as JSON with a timeout and bounded retries for transient failures. */
  const requestJson = async (url) => {
    const outcome = await withRetry(
      async () => {
        try {
          const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
          if (!response.ok) {
            return {
              ok: false,
              error: new UpstreamError('http', `Provider returned HTTP ${response.status}`, {
                status: response.status,
              }),
            };
          }
          return { ok: true, data: await response.json() };
        } catch (error) {
          return { ok: false, error: toUpstreamError(error) };
        }
      },
      { ...retryPolicy, sleep, random, shouldRetry: (result) => result.error.isRetryable },
    );
    if (!outcome.ok) {
      logger.warn('[OpenMeteo] request failed', {
        code: outcome.error.code,
        status: outcome.error.status,
      });
      throw outcome.error;
    }
    return outcome.data;
  };

  return {
    /** @throws {CityNotFoundError | UpstreamError} */
    async lookupCity(city) {
      const query = new URLSearchParams({ name: city, count: '1', language: 'en', format: 'json' });
      const data = await requestJson(`${GEOCODING_URL}?${query}`);
      const hit = data?.results?.[0];
      if (!hit) {
        throw new CityNotFoundError(city);
      }
      return parseLocation(hit);
    },

    /** @throws {UpstreamError} */
    async fetchAirQuality({ latitude, longitude }) {
      const query = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: POLLUTANT_FIELDS,
        hourly: POLLUTANT_FIELDS,
        past_days: String(AIR_QUALITY_WINDOW.pastDays),
        forecast_days: String(AIR_QUALITY_WINDOW.forecastDays),
        timezone: 'auto',
      });
      return parseAirQuality(await requestJson(`${AIR_QUALITY_URL}?${query}`));
    },
  };
}
