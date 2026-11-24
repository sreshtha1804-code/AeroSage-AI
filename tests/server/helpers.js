import { vi } from 'vitest';
import { createApp } from '../../server/app.js';

export const silentLogger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
export const noSleep = () => Promise.resolve();

/** Minimal fetch Response stand-in. */
export const jsonResponse = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
});

/** Start the app on an ephemeral port; returns helpers and a close function. */
export async function startApp(options = {}) {
  const app = createApp({
    logger: silentLogger,
    sleep: noSleep,
    serveStatic: false,
    env: {},
    ...options,
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  // Always use the real fetch for talking to our own server.
  const request = (path, init) => fetch(base + path, init);
  const post = (path, body) =>
    request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { base, request, post, close: () => new Promise((r) => server.close(r)) };
}

export const geocodeOk = {
  results: [
    { name: 'Kolkata', admin1: 'West Bengal', country: 'India', latitude: 22.56, longitude: 88.36 },
  ],
};

/** Build an Open-Meteo style air-quality response with constant PM values. */
export function airResponse({ pm25 = 100, pm10 = 150, past = 4, future = 2 } = {}) {
  const total = (past + future) * 24;
  const start = Date.UTC(2026, 10, 20 - past, 0, 0);
  const time = Array.from({ length: total }, (_, i) =>
    new Date(start + i * 36e5).toISOString().slice(0, 16),
  );
  const nowIdx = past * 24 + 10;
  return {
    current: {
      time: time[nowIdx].replace(/:00$/, ':15'),
      pm2_5: pm25,
      pm10,
      nitrogen_dioxide: 20,
      sulphur_dioxide: 5,
      ozone: 40,
      carbon_monoxide: 300,
    },
    hourly: { time, pm2_5: time.map(() => pm25), pm10: time.map(() => pm10) },
  };
}
