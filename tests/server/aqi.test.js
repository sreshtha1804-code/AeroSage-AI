import { describe, expect, it } from 'vitest';
import {
  PM10_BREAKPOINTS,
  PM25_BREAKPOINTS,
  buildAqiSeries,
  categoryFor,
  computeAqi,
  findNowIndex,
  meanOf,
  subIndex,
  toNumber,
} from '../../server/aqi.js';

describe('toNumber', () => {
  it.each([
    [5, 5],
    ['7.5', 7.5],
    [0, 0],
  ])('accepts %s', (input, expected) => {
    expect(toNumber(input)).toBe(expected);
  });
  it.each([[null], [undefined], [''], ['  '], ['abc'], [NaN], [Infinity], [true], [{}], [[]]])(
    'rejects %s',
    (input) => expect(toNumber(input)).toBeNull(),
  );
});

describe('PM2.5 sub-index (CPCB breakpoints)', () => {
  it.each([
    [0, 0],
    [15, 25],
    [30, 50],
    [31, 51],
    [60, 100],
    [61, 101],
    [90, 200],
    [91, 201],
    [120, 300],
    [121, 301],
    [250, 400],
    [251, 401],
    [380, 500],
    [999, 500],
  ])('PM2.5 %s ug/m3 -> %s', (conc, expected) => {
    expect(subIndex(conc, PM25_BREAKPOINTS)).toBe(expected);
  });
  it('interpolates inside a band', () => {
    expect(subIndex(45, PM25_BREAKPOINTS)).toBe(75);
  });
});

describe('PM10 sub-index (CPCB breakpoints)', () => {
  it.each([
    [0, 0],
    [50, 50],
    [51, 51],
    [100, 100],
    [101, 101],
    [250, 200],
    [251, 201],
    [350, 300],
    [351, 301],
    [430, 400],
    [431, 401],
    [510, 500],
    [2000, 500],
  ])('PM10 %s ug/m3 -> %s', (conc, expected) => {
    expect(subIndex(conc, PM10_BREAKPOINTS)).toBe(expected);
  });
});

describe('invalid concentrations', () => {
  it.each([[null], [undefined], [''], ['x'], [-1], [NaN]])('%s gives null', (v) => {
    expect(subIndex(v, PM25_BREAKPOINTS)).toBeNull();
  });
});

describe('computeAqi', () => {
  it('uses the worst sub-index', () => {
    expect(computeAqi(15, 300)).toBe(subIndex(300, PM10_BREAKPOINTS));
    expect(computeAqi(200, 60)).toBe(subIndex(200, PM25_BREAKPOINTS));
  });
  it('uses the available pollutant when the other is missing', () => {
    expect(computeAqi(null, 100)).toBe(100);
    expect(computeAqi(60, undefined)).toBe(100);
  });
  it('returns null (never a made-up value) when both are missing', () => {
    expect(computeAqi(null, null)).toBeNull();
  });
});

describe('categoryFor', () => {
  it.each([
    [0, 'Good'],
    [50, 'Good'],
    [51, 'Satisfactory'],
    [100, 'Satisfactory'],
    [101, 'Moderate'],
    [200, 'Moderate'],
    [201, 'Poor'],
    [300, 'Poor'],
    [301, 'Very Poor'],
    [400, 'Very Poor'],
    [401, 'Severe'],
    [500, 'Severe'],
  ])('AQI %s -> %s', (aqi, cat) => expect(categoryFor(aqi)).toBe(cat));
  it('reports Unavailable for missing data', () => {
    expect(categoryFor(null)).toBe('Unavailable');
    expect(categoryFor(undefined)).toBe('Unavailable');
    expect(categoryFor(NaN)).toBe('Unavailable');
  });
});

describe('meanOf', () => {
  it('ignores invalid values and counts valid ones', () => {
    expect(meanOf([10, null, 20, 'x', undefined])).toEqual({ mean: 15, count: 2 });
  });
  it('handles all-invalid input', () => {
    expect(meanOf([null, undefined])).toEqual({ mean: null, count: 0 });
  });
});

describe('buildAqiSeries', () => {
  const hours = (n) =>
    Array.from({ length: n }, (_, i) => `2026-11-20T${String(i % 24).padStart(2, '0')}:00`);

  it('returns null until 16 valid hourly samples exist (CPCB rule)', () => {
    const time = hours(30);
    const series = buildAqiSeries(
      { time, pm2_5: time.map(() => 100), pm10: time.map(() => 150) },
      20,
    );
    expect(series[14].aqi).toBeNull();
    expect(series[15].aqi).not.toBeNull();
    expect(series[29].aqi).not.toBeNull();
  });

  it('averages the trailing 24 hours', () => {
    const time = hours(48);
    const pm = time.map((_, i) => (i < 24 ? 0 : 60));
    const series = buildAqiSeries({ time, pm2_5: pm, pm10: pm.map(() => null) }, 40);
    expect(series[23].pm25).toBe(0);
    expect(series[47].pm25).toBe(60);
    expect(series[35].pm25).toBe(30);
  });

  it('flags future hours and tolerates missing arrays', () => {
    const time = hours(20);
    const series = buildAqiSeries({ time }, 9);
    expect(series[9].future).toBe(false);
    expect(series[10].future).toBe(true);
    expect(series.every((s) => s.aqi === null)).toBe(true);
  });
});

describe('findNowIndex', () => {
  const times = ['2026-11-20T09:00', '2026-11-20T10:00', '2026-11-20T11:00'];
  it('matches the current hour', () => expect(findNowIndex(times, '2026-11-20T10:15')).toBe(1));
  it('falls back to the next slot', () => expect(findNowIndex(times, '2026-11-20T10:15Z')).toBe(1));
  it('defaults to 0 for missing or out-of-range time', () => {
    expect(findNowIndex(times, undefined)).toBe(0);
    expect(findNowIndex(times, '2030-01-01T00:00')).toBe(0);
  });
});
