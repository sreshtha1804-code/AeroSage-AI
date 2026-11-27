import { vi } from 'vitest';

const pad = (n) => String(n).padStart(2, '0');
const CATEGORY_LIMITS = [
  [50, 'Good'],
  [100, 'Satisfactory'],
  [200, 'Moderate'],
  [300, 'Poor'],
  [400, 'Very Poor'],
];
const categoryOf = (aqi) =>
  aqi === null ? 'Unavailable' : (CATEGORY_LIMITS.find(([limit]) => aqi <= limit)?.[1] ?? 'Severe');
const localStamp = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:00`;

/** AQI payload shaped like the server's /api/aqi response (city-local timestamps, no offset). */
export function makeAqi({
  aqi = 232,
  demo = false,
  name = 'Kolkata',
  admin = 'West Bengal',
  fetchedAt = new Date().toISOString(),
  stale = false,
  basis = 'full',
} = {}) {
  const start = Date.UTC(2026, 10, 21, 0, 0);
  const series = Array.from({ length: 96 }, (_, i) => ({
    t: localStamp(new Date(start + i * 36e5)),
    pm25: 100,
    pm10: 150,
    aqi: aqi === null ? null : aqi + (i % 24),
    future: i > 72,
  }));
  const missing = aqi === null;
  return {
    demo,
    stale,
    dataType: demo ? 'synthetic' : 'model',
    provider: demo ? 'Synthetic demo data' : 'Open-Meteo (CAMS model)',
    place: { name, admin, country: 'India', timezone: 'Asia/Kolkata' },
    current: {
      pm25: missing ? null : 100,
      pm10: missing ? null : 150,
      no2: 20,
      so2: 5,
      o3: 40,
      co: 300,
      aqi,
      category: categoryOf(aqi),
      dominantPollutant: missing ? null : 'pm25',
      dominantPollutantLabel: missing ? null : 'PM2.5',
      subIndices: missing ? {} : { pm25: aqi, pm10: 134, no2: 25, so2: 6, o3: 40, co: 15 },
      observedAt: series[72].t.replace(':00', ':15'),
      observedAtUtc: '2026-11-24T04:45:00.000Z',
    },
    units: { pm25: 'µg/m³', pm10: 'µg/m³', no2: 'µg/m³', so2: 'µg/m³', o3: 'µg/m³', co: 'µg/m³' },
    aqiMeta: {
      estimated: true,
      basis: missing ? 'unavailable' : basis,
      pollutantsUsed: missing ? 0 : 6,
      method: 'Estimated CPCB-style AQI: highest sub-index of the available pollutants.',
    },
    series,
    nowIndex: 72,
    source: 'Open-Meteo Air Quality API (CAMS atmospheric model, not a ground sensor).',
    fetchedAt,
  };
}

export const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

/**
 * Install a fetch mock that routes by URL substring. A handler may return a value (200 JSON),
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

export const countCalls = (fetchMock, fragment) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes(fragment)).length;
