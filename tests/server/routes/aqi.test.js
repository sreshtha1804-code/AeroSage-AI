import { afterEach, describe, expect, it, vi } from 'vitest';
import { airResponse, geocodeOk, jsonResponse, routeFetch, startApp } from '../helpers.js';

let app;
afterEach(async () => app && (await app.close()));

const liveFetch = (air = airResponse()) =>
  routeFetch({
    'geocoding-api': () => jsonResponse(geocodeOk),
    'air-quality-api': () => jsonResponse(air),
  });

describe('GET /api/aqi validation', () => {
  it('400 when city is missing, blank or not a single string', async () => {
    app = await startApp();
    for (const query of ['', '?city=', '?city=%20%20', '?city[]=a&city[]=b', '?city[x]=1']) {
      const res = await app.request(`/api/aqi${query}`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/city/i);
    }
  });

  it('truncates absurdly long names and strips control characters', async () => {
    const fetchImpl = routeFetch({ 'geocoding-api': () => jsonResponse({}) });
    app = await startApp({ fetchImpl });
    await app.request(`/api/aqi?city=${encodeURIComponent(`x\u0000y${'z'.repeat(300)}`)}`);
    const name = new URL(String(fetchImpl.mock.calls[0][0])).searchParams.get('name');
    expect(name).toHaveLength(80);
    expect(name.startsWith('x y')).toBe(true);
  });
});

describe('GET /api/aqi demo mode', () => {
  it('returns clearly labelled synthetic data with no external calls', async () => {
    const fetchImpl = vi.fn();
    app = await startApp({ fetchImpl });
    const body = await (await app.request('/api/aqi?city=Delhi&demo=1')).json();
    expect(body).toMatchObject({ demo: true, dataType: 'synthetic' });
    expect(body.source).toMatch(/DEMO MODE/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('GET /api/aqi live data', () => {
  it('returns the estimated CPCB AQI with provenance, units and timestamps', async () => {
    app = await startApp({ fetchImpl: liveFetch() });
    const body = await (await app.request('/api/aqi?city=Kolkata')).json();
    expect(body).toMatchObject({ demo: false, stale: false, dataType: 'model' });
    expect(body.current).toMatchObject({
      aqi: 232,
      category: 'Poor',
      dominantPollutantLabel: 'PM2.5',
      pm25: 100,
      co: 300,
    });
    expect(body.aqiMeta).toMatchObject({ estimated: true, basis: 'full', pollutantsUsed: 6 });
    expect(body.units.co).toBe('µg/m³');
    expect(body.place).toMatchObject({ name: 'Kolkata', timezone: 'Asia/Kolkata' });
    expect(body.current.observedAtUtc).toBe('2026-11-20T04:45:00.000Z');
    expect(body.series).toHaveLength(120);
    expect(body.series[body.nowIndex + 1].future).toBe(true);
  });

  it('keeps missing pollutants null and reports Unavailable when no particulates exist', async () => {
    app = await startApp({
      fetchImpl: liveFetch(airResponse({ values: { pm25: null, pm10: null } })),
    });
    const body = await (await app.request('/api/aqi?city=Kolkata')).json();
    expect(body.current).toMatchObject({
      aqi: null,
      category: 'Unavailable',
      pm25: null,
      pm10: null,
      no2: 20,
    });
    expect(body.aqiMeta.basis).toBe('unavailable');
  });

  it('404 for an unknown city', async () => {
    app = await startApp({ fetchImpl: routeFetch({ 'geocoding-api': () => jsonResponse({}) }) });
    const res = await app.request('/api/aqi?city=Nowhereville');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/Nowhereville/);
  });

  it.each([
    ['upstream HTTP 500', () => jsonResponse({}, 500)],
    [
      'network failure',
      () => {
        throw new TypeError('fetch failed');
      },
    ],
    [
      'timeout',
      () => {
        throw Object.assign(new Error('t'), { name: 'TimeoutError' });
      },
    ],
  ])('502 with a demo hint on %s, without leaking details', async (_label, failing) => {
    app = await startApp({ fetchImpl: routeFetch({ 'geocoding-api': failing }) });
    const res = await app.request('/api/aqi?city=Kolkata');
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(JSON.parse(text)).toEqual({
      error: 'Live air quality service is unavailable right now.',
      canDemo: true,
    });
  });

  it('502 when the provider payload is malformed', async () => {
    app = await startApp({ fetchImpl: liveFetch({ hourly: {} }) });
    expect((await app.request('/api/aqi?city=Kolkata')).status).toBe(502);
  });

  it('caches successful lookups (one provider call for repeated requests)', async () => {
    const fetchImpl = liveFetch();
    app = await startApp({ fetchImpl });
    await app.request('/api/aqi?city=Kolkata');
    await app.request('/api/aqi?city=kolkata');
    const airCalls = fetchImpl.mock.calls.filter(([u]) => String(u).includes('air-quality-api'));
    expect(airCalls).toHaveLength(1);
  });

  it('de-duplicates concurrent identical requests', async () => {
    const fetchImpl = liveFetch();
    app = await startApp({ fetchImpl });
    await Promise.all([1, 2, 3, 4].map(() => app.request('/api/aqi?city=Kolkata')));
    expect(
      fetchImpl.mock.calls.filter(([u]) => String(u).includes('air-quality-api')),
    ).toHaveLength(1);
  });

  it('serves the last good reading labelled stale when the provider later fails', async () => {
    let failing = false;
    const fetchImpl = routeFetch({
      'geocoding-api': () => jsonResponse(geocodeOk),
      'air-quality-api': () => (failing ? jsonResponse({}, 503) : jsonResponse(airResponse())),
    });
    app = await startApp({ fetchImpl, overrides: { airQualityCache: { freshMs: 0 } } });
    const good = await (await app.request('/api/aqi?city=Kolkata')).json();
    failing = true;
    const res = await app.request('/api/aqi?city=Kolkata');
    const stale = await res.json();
    expect(res.status).toBe(200);
    expect(stale).toMatchObject({
      stale: true,
      staleReason: 'provider_unavailable',
      fetchedAt: good.fetchedAt,
    });
    expect(stale.current.aqi).toBe(good.current.aqi);
  });

  it('responses are never cached by browsers or proxies', async () => {
    app = await startApp({ fetchImpl: liveFetch() });
    expect((await app.request('/api/aqi?city=Kolkata')).headers.get('cache-control')).toBe(
      'no-store',
    );
  });
});
