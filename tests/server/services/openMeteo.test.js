import { describe, expect, it, vi } from 'vitest';
import { createOpenMeteoClient } from '../../../server/services/openMeteo.js';
import { airResponse, geocodeOk, jsonResponse, silentLogger } from '../helpers.js';

const make = (fetchImpl, extra = {}) =>
  createOpenMeteoClient({
    fetchImpl,
    logger: silentLogger(),
    sleep: async () => {},
    random: () => 0,
    ...extra,
  });

describe('lookupCity', () => {
  it('returns a validated location and sends an encoded query', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(geocodeOk));
    const location = await make(fetchImpl).lookupCity('a&b c');
    expect(location).toMatchObject({ name: 'Kolkata', latitude: 22.56, longitude: 88.36 });
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain('name=a%26b+c');
    expect(url).toContain('count=1');
  });

  it('throws CityNotFoundError when there are no results', async () => {
    await expect(make(vi.fn(async () => jsonResponse({}))).lookupCity('Zzz')).rejects.toMatchObject(
      { name: 'CityNotFoundError', city: 'Zzz' },
    );
  });

  it('rejects an invalid geocoding hit as invalid_response (no retry)', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ results: [{ name: 'X', latitude: 999, longitude: 0 }] }),
    );
    await expect(make(fetchImpl).lookupCity('X')).rejects.toMatchObject({
      code: 'invalid_response',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('fetchAirQuality', () => {
  it('requests all six pollutants, 4 past + 2 forecast days and automatic timezone', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(airResponse()));
    const air = await make(fetchImpl).fetchAirQuality({ latitude: 22.56, longitude: 88.36 });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.searchParams.get('latitude')).toBe('22.56');
    expect(url.searchParams.get('hourly').split(',').sort()).toEqual([
      'carbon_monoxide',
      'nitrogen_dioxide',
      'ozone',
      'pm10',
      'pm2_5',
      'sulphur_dioxide',
    ]);
    expect(url.searchParams.get('past_days')).toBe('4');
    expect(url.searchParams.get('forecast_days')).toBe('2');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(air.current.pm25).toBe(100);
  });
});

describe('retry and error classification', () => {
  const location = { latitude: 1, longitude: 1 };

  it('retries a transient 503 then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse(airResponse()));
    await make(fetchImpl).fetchAirQuality(location);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries network errors and timeouts, then reports the right code', async () => {
    const network = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(make(network).fetchAirQuality(location)).rejects.toMatchObject({
      code: 'network',
    });
    expect(network).toHaveBeenCalledTimes(2);

    const timeout = vi.fn(async () => {
      throw Object.assign(new Error('t'), { name: 'TimeoutError' });
    });
    await expect(make(timeout).fetchAirQuality(location)).rejects.toMatchObject({
      code: 'timeout',
    });
    const aborted = vi.fn(async () => {
      throw Object.assign(new Error('a'), { name: 'AbortError' });
    });
    await expect(make(aborted).fetchAirQuality(location)).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('does not retry client errors (4xx) or malformed JSON', async () => {
    const notFound = vi.fn(async () => jsonResponse({}, 404));
    await expect(make(notFound).fetchAirQuality(location)).rejects.toMatchObject({
      code: 'http',
      status: 404,
    });
    expect(notFound).toHaveBeenCalledTimes(1);

    const badJson = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }));
    await expect(make(badJson).fetchAirQuality(location)).rejects.toMatchObject({
      code: 'invalid_response',
    });
    expect(badJson).toHaveBeenCalledTimes(1);
  });

  it('treats 429 and 500 as retryable', async () => {
    for (const status of [429, 500]) {
      const f = vi.fn(async () => jsonResponse({}, status));
      await expect(make(f).fetchAirQuality(location)).rejects.toMatchObject({ status });
      expect(f).toHaveBeenCalledTimes(2);
    }
  });

  it('logs failures without response bodies', async () => {
    const logger = silentLogger();
    await expect(
      make(
        vi.fn(async () => jsonResponse({ secret: 'x' }, 500)),
        { logger },
      ).fetchAirQuality(location),
    ).rejects.toBeTruthy();
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret');
  });

  it('exposes isRetryable on errors', async () => {
    const err = await make(vi.fn(async () => jsonResponse({}, 502)))
      .fetchAirQuality(location)
      .catch((e) => e);
    expect(err.isRetryable).toBe(true);
    const bad = await make(vi.fn(async () => jsonResponse({}, 400)))
      .fetchAirQuality(location)
      .catch((e) => e);
    expect(bad.isRetryable).toBe(false);
  });
});
