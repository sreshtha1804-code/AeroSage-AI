import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createErrorHandler } from '../../../server/middleware/errorHandlers.js';
import { loadConfig } from '../../../server/config.js';
import { createLogger } from '../../../server/logger.js';
import { jsonResponse, startApp } from '../helpers.js';

let app;
afterEach(async () => app && (await app.close()));

describe('GET /api/health', () => {
  it('reports status and feature flags without secrets', async () => {
    app = await startApp({ env: { GEMINI_API_KEY: 'secret-key' } });
    const res = await app.request('/api/health');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      service: 'aerosage-api',
      features: { gemini: true, supabase: false },
    });
    expect(JSON.stringify(body)).not.toContain('secret-key');
  });
  it('reports supabase as configured only when both values exist', async () => {
    app = await startApp({
      env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' },
    });
    expect((await (await app.request('/api/health')).json()).features.supabase).toBe(true);
  });
});

describe('security headers and caching', () => {
  it('sets hardened headers and hides the framework', async () => {
    app = await startApp();
    const res = await app.request('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('strict-transport-security')).toMatch(/max-age/);
    expect(res.headers.get('content-security-policy')).toMatch(/default-src 'self'/);
    expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
  });
  it('marks chat and family responses no-store', async () => {
    app = await startApp();
    expect((await app.post('/api/chat', { message: 'hi' })).headers.get('cache-control')).toBe(
      'no-store',
    );
    expect((await app.request('/api/family')).headers.get('cache-control')).toBe('no-store');
  });
});

describe('errors never leak internals', () => {
  it('malformed JSON -> JSON 400 without a stack trace', async () => {
    app = await startApp();
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(JSON.parse(text).error).toMatch(/JSON/);
    expect(text).not.toMatch(/at .*\.js|node_modules/);
  });
  it('oversized bodies -> 413', async () => {
    app = await startApp();
    expect((await app.post('/api/chat', { message: 'x'.repeat(200_000) })).status).toBe(413);
  });
  it('unknown API routes -> JSON 404 (never the SPA shell)', async () => {
    app = await startApp();
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found.' });
  });
  it('unexpected exceptions -> generic JSON 500, with the detail only in the log', async () => {
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    const probe = express();
    probe.get('/boom', () => {
      throw new Error('db password=hunter2');
    });
    probe.use(createErrorHandler(logger));
    const server = await new Promise((resolve) => {
      const s = probe.listen(0, '127.0.0.1', () => resolve(s));
    });
    const res = await fetch(`http://127.0.0.1:${server.address().port}/boom`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Something went wrong on the server.' });
    expect(logger.error).toHaveBeenCalledWith('[Unhandled]', { message: 'db password=hunter2' });
    await new Promise((resolve) => server.close(resolve));
  });
  it('serves a JSON root when no frontend build is served', async () => {
    app = await startApp();
    expect(await (await app.request('/')).json()).toMatchObject({ name: 'AeroSage API' });
  });
});

describe('hostile input', () => {
  it('prototype-pollution style bodies are ignored by the whitelisting sanitisers', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    );
    app = await startApp({ env: { GEMINI_API_KEY: 'k' }, fetchImpl });
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"message":"hi","context":{"__proto__":{"pwnedMarker":true},"constructor":{"prototype":{"pwnedMarker":true}},"aqi":50},"profile":[{"__proto__":{"x":1},"name":"A"}]}',
    });
    expect(res.status).toBe(200);
    expect({}.pwnedMarker).toBeUndefined();
    const prompt = JSON.parse(fetchImpl.mock.calls[0][1].body).systemInstruction.parts[0].text;
    expect(prompt).not.toContain('pwnedMarker');
  });

  it('script/HTML in a city name is passed through as data and never executed or reflected unescaped', async () => {
    app = await startApp({ fetchImpl: vi.fn(async () => jsonResponse({})) });
    const res = await app.request(
      `/api/aqi?city=${encodeURIComponent('<script>alert(1)</script>')}`,
    );
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.status).toBe(404);
  });
});

describe('CORS', () => {
  it('only allows configured origins (trailing slashes tolerated)', async () => {
    app = await startApp({
      env: { CORS_ORIGIN: 'https://app.example.com/, https://b.example.com' },
    });
    const ok = await app.request('/api/health', { headers: { Origin: 'https://app.example.com' } });
    const bad = await app.request('/api/health', {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
  it('answers preflight with only the needed methods', async () => {
    app = await startApp({ env: { CORS_ORIGIN: 'https://app.example.com' } });
    const res = await app.request('/api/chat', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.com', 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.headers.get('access-control-allow-methods')).toBe('GET,POST,DELETE,OPTIONS');
  });
});

describe('rate limiting', () => {
  it('limits chat with a JSON 429', async () => {
    app = await startApp({ overrides: { rateLimits: { chat: { limit: 2, windowMs: 60_000 } } } });
    const statuses = [];
    for (let i = 0; i < 3; i++)
      statuses.push((await app.post('/api/chat', { message: 'hi' })).status);
    expect(statuses).toEqual([200, 200, 429]);
    const limited = await app.post('/api/chat', { message: 'hi' });
    expect((await limited.json()).error).toMatch(/Too many assistant messages/);
  });
  it('limits general API traffic but never the health check', async () => {
    app = await startApp({ overrides: { rateLimits: { api: { limit: 2, windowMs: 60_000 } } } });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await app.request('/api/aqi?city=X&demo=1')).status);
    expect(codes).toEqual([200, 200, 429]);
    expect((await app.request('/api/health')).status).toBe(200);
  });
});

describe('secrets in logs', () => {
  const fakeKey = ['AIza', 'FAKE'.repeat(6)].join('');
  it('the production logger redacts configured keys even if a library echoes them', () => {
    const sink = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };
    const config = loadConfig({
      GEMINI_API_KEY: fakeKey,
      SUPABASE_SERVICE_KEY: 'sb-secret-value',
    });
    const logger = createLogger({ secrets: config.secrets, sink });
    logger.error(`request to https://x?key=${fakeKey} failed`, {
      detail: 'sb-secret-value',
    });
    const output = JSON.stringify(sink.error.mock.calls);
    expect(output).not.toContain(fakeKey);
    expect(output).not.toContain('sb-secret-value');
  });
});

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      port: 8787,
      isProduction: false,
      corsOrigins: [],
      gemini: { model: 'gemini-2.5-flash' },
    });
    expect(config.gemini.apiKey).toBeUndefined();
    expect(config.supabase).toEqual({ url: undefined, key: undefined });
    expect(config.secrets).toEqual([]);
    expect(config.airQualityCache.freshMs).toBe(600_000);
  });
  it('parses and normalises provided values', () => {
    const config = loadConfig({
      PORT: '9000',
      NODE_ENV: 'production',
      CORS_ORIGIN: ' https://a.com/ ,https://b.com ',
      GEMINI_API_KEY: ' key ',
      GEMINI_MODEL: ' m ',
      SUPABASE_URL: 'https://x.supabase.co/',
      SUPABASE_SERVICE_KEY: ' s ',
      AQI_CACHE_TTL_MS: '5000',
    });
    expect(config).toMatchObject({
      port: 9000,
      isProduction: true,
      corsOrigins: ['https://a.com', 'https://b.com'],
      gemini: { apiKey: 'key', model: 'm' },
      supabase: { url: 'https://x.supabase.co', key: 's' },
      secrets: ['key', 's'],
    });
    expect(config.airQualityCache.freshMs).toBe(5000);
  });
  it.each([['abc'], ['-5'], ['0'], ['']])(
    'ignores an invalid number %j and uses defaults',
    (value) => {
      const config = loadConfig({ PORT: value, AQI_CACHE_TTL_MS: value });
      expect(config.port).toBe(8787);
      expect(config.airQualityCache.freshMs).toBe(600_000);
    },
  );
});
