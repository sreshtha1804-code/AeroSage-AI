import { describe, expect, it } from 'vitest';
import { parseAirQuality } from '../../../server/domain/airQualityParser.js';
import { buildAirQualityPayload, toUtcIso } from '../../../server/domain/airQualityPayload.js';
import { buildDemoData } from '../../../server/domain/demo.js';
import { airResponse } from '../helpers.js';

const location = {
  name: 'Kolkata',
  admin: 'West Bengal',
  country: 'India',
  latitude: 22.56,
  longitude: 88.36,
};
const NOW = new Date('2026-11-24T08:00:00.000Z');

describe('toUtcIso', () => {
  it('converts local model time to UTC using the offset', () => {
    expect(toUtcIso('2026-11-24T14:00', 19800)).toBe('2026-11-24T08:30:00.000Z');
    expect(toUtcIso('2026-11-24T02:00', -28800)).toBe('2026-11-24T10:00:00.000Z');
  });
  it('returns null without an offset or with unparseable input', () => {
    expect(toUtcIso('2026-11-24T14:00', null)).toBeNull();
    expect(toUtcIso('garbage', 0)).toBeNull();
    expect(toUtcIso('2026-13-45T99:99', 0)).toBeNull();
  });
});

describe('buildAirQualityPayload', () => {
  const payload = buildAirQualityPayload(location, parseAirQuality(airResponse()), NOW);

  it('labels data as model-based and the AQI as an estimate, with provenance', () => {
    expect(payload).toMatchObject({
      demo: false,
      stale: false,
      dataType: 'model',
      provider: 'Open-Meteo (CAMS model)',
      fetchedAt: NOW.toISOString(),
    });
    expect(payload.aqiMeta).toMatchObject({ estimated: true, basis: 'full', pollutantsUsed: 6 });
    expect(payload.aqiMeta.method).toMatch(/Not an official station-based AQI/);
    expect(payload.source).toMatch(/not a ground sensor/);
    expect(payload.place).toMatchObject({
      name: 'Kolkata',
      timezone: 'Asia/Kolkata',
      latitude: 22.56,
    });
  });

  it('reports the CPCB-style estimate, dominant pollutant and all sub-indices', () => {
    expect(payload.current).toMatchObject({
      aqi: 232,
      category: 'Poor',
      dominantPollutant: 'pm25',
      dominantPollutantLabel: 'PM2.5',
      subIndices: { pm25: 232, pm10: 134, no2: 25, so2: 6, o3: 40, co: 15 },
    });
    expect(payload.units.pm25).toBe('µg/m³');
  });

  it('exposes the model timestamp both as local time and absolute UTC', () => {
    expect(payload.current.observedAt).toBe('2026-11-20T10:15');
    expect(payload.current.observedAtUtc).toBe('2026-11-20T04:45:00.000Z'); // 10:15 at UTC+05:30
  });

  it('drops the warm-up day, marks forecast hours, and keeps nowIndex consistent', () => {
    expect(payload.series).toHaveLength(120);
    // The provider timestamp is 10:15; its hourly slot is the containing hour.
    expect(payload.series[payload.nowIndex].t).toBe('2026-11-20T10:00');
    expect(payload.series[payload.nowIndex].future).toBe(false);
    expect(payload.series[payload.nowIndex + 1].future).toBe(true);
    expect(payload.series[0].aqi).toBe(232); // first displayed hour already has a full 24 h window
  });

  it('yields Unavailable (never an invented value) when no particulate data exists', () => {
    const noPm = parseAirQuality(airResponse({ values: { pm25: null, pm10: null } }));
    const result = buildAirQualityPayload(location, noPm, NOW);
    expect(result.current.aqi).toBeNull();
    expect(result.current.category).toBe('Unavailable');
    expect(result.current.dominantPollutant).toBeNull();
    expect(result.aqiMeta.basis).toBe('unavailable');
  });

  it('is partial when only particulates are available', () => {
    const pmOnly = parseAirQuality(
      airResponse({ values: { no2: null, so2: null, o3: null, co: null } }),
    );
    expect(buildAirQualityPayload(location, pmOnly, NOW).aqiMeta).toMatchObject({
      basis: 'partial',
      pollutantsUsed: 2,
    });
  });

  it('copes with a current time near the start of the data (small warm-up)', () => {
    const early = parseAirQuality(airResponse({ past: 1, future: 1, nowOffset: 3 }));
    const result = buildAirQualityPayload(location, early, NOW);
    expect(result.series[result.nowIndex].t).toBe('2026-11-20T03:00');
  });
});

describe('buildDemoData', () => {
  const demo = buildDemoData('Delhi', new Date('2026-11-24T08:20:00'));
  it('is explicitly synthetic everywhere', () => {
    expect(demo).toMatchObject({
      demo: true,
      dataType: 'synthetic',
      provider: 'Synthetic demo data',
    });
    expect(demo.source).toMatch(/DEMO MODE/);
    expect(demo.aqiMeta.basis).toBe('synthetic');
    expect(demo.place).toEqual({ name: 'Delhi', country: 'Synthetic data', timezone: 'UTC' });
  });
  it('has a consistent 97-hour series with forecast hours flagged', () => {
    expect(demo.series).toHaveLength(97);
    expect(demo.series[demo.nowIndex].aqi).toBe(demo.current.aqi);
    expect(demo.series.filter((s) => s.future)).toHaveLength(24);
    expect(demo.current.dominantPollutantLabel).toMatch(/PM/);
  });
  it('uses the same city-local timestamp format as live data, and a consistent UTC instant', () => {
    expect(demo.series.every((point) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(point.t))).toBe(
      true,
    );
    expect(demo.current.observedAt).toBe(demo.series[demo.nowIndex].t);
    expect(demo.current.observedAtUtc).toBe(`${demo.current.observedAt}:00.000Z`);
    expect(demo.place.timezone).toBe('UTC');
  });
  it('falls back to a default city name', () => {
    expect(buildDemoData('').place.name).toBe('Demo City');
  });
});
