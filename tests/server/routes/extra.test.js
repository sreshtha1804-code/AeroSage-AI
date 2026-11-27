import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAqiSeries } from '../../../server/domain/aqi.js';
import { parseAirQuality } from '../../../server/domain/airQualityParser.js';
import { createLogger } from '../../../server/logger.js';
import { createAqiRouter } from '../../../server/routes/aqi.js';
import { withRetry } from '../../../server/utils/retry.js';
import { airResponse, silentLogger, startApp } from '../helpers.js';

let app;
afterEach(async () => app && (await app.close()));

describe('single-host deployment: serving the built frontend', () => {
  const makeDist = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aerosage-dist-'));
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<!doctype html><title>AeroSage</title><div id="root"></div>',
    );
    fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log("app")');
    return dir;
  };

  it('serves index.html, assets and client-side routes, but JSON for unknown API paths', async () => {
    const staticDir = makeDist();
    app = await startApp({ serveStatic: true, staticDir });
    expect(await (await app.request('/')).text()).toMatch(/<div id="root">/);
    expect(await (await app.request('/assets/app.js')).text()).toBe('console.log("app")');
    expect(await (await app.request('/some/client/route')).text()).toMatch(
      /<title>AeroSage<\/title>/,
    );
    const missing = await app.request('/api/does-not-exist');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Not found.' });
    expect((await app.request('/api/health')).status).toBe(200);
    fs.rmSync(staticDir, { recursive: true });
  });

  it('falls back to the JSON root when the build directory does not exist', async () => {
    app = await startApp({
      serveStatic: true,
      staticDir: path.join(os.tmpdir(), 'no-such-dir-aerosage'),
    });
    expect(await (await app.request('/')).json()).toMatchObject({ name: 'AeroSage API' });
  });
});

describe('aqi route: unexpected failures', () => {
  it('returns the same safe 502 and logs the (non-upstream) error', async () => {
    const logger = silentLogger();
    const probe = express();
    probe.use(
      '/aqi',
      createAqiRouter({
        airQualityService: {
          getAirQuality: vi.fn(async () => {
            throw new TypeError('internal detail');
          }),
        },
        logger,
      }),
    );
    const server = await new Promise((resolve) => {
      const s = probe.listen(0, '127.0.0.1', () => resolve(s));
    });
    const res = await fetch(`http://127.0.0.1:${server.address().port}/aqi?city=Pune`);
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain('internal detail');
    expect(logger.error).toHaveBeenCalledWith('[AQI] unexpected error', {
      message: 'internal detail',
    });
    await new Promise((resolve) => server.close(resolve));
  });
});

describe('withRetry guards', () => {
  it('always makes at least one attempt, even with maxAttempts 0', async () => {
    const attempt = vi.fn(async () => ({ ok: false }));
    const result = await withRetry(attempt, {
      maxAttempts: 0,
      baseDelayMs: 1,
      maxDelayMs: 1,
      shouldRetry: () => true,
    });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false });
  });
});

describe('edge cases in domain helpers', () => {
  it('buildAqiSeries tolerates a provider that sent no pollutant arrays', () => {
    const series = buildAqiSeries(['2026-11-20T00:00', '2026-11-20T01:00'], {}, 0);
    expect(series).toEqual([
      { t: '2026-11-20T00:00', pm25: null, pm10: null, aqi: null, future: false },
      { t: '2026-11-20T01:00', pm25: null, pm10: null, aqi: null, future: true },
    ]);
  });

  it('a non-string unit is reported as "unsupported (unknown)" and its data is not used', () => {
    const raw = airResponse();
    raw.current_units.nitrogen_dioxide = 5;
    raw.hourly_units.nitrogen_dioxide = 5;
    const parsed = parseAirQuality(raw);
    expect(parsed.units.no2).toBe('unsupported (unknown)');
    expect(parsed.current.no2).toBeNull();
  });

  it('the logger ignores empty/undefined secrets instead of corrupting messages', () => {
    const sink = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };
    createLogger({ sink, secrets: [undefined, '', 'real-secret'] }).error(
      'keep this, drop real-secret',
    );
    expect(sink.error).toHaveBeenCalledWith('keep this, drop [REDACTED]');
  });
});
