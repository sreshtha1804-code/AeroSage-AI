import { vi } from 'vitest';

/** AQI payload shaped like the server's /api/aqi response. */
export function makeAqi({ aqi = 232, demo = false, name = 'Kolkata', admin = 'West Bengal' } = {}) {
  const start = new Date('2026-11-21T00:00:00');
  const series = Array.from({ length: 96 }, (_, i) => {
    const t = new Date(start.getTime() + i * 36e5);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      t: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:00`,
      pm25: 100,
      pm10: 150,
      aqi: aqi === null ? null : aqi + (i % 24),
      future: i > 72,
    };
  });
  return {
    demo,
    place: { name, admin, country: 'India' },
    current: {
      pm25: aqi === null ? null : 100,
      pm10: aqi === null ? null : 150,
      no2: 20,
      so2: 5,
      o3: 40,
      co: 300,
      aqi,
      category: aqi === null ? 'Unavailable' : aqi > 200 ? 'Poor' : 'Satisfactory',
    },
    series,
    nowIndex: 72,
    source: 'Open-Meteo Air Quality API (CAMS atmospheric model, not a ground sensor).',
    fetchedAt: '2026-11-24T08:00:00.000Z',
  };
}

export const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

/**
 * Install a fetch mock that routes by URL substring. Handlers may return a value (200 JSON),
 * a `json()` response, or throw.
 */
export function mockFetch(routes) {
  const fn = vi.fn(async (url, init) => {
    for (const [pattern, handler] of Object.entries(routes)) {
      if (String(url).includes(pattern)) {
        const out = typeof handler === 'function' ? await handler(url, init) : handler;
        return out && 'ok' in out ? out : json(out);
      }
    }
    return json({ error: `unmocked ${url}` }, 500);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
