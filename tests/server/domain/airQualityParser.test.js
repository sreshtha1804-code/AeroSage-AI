import { describe, expect, it } from 'vitest';
import { parseAirQuality, parseLocation } from '../../../server/domain/airQualityParser.js';
import { airResponse } from '../helpers.js';

describe('parseLocation', () => {
  it('keeps only the fields we use', () => {
    expect(
      parseLocation({
        name: 'Kolkata',
        admin1: 'West Bengal',
        country: 'India',
        latitude: 22.56,
        longitude: 88.36,
        population: 1,
      }),
    ).toEqual({
      name: 'Kolkata',
      admin: 'West Bengal',
      country: 'India',
      latitude: 22.56,
      longitude: 88.36,
    });
  });
  it.each([
    [{ name: 'X', latitude: 91, longitude: 0 }],
    [{ name: 'X', latitude: 0, longitude: 181 }],
    [{ name: 'X', latitude: '22', longitude: 88 }],
    [{ name: 'X', latitude: NaN, longitude: 88 }],
    [{ name: '', latitude: 1, longitude: 1 }],
    [{ latitude: 1, longitude: 1 }],
    [null],
  ])('rejects invalid coordinates or names: %j', (hit) => {
    expect(() => parseLocation(hit)).toThrow(/Geocoding result is invalid/);
  });
  it('accepts boundary coordinates (poles, antimeridian)', () => {
    expect(() => parseLocation({ name: 'Pole', latitude: -90, longitude: 180 })).not.toThrow();
  });
});

describe('parseAirQuality', () => {
  it('normalises a valid response to µg/m³ keyed by pollutant', () => {
    const parsed = parseAirQuality(airResponse());
    expect(parsed.times).toHaveLength(144);
    expect(parsed.current).toEqual({ pm25: 100, pm10: 150, no2: 20, so2: 5, o3: 40, co: 300 });
    expect(parsed.hourly.pm25).toHaveLength(144);
    expect(parsed.timezone).toBe('Asia/Kolkata');
    expect(parsed.utcOffsetSeconds).toBe(19800);
    expect(parsed.units.co).toBe('µg/m³');
  });

  it('converts mg/m³ responses to µg/m³ (unit handling)', () => {
    const parsed = parseAirQuality(
      airResponse({
        units: {
          pm25: 'μg/m³',
          pm10: 'μg/m³',
          no2: 'μg/m³',
          so2: 'μg/m³',
          o3: 'μg/m³',
          co: 'mg/m³',
        },
        values: { co: 0.3 },
      }),
    );
    expect(parsed.current.co).toBeCloseTo(300);
    expect(parsed.hourly.co[0]).toBeCloseTo(300);
  });

  it('treats unsupported units as unusable rather than guessing', () => {
    const parsed = parseAirQuality(
      airResponse({
        units: { pm25: 'μg/m³', pm10: 'μg/m³', no2: 'ppb', so2: 'μg/m³', o3: 'μg/m³', co: 'μg/m³' },
      }),
    );
    expect(parsed.current.no2).toBeNull();
    expect(parsed.hourly.no2.every((v) => v === null)).toBe(true);
    expect(parsed.units.no2).toMatch(/unsupported \(ppb\)/);
  });

  it('assumes the documented unit only when the response omits units', () => {
    const raw = airResponse();
    delete raw.current_units;
    delete raw.hourly_units;
    expect(parseAirQuality(raw).current.pm25).toBe(100);
  });

  it('turns negative, non-numeric and missing values into null', () => {
    const times = airResponse().hourly.time.length;
    const pm25 = Array.from({ length: times }, (_, i) =>
      i === 0 ? -5 : i === 1 ? 'x' : i === 2 ? null : 10,
    );
    const parsed = parseAirQuality(airResponse({ values: { pm25 } }));
    expect(parsed.hourly.pm25.slice(0, 4)).toEqual([null, null, null, 10]);
    const raw = airResponse();
    raw.current.pm2_5 = -1;
    raw.current.pm10 = undefined;
    const bad = parseAirQuality(raw);
    expect(bad.current.pm25).toBeNull();
    expect(bad.current.pm10).toBeNull();
  });

  it('nulls a series whose length does not match the timestamps', () => {
    const raw = airResponse();
    raw.hourly.ozone = raw.hourly.ozone.slice(0, 10);
    expect(parseAirQuality(raw).hourly.o3.every((v) => v === null)).toBe(true);
  });

  it.each([
    [
      'no hourly block',
      (r) => {
        delete r.hourly;
      },
    ],
    [
      'empty timestamps',
      (r) => {
        r.hourly.time = [];
      },
    ],
    [
      'malformed timestamp',
      (r) => {
        r.hourly.time[3] = 'yesterday';
      },
    ],
    [
      'non-string timestamp',
      (r) => {
        r.hourly.time[0] = 5;
      },
    ],
    [
      'no current block',
      (r) => {
        delete r.current;
      },
    ],
    [
      'current without time',
      (r) => {
        delete r.current.time;
      },
    ],
  ])('throws invalid_response for %s', (_label, mutate) => {
    const raw = airResponse();
    mutate(raw);
    expect(() => parseAirQuality(raw)).toThrow(
      expect.objectContaining({ name: 'UpstreamError', code: 'invalid_response' }),
    );
  });

  it('tolerates a missing timezone', () => {
    const raw = airResponse();
    delete raw.timezone;
    delete raw.utc_offset_seconds;
    const parsed = parseAirQuality(raw);
    expect(parsed.timezone).toBeNull();
    expect(parsed.utcOffsetSeconds).toBeNull();
  });
});
