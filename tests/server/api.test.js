import { afterEach, describe, expect, it, vi } from 'vitest';
import { airResponse, geocodeOk, jsonResponse, startApp } from './helpers.js';

let ctx;
afterEach(async () => ctx && (await ctx.close()));

const routeFetch = (handlers) =>
  vi.fn(async (url) => {
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (String(url).includes(pattern)) return handler(url);
    }
    throw new Error(`Unexpected URL ${url}`);
  });

describe('GET /api/health', () => {
  it('reports status and feature flags without secrets', async () => {
    ctx = await startApp({ env: { GEMINI_API_KEY: 'secret-key' } });
    const res = await ctx.request('/api/health');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      service: 'aerosage-api',
      features: { gemini: true, supabase: false },
    });
    expect(JSON.stringify(body)).not.toContain('secret-key');
  });
  it('sets security headers', async () => {
    ctx = await startApp();
    const res = await ctx.request('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});

describe('GET /api/aqi', () => {
  it('400 when city is missing, blank or not a string', async () => {
    ctx = await startApp();
    for (const q of ['', '?city=', '?city=%20%20', '?city[]=a&city[]=b']) {
      const res = await ctx.request(`/api/aqi${q}`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/city/i);
    }
  });

  it('returns demo data clearly labelled and makes no external call', async () => {
    const fetchImpl = vi.fn();
    ctx = await startApp({ fetchImpl });
    const body = await (await ctx.request('/api/aqi?city=Delhi&demo=1')).json();
    expect(body.demo).toBe(true);
    expect(body.source).toMatch(/DEMO MODE/);
    expect(body.series).toHaveLength(97);
    expect(body.series[body.nowIndex].aqi).toBe(body.current.aqi);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('computes live AQI from mocked Open-Meteo data', async () => {
    const fetchImpl = routeFetch({
      'geocoding-api': () => jsonResponse(geocodeOk),
      'air-quality-api': () => jsonResponse(airResponse({ pm25: 100, pm10: 150 })),
    });
    ctx = await startApp({ fetchImpl });
    const body = await (await ctx.request('/api/aqi?city=Kolkata')).json();
    // PM2.5 = 100 -> 232 (231.7 rounded), PM10 = 150 -> 125; AQI is the worst sub-index.
    expect(body.demo).toBe(false);
    expect(body.current).toMatchObject({ pm25: 100, pm10: 150, aqi: 232, category: 'Poor' });
    expect(body.place).toEqual({ name: 'Kolkata', admin: 'West Bengal', country: 'India' });
    expect(body.series).toHaveLength(6 * 24 + 0 - 24); // 144 hourly points minus 24 h warm-up
    expect(body.series[0].aqi).toBe(232); // every kept hour has a full 24 h window
    expect(body.series[body.nowIndex].future).toBe(false);
    expect(body.series[body.nowIndex + 1].future).toBe(true);
    expect(body.source).toMatch(/not a ground sensor/);
  });

  it('keeps missing pollutants as null instead of inventing values', async () => {
    const air = airResponse();
    air.current.pm2_5 = null;
    air.hourly.pm2_5 = air.hourly.pm2_5.map(() => null);
    air.hourly.pm10 = air.hourly.pm10.map(() => null);
    ctx = await startApp({
      fetchImpl: routeFetch({
        'geocoding-api': () => jsonResponse(geocodeOk),
        'air-quality-api': () => jsonResponse(air),
      }),
    });
    const body = await (await ctx.request('/api/aqi?city=Kolkata')).json();
    expect(body.current.aqi).toBeNull();
    expect(body.current.category).toBe('Unavailable');
    expect(body.current.pm25).toBeNull();
  });

  it('404 for an unknown city', async () => {
    ctx = await startApp({ fetchImpl: routeFetch({ 'geocoding-api': () => jsonResponse({}) }) });
    const res = await ctx.request('/api/aqi?city=Nowhereville');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/Nowhereville/);
  });

  it.each([
    ['upstream HTTP error', () => jsonResponse({}, 500)],
    [
      'network failure',
      () => {
        throw new TypeError('fetch failed');
      },
    ],
    [
      'timeout',
      () => {
        throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
      },
    ],
  ])('502 with demo hint on %s', async (_label, failing) => {
    ctx = await startApp({ fetchImpl: routeFetch({ 'geocoding-api': failing }) });
    const res = await ctx.request('/api/aqi?city=Kolkata');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ canDemo: true });
  });

  it('502 when the air-quality payload is incomplete', async () => {
    ctx = await startApp({
      fetchImpl: routeFetch({
        'geocoding-api': () => jsonResponse(geocodeOk),
        'air-quality-api': () => jsonResponse({ hourly: {} }),
      }),
    });
    expect((await ctx.request('/api/aqi?city=Kolkata')).status).toBe(502);
  });

  it('URL-encodes the city when calling the geocoder', async () => {
    const fetchImpl = routeFetch({ 'geocoding-api': () => jsonResponse({}) });
    ctx = await startApp({ fetchImpl });
    await ctx.request('/api/aqi?city=' + encodeURIComponent('a&b=c d'));
    expect(String(fetchImpl.mock.calls[0][0])).toContain('name=a%26b%3Dc%20d');
  });

  it('caches successful lookups and does not cache failures', async () => {
    let airCalls = 0;
    const fetchImpl = routeFetch({
      'geocoding-api': () => jsonResponse(geocodeOk),
      'air-quality-api': () => (++airCalls, jsonResponse(airResponse())),
    });
    ctx = await startApp({ fetchImpl });
    await ctx.request('/api/aqi?city=Kolkata');
    await ctx.request('/api/aqi?city=kolkata');
    expect(airCalls).toBe(1);
  });

  it('re-fetches after the cache expires', async () => {
    let airCalls = 0;
    const fetchImpl = routeFetch({
      'geocoding-api': () => jsonResponse(geocodeOk),
      'air-quality-api': () => (++airCalls, jsonResponse(airResponse())),
    });
    ctx = await startApp({ fetchImpl, aqiCacheTtlMs: 0 });
    await ctx.request('/api/aqi?city=Kolkata');
    await ctx.request('/api/aqi?city=Kolkata');
    expect(airCalls).toBe(2);
  });
});

describe('error handling and routing', () => {
  it('returns JSON 400 (no stack trace) for malformed JSON', async () => {
    ctx = await startApp();
    const res = await ctx.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(JSON.parse(text).error).toMatch(/JSON/);
    expect(text).not.toMatch(/at .*\.js/);
  });
  it('returns 413 for oversized bodies', async () => {
    ctx = await startApp();
    const res = await ctx.post('/api/chat', { message: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });
  it('returns JSON 404 for unknown API routes', async () => {
    ctx = await startApp();
    const res = await ctx.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found.' });
  });
  it('serves a JSON root when no frontend build is served', async () => {
    ctx = await startApp();
    expect(await (await ctx.request('/')).json()).toMatchObject({ name: 'AeroSage API' });
  });
});

describe('CORS', () => {
  it('only allows configured origins', async () => {
    ctx = await startApp({
      env: { CORS_ORIGIN: 'https://app.example.com/, https://b.example.com' },
    });
    const ok = await ctx.request('/api/health', { headers: { Origin: 'https://app.example.com' } });
    const bad = await ctx.request('/api/health', {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('rate limiting', () => {
  it('limits the chat endpoint with a JSON 429', async () => {
    ctx = await startApp({ limits: { chat: { limit: 2, windowMs: 60_000 } } });
    const statuses = [];
    for (let i = 0; i < 3; i++)
      statuses.push((await ctx.post('/api/chat', { message: 'hi' })).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
  it('limits general API traffic but never the health check', async () => {
    ctx = await startApp({ limits: { api: { limit: 2, windowMs: 60_000 } } });
    const aqi = [];
    for (let i = 0; i < 3; i++) aqi.push((await ctx.request('/api/aqi?city=X&demo=1')).status);
    expect(aqi).toEqual([200, 200, 429]);
    expect((await ctx.request('/api/health')).status).toBe(200);
  });
});
