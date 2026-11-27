import { describe, expect, it } from 'vitest';
import {
  BREAKPOINTS,
  buildAqiSeries,
  categoryFor,
  combineSubIndices,
  dailyMean,
  evaluateAqiAt,
  findNowIndex,
  maxEightHourMean,
  meanOf,
  pollutantSubIndex,
  representativeConcentration,
  subIndex,
  toNumber,
} from '../../../server/domain/aqi.js';

describe('toNumber / meanOf', () => {
  it.each([
    [5, 5],
    ['7.5', 7.5],
    [0, 0],
  ])('accepts %s', (input, expected) => expect(toNumber(input)).toBe(expected));
  it.each([[null], [undefined], [''], ['  '], ['abc'], [NaN], [Infinity], [true], [{}], [[]]])(
    'rejects %s',
    (input) => expect(toNumber(input)).toBeNull(),
  );
  it('meanOf ignores invalid values and counts valid ones', () => {
    expect(meanOf([10, null, 20, 'x', undefined])).toEqual({ mean: 15, count: 2 });
    expect(meanOf([null])).toEqual({ mean: null, count: 0 });
  });
});

// Literal values from the CPCB National AQI table (band edges), not derived from the code under test.
describe('CPCB breakpoints: sub-index at every band edge', () => {
  const cases = {
    pm25: [
      [0, 0],
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
    ],
    pm10: [
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
    ],
    no2: [
      [0, 0],
      [40, 50],
      [41, 51],
      [80, 100],
      [81, 101],
      [180, 200],
      [181, 201],
      [280, 300],
      [281, 301],
      [400, 400],
      [401, 401],
      [520, 500],
      [5000, 500],
    ],
    so2: [
      [0, 0],
      [40, 50],
      [41, 51],
      [80, 100],
      [81, 101],
      [380, 200],
      [381, 201],
      [800, 300],
      [801, 301],
      [1600, 400],
      [1601, 401],
      [2400, 500],
      [9000, 500],
    ],
    o3: [
      [0, 0],
      [50, 50],
      [51, 51],
      [100, 100],
      [101, 101],
      [168, 200],
      [169, 201],
      [208, 300],
      [209, 301],
      [748, 400],
      [749, 401],
      [1287, 500],
      [5000, 500],
    ],
    co: [
      [0, 0],
      [1, 50],
      [1.1, 51],
      [2, 100],
      [2.1, 101],
      [10, 200],
      [10.1, 201],
      [17, 300],
      [17.1, 301],
      [34, 400],
      [34.1, 401],
      [51, 500],
      [200, 500],
    ],
  };
  for (const [pollutant, rows] of Object.entries(cases)) {
    it.each(rows)(`${pollutant} ${'%s'} -> %s`, (concentration, expected) => {
      expect(subIndex(concentration, BREAKPOINTS[pollutant])).toBe(expected);
    });
  }
  it('interpolates inside a band (PM2.5 45 -> 75)', () =>
    expect(subIndex(45, BREAKPOINTS.pm25)).toBe(75));
  it('rounds to the nearest integer (PM2.5 100 -> 231.7 -> 232)', () =>
    expect(subIndex(100, BREAKPOINTS.pm25)).toBe(232));
  it.each([[null], [undefined], [''], ['x'], [-1], [NaN]])(
    'invalid concentration %s -> null',
    (v) => expect(subIndex(v, BREAKPOINTS.pm25)).toBeNull(),
  );
});

describe('CO unit handling (CPCB uses mg/m³, provider gives µg/m³)', () => {
  it.each([
    [1000, 50],
    [2000, 100],
    [10000, 200],
    [17000, 300],
    [34000, 400],
  ])('%s µg/m³ -> sub-index %s', (ug, idx) => expect(pollutantSubIndex('co', ug)).toBe(idx));
  it('would be wrong without conversion: 1000 µg/m³ is 1 mg/m³, not 1000 mg/m³', () => {
    expect(pollutantSubIndex('co', 1000)).toBe(50);
    expect(subIndex(1000, BREAKPOINTS.co)).toBe(500);
  });
  it('does not convert other pollutants', () => expect(pollutantSubIndex('pm25', 100)).toBe(232));
  it('returns null for missing input', () => expect(pollutantSubIndex('pm25', null)).toBeNull());
});

describe('averaging rules and data coverage', () => {
  const day = (fill) => Array.from({ length: 24 }, (_, i) => fill(i));

  it('24-hour mean requires at least 16 valid hourly values', () => {
    const sixteenValid = day((i) => (i < 16 ? 60 : null));
    const fifteenValid = day((i) => (i < 15 ? 60 : null));
    expect(dailyMean(sixteenValid, 23)).toBe(60);
    expect(dailyMean(fifteenValid, 23)).toBeNull();
  });

  it('uses only the trailing 24 hours', () => {
    const values = [...Array(24).fill(1000), ...Array(24).fill(10)];
    expect(dailyMean(values, 47)).toBe(10);
    expect(dailyMean(values, 35)).toBeCloseTo((12 * 1000 + 12 * 10) / 24);
  });

  it('8-hour maximum picks the highest running mean in 24 hours', () => {
    const values = day((i) => (i >= 12 && i < 20 ? 200 : 50));
    expect(maxEightHourMean(values, 23)).toBe(200);
  });

  it('8-hour windows need 6 valid of 8 values', () => {
    const sparse = day((i) =>
      i >= 12 && i < 20 && i % 2 === 0 ? 400 : i >= 12 && i < 20 ? null : 50,
    );
    // the high window has only 4 valid values -> ignored; best valid window is lower
    expect(maxEightHourMean(sparse, 23)).toBeLessThan(400);
  });

  it('8-hour maximum is null when 24-hour coverage is below 16 values', () => {
    expect(
      maxEightHourMean(
        day((i) => (i < 10 ? 100 : null)),
        23,
      ),
    ).toBeNull();
  });

  it('representativeConcentration dispatches by pollutant', () => {
    const values = day((i) => (i >= 12 && i < 20 ? 200 : 50));
    expect(representativeConcentration('o3', values, 23)).toBe(200);
    expect(representativeConcentration('no2', values, 23)).toBeCloseTo((8 * 200 + 16 * 50) / 24);
  });
});

describe('combineSubIndices (overall AQI)', () => {
  it('uses the highest sub-index and names the dominant pollutant', () => {
    expect(combineSubIndices({ pm25: 120, pm10: 90, no2: 60 })).toEqual({
      aqi: 120,
      dominant: 'pm25',
      pollutantsUsed: 3,
      basis: 'full',
    });
    expect(combineSubIndices({ pm25: 80, o3: 150, no2: 60 })).toMatchObject({
      aqi: 150,
      dominant: 'o3',
    });
  });
  it('is "full" with >= 3 pollutants including a PM, "partial" otherwise', () => {
    expect(combineSubIndices({ pm25: 80, pm10: 70 }).basis).toBe('partial');
    expect(combineSubIndices({ pm10: 70, so2: 10, co: 20 }).basis).toBe('full');
  });
  it('gives NO AQI without a particulate sub-index, even if gases exist', () => {
    expect(combineSubIndices({ no2: 300, so2: 200, o3: 100, co: 90 })).toEqual({
      aqi: null,
      dominant: null,
      pollutantsUsed: 4,
      basis: 'unavailable',
    });
    expect(combineSubIndices({}).aqi).toBeNull();
  });
  it('ignores null/invalid sub-indices and resolves ties to the first pollutant', () => {
    expect(combineSubIndices({ pm25: null, pm10: 100, no2: NaN })).toMatchObject({
      aqi: 100,
      dominant: 'pm10',
      pollutantsUsed: 1,
    });
    expect(combineSubIndices({ pm25: 100, pm10: 100 }).dominant).toBe('pm25');
  });
});

describe('evaluateAqiAt', () => {
  const constant = (value, n = 48) => Array(n).fill(value);
  const hourly = {
    pm25: constant(100),
    pm10: constant(150),
    no2: constant(20),
    so2: constant(5),
    o3: constant(40),
    co: constant(300),
  };

  it('computes all six sub-indices and the overall estimate', () => {
    const result = evaluateAqiAt(hourly, 40);
    expect(result.subIndices).toEqual({ pm25: 232, pm10: 134, no2: 25, so2: 6, o3: 40, co: 15 });
    expect(result).toMatchObject({ aqi: 232, dominant: 'pm25', pollutantsUsed: 6, basis: 'full' });
  });

  it('uses the ozone 8-hour maximum, and lets ozone dominate only when it is the worst pollutant', () => {
    const spike = (value) => constant(40).map((v, i) => (i >= 30 && i < 40 ? value : v));
    const moderate = evaluateAqiAt({ ...hourly, o3: spike(150) }, 40); // 8-h max 150 -> sub-index 173 < 232
    expect(moderate.subIndices.o3).toBe(173);
    expect(moderate.dominant).toBe('pm25');
    const high = evaluateAqiAt({ ...hourly, o3: spike(300) }, 40); // 8-h max 300 -> sub-index 318 > 232
    expect(high.subIndices.o3).toBe(318);
    expect(high).toMatchObject({ aqi: 318, dominant: 'o3' });
  });

  it('degrades gracefully with missing pollutants and missing arrays', () => {
    const result = evaluateAqiAt({ pm25: constant(100) }, 40);
    expect(result).toMatchObject({ aqi: 232, basis: 'partial', pollutantsUsed: 1 });
    expect(evaluateAqiAt({}, 40)).toMatchObject({ aqi: null, basis: 'unavailable' });
  });
});

describe('buildAqiSeries', () => {
  const times = Array.from(
    { length: 48 },
    (_, i) => `2026-11-20T${String(i % 24).padStart(2, '0')}:00`,
  );
  const hourly = { pm25: Array(48).fill(100), pm10: Array(48).fill(null) };

  it('stays null until 16 hourly values exist, then reports (CPCB coverage rule)', () => {
    const series = buildAqiSeries(times, hourly, 30);
    expect(series[14].aqi).toBeNull();
    expect(series[15].aqi).toBe(232);
    expect(series[15].pm25).toBe(100);
    expect(series[15].pm10).toBeNull();
  });

  it('flags hours after the current index as forecast', () => {
    const series = buildAqiSeries(times, hourly, 30);
    expect(series[30].future).toBe(false);
    expect(series[31].future).toBe(true);
  });
});

describe('findNowIndex / categoryFor', () => {
  const times = ['2026-11-20T09:00', '2026-11-20T10:00', '2026-11-20T11:00'];
  it('matches the current hour, the next slot, and defaults sensibly', () => {
    expect(findNowIndex(times, '2026-11-20T10:15')).toBe(1);
    expect(findNowIndex(times, '2026-11-20T10:15Z')).toBe(1);
    expect(findNowIndex(times, '2026-11-20T09:00')).toBe(0);
    expect(findNowIndex(times, undefined)).toBe(0);
    expect(findNowIndex(times, '2030-01-01T00:00')).toBe(0);
  });
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
  ])('AQI %s -> %s', (aqi, name) => expect(categoryFor(aqi)).toBe(name));
  it.each([[null], [undefined], [NaN]])('%s -> Unavailable', (v) =>
    expect(categoryFor(v)).toBe('Unavailable'),
  );
});
