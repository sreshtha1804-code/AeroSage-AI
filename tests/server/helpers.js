import { vi } from 'vitest';
import { createApp } from '../../server/app.js';

export const silentLogger = () => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
});
export const noSleep = () => Promise.resolve();

/** Minimal fetch Response stand-in. */
export const jsonResponse = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  json: async () => body,
});

export const FIELDS = {
  pm25: 'pm2_5',
  pm10: 'pm10',
  no2: 'nitrogen_dioxide',
  so2: 'sulphur_dioxide',
  o3: 'ozone',
  co: 'carbon_monoxide',
};

export const DEFAULT_VALUES = { pm25: 100, pm10: 150, no2: 20, so2: 5, o3: 40, co: 300 };

/**
 * Build an Open-Meteo style air-quality response. `values` holds one constant per pollutant (µg/m³);
 * pass `null` for a pollutant to make it entirely missing, or an array to supply an hourly series.
 */
export function airResponse({
  values = {},
  past = 4,
  future = 2,
  units = 'μg/m³',
  nowOffset = 10,
} = {}) {
  const merged = { ...DEFAULT_VALUES, ...values };
  const total = (past + future) * 24;
  const start = Date.UTC(2026, 10, 20 - past, 0, 0);
  const time = Array.from({ length: total }, (_, i) =>
    new Date(start + i * 36e5).toISOString().slice(0, 16),
  );
  const nowIndex = past * 24 + nowOffset;

  const hourly = { time };
  const current = { time: time[nowIndex].replace(/:00$/, ':15') };
  const hourlyUnits = {};
  const currentUnits = {};
  for (const [key, field] of Object.entries(FIELDS)) {
    const v = merged[key];
    hourly[field] = Array.isArray(v) ? v : time.map(() => v);
    current[field] = Array.isArray(v) ? v[nowIndex] : v;
    hourlyUnits[field] = typeof units === 'object' ? units[key] : units;
    currentUnits[field] = hourlyUnits[field];
  }
  return {
    timezone: 'Asia/Kolkata',
    utc_offset_seconds: 19800,
    current,
    current_units: currentUnits,
    hourly,
    hourly_units: hourlyUnits,
  };
}

export const geocodeOk = {
  results: [
    { name: 'Kolkata', admin1: 'West Bengal', country: 'India', latitude: 22.56, longitude: 88.36 },
  ],
};

/** Route a fetch mock by URL substring. */
export const routeFetch = (handlers) =>
  vi.fn(async (url, init) => {
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (String(url).includes(pattern)) return handler(url, init);
    }
    throw new Error(`Unexpected URL ${url}`);
  });

/** Start the app on an ephemeral port. `overrides` are merged with fast, deterministic test defaults. */
export async function startApp({ overrides = {}, ...options } = {}) {
  const app = createApp({
    logger: silentLogger(),
    serveStatic: false,
    env: {},
    overrides: { sleep: noSleep, random: () => 0, ...overrides },
    ...options,
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, init) => fetch(base + path, init);
  const post = (path, body) =>
    request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { base, request, post, close: () => new Promise((r) => server.close(r)) };
}
