import { describe, expect, it, vi } from 'vitest';
import { CityNotFoundError, UpstreamError } from '../../../server/errors.js';
import { parseAirQuality } from '../../../server/domain/airQualityParser.js';
import { createAirQualityService } from '../../../server/services/airQualityService.js';
import { TtlCache } from '../../../server/utils/ttlCache.js';
import { airResponse, silentLogger } from '../helpers.js';

const location = { name: 'Kolkata', latitude: 1, longitude: 1 };
const air = parseAirQuality(airResponse());

function setup(clientOverrides = {}) {
  const clock = { ms: 0 };
  const client = {
    lookupCity: vi.fn(async () => location),
    fetchAirQuality: vi.fn(async () => air),
    ...clientOverrides,
  };
  const cacheOptions = { freshMs: 1000, staleMs: 10_000, maxEntries: 10, now: () => clock.ms };
  const service = createAirQualityService({
    client,
    payloadCache: new TtlCache(cacheOptions),
    locationCache: new TtlCache({ ...cacheOptions, freshMs: 5000 }),
    logger: silentLogger(),
    now: () => new Date('2026-11-24T08:00:00Z'),
  });
  return { service, client, clock };
}

describe('air quality service', () => {
  it('caches complete payloads case-insensitively', async () => {
    const { service, client } = setup();
    const first = await service.getAirQuality('Kolkata');
    const second = await service.getAirQuality('KOLKATA');
    expect(second).toBe(first);
    expect(client.fetchAirQuality).toHaveBeenCalledTimes(1);
  });

  it('de-duplicates identical concurrent requests into one provider call', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const { service, client } = setup({
      fetchAirQuality: vi.fn(async () => {
        await gate;
        return air;
      }),
    });
    const calls = [
      service.getAirQuality('Kolkata'),
      service.getAirQuality('kolkata'),
      service.getAirQuality('Kolkata'),
    ];
    release();
    const results = await Promise.all(calls);
    expect(client.fetchAirQuality).toHaveBeenCalledTimes(1);
    expect(client.lookupCity).toHaveBeenCalledTimes(1);
    expect(results[0]).toBe(results[1]);
  });

  it('allows a new request after an in-flight one finishes (even if it failed)', async () => {
    const { service, client } = setup({
      fetchAirQuality: vi
        .fn()
        .mockRejectedValueOnce(new UpstreamError('network', 'x'))
        .mockResolvedValue(air),
    });
    await expect(service.getAirQuality('Kolkata')).rejects.toBeInstanceOf(UpstreamError);
    await expect(service.getAirQuality('Kolkata')).resolves.toMatchObject({ stale: false });
    expect(client.fetchAirQuality).toHaveBeenCalledTimes(2);
  });

  it('remembers the geocoded location so refreshes skip geocoding', async () => {
    const { service, client, clock } = setup();
    await service.getAirQuality('Kolkata');
    clock.ms = 2000; // payload expired (1000) but location still fresh (5000)
    await service.getAirQuality('Kolkata');
    expect(client.lookupCity).toHaveBeenCalledTimes(1);
    expect(client.fetchAirQuality).toHaveBeenCalledTimes(2);
    clock.ms = 9000; // location expired too
    await service.getAirQuality('Kolkata');
    expect(client.lookupCity).toHaveBeenCalledTimes(2);
  });

  it('serves the last good reading flagged as stale when the provider fails', async () => {
    const { service, client, clock } = setup();
    const good = await service.getAirQuality('Kolkata');
    clock.ms = 4000;
    client.fetchAirQuality.mockRejectedValue(new UpstreamError('timeout', 'slow'));
    const stale = await service.getAirQuality('Kolkata');
    expect(stale).toMatchObject({
      stale: true,
      staleReason: 'provider_unavailable',
      staleAgeSeconds: 4,
      fetchedAt: good.fetchedAt,
    });
    expect(stale.current.aqi).toBe(good.current.aqi);
    expect(good.stale).toBe(false); // the cached object itself is not mutated
  });

  it('stops serving stale data after the stale window and then surfaces the error', async () => {
    const { service, client, clock } = setup();
    await service.getAirQuality('Kolkata');
    clock.ms = 11_000;
    client.fetchAirQuality.mockRejectedValue(new UpstreamError('network', 'down'));
    await expect(service.getAirQuality('Kolkata')).rejects.toMatchObject({ code: 'network' });
  });

  it('surfaces the error when nothing was ever cached', async () => {
    const { service } = setup({
      lookupCity: vi.fn(async () => {
        throw new UpstreamError('http', 'x', { status: 500 });
      }),
    });
    await expect(service.getAirQuality('Nowhere')).rejects.toMatchObject({ code: 'http' });
  });

  it('never masks "city not found" with stale data', async () => {
    const { service, client, clock } = setup();
    await service.getAirQuality('Kolkata');
    clock.ms = 6000;
    client.lookupCity.mockRejectedValue(new CityNotFoundError('Kolkata'));
    await expect(service.getAirQuality('Kolkata')).rejects.toBeInstanceOf(CityNotFoundError);
  });
});
