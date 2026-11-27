import { categoryFor, combineSubIndices, pollutantSubIndex, POLLUTANT_LABELS } from './aqi.js';

const HOURS_BEFORE = 72;
const HOURS_AFTER = 24;
const MS_PER_HOUR = 3_600_000;

const estimateAqi = (pm25, pm10) =>
  combineSubIndices({
    pm25: pollutantSubIndex('pm25', pm25),
    pm10: pollutantSubIndex('pm10', pm10),
  });

/** Synthetic demo data. Always labelled as such; never mixed with live readings. */
export function buildDemoData(city, now = new Date()) {
  const base = new Date(now);
  base.setMinutes(0, 0, 0);

  const series = [];
  for (let offset = -HOURS_BEFORE; offset <= HOURS_AFTER; offset++) {
    const time = new Date(base.getTime() + offset * MS_PER_HOUR);
    const dailyCycle = Math.cos(((time.getUTCHours() - 7) / 24) * 2 * Math.PI);
    const jitter = (((offset % 7) + 7) % 7) * 4;
    const pm25 = Math.round(150 + 70 * dailyCycle + jitter);
    const pm10 = Math.round(pm25 * 1.6);
    series.push({
      t: time.toISOString().slice(0, 16),
      pm25,
      pm10,
      aqi: estimateAqi(pm25, pm10).aqi,
      future: offset > 0,
    });
  }

  const nowIndex = HOURS_BEFORE;
  const { pm25, pm10, aqi } = series[nowIndex];
  const evaluation = estimateAqi(pm25, pm10);

  return {
    demo: true,
    stale: false,
    dataType: 'synthetic',
    provider: 'Synthetic demo data',
    place: { name: city || 'Demo City', country: 'Synthetic data', timezone: 'UTC' },
    current: {
      pm25,
      pm10,
      no2: 48,
      so2: 12,
      o3: 30,
      co: 900,
      aqi,
      category: categoryFor(aqi),
      dominantPollutant: evaluation.dominant,
      dominantPollutantLabel: POLLUTANT_LABELS[evaluation.dominant],
      subIndices: {},
      observedAt: series[nowIndex].t,
      observedAtUtc: `${series[nowIndex].t}:00.000Z`,
    },
    units: { pm25: 'µg/m³', pm10: 'µg/m³', no2: 'µg/m³', so2: 'µg/m³', o3: 'µg/m³', co: 'µg/m³' },
    aqiMeta: {
      estimated: true,
      basis: 'synthetic',
      pollutantsUsed: 2,
      method: 'Synthetic values for demonstration only.',
    },
    series,
    nowIndex,
    source: 'DEMO MODE - synthetic values, NOT real measurements',
    fetchedAt: new Date().toISOString(),
  };
}
