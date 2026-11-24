import { computeAqi, categoryFor } from './aqi.js';

/** Synthetic demo data. Always labelled as such; never mixed with live readings. */
export function buildDemoData(city, now = new Date()) {
  const base = new Date(now);
  base.setMinutes(0, 0, 0);

  const series = [];
  for (let i = -72; i <= 24; i++) {
    const time = new Date(base.getTime() + i * 36e5);
    const hour = time.getHours();
    const pm25 = Math.round(
      150 + 70 * Math.cos(((hour - 7) / 24) * 2 * Math.PI) + (((i % 7) + 7) % 7) * 4,
    );
    const pm10 = Math.round(pm25 * 1.6);
    series.push({ t: time.toISOString(), pm25, pm10, aqi: computeAqi(pm25, pm10), future: i > 0 });
  }

  const nowIndex = 72;
  const current = series[nowIndex];

  return {
    demo: true,
    place: { name: city || 'Demo City', country: 'Synthetic data' },
    current: {
      pm25: current.pm25,
      pm10: current.pm10,
      no2: 48,
      so2: 12,
      o3: 30,
      co: 900,
      aqi: current.aqi,
      category: categoryFor(current.aqi),
    },
    series,
    nowIndex,
    source: 'DEMO MODE - synthetic values, NOT real measurements',
    fetchedAt: new Date().toISOString(),
  };
}
