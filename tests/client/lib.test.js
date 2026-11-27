import { afterEach, describe, expect, it } from 'vitest';
import {
  ADVICE,
  CATEGORIES,
  adviceTier,
  categoryLevel,
  describeTrend,
  findBestHours,
  formatHour,
  summarizeByDay,
  toTrendChartData,
} from '../../src/lib/aqi.js';
import { buildAssistantContext } from '../../src/lib/assistantContext.js';
import { toAssistantMessage, toHistory } from '../../src/lib/chatHistory.js';
import {
  MODES,
  applianceSavings,
  commuteSavings,
  defaultFactors,
  monthlyTravel,
  purifierCadr,
  reusableComparison,
} from '../../src/lib/impact.js';
import {
  ageMs,
  formatAge,
  formatChartLabel,
  formatClock,
  formatModelTime,
  hourOf,
} from '../../src/lib/time.js';
import { makeAqi } from './fixtures.js';

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('colour contrast (WCAG 2.2 AA)', () => {
  const cardBg = '#0f2038';
  const pageBg = '#0a1628';
  it.each(CATEGORIES.map((c) => [c.name, c.text]))(
    'category text colour for %s is >= 4.5:1',
    (_n, color) => {
      expect(contrast(color, cardBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, pageBg)).toBeGreaterThanOrEqual(4.5);
    },
  );
  it.each(CATEGORIES.map((c) => [c.name, c.fill]))(
    'category fill for %s is >= 3:1 against the card (graphics)',
    (_n, color) => {
      expect(contrast(color, cardBg)).toBeGreaterThanOrEqual(3);
    },
  );
  it('helper text, forecast line, buttons and input borders pass', () => {
    expect(contrast('#cbd5e1', cardBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#94a3b8', cardBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#fcd34d', cardBg)).toBeGreaterThanOrEqual(3);
    expect(contrast('#0a1628', '#2dd4bf')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#0a1628', '#34d399')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#94a3b8', pageBg)).toBeGreaterThanOrEqual(3);
  });
});

describe('categoryLevel / adviceTier', () => {
  it.each([
    [0, 0],
    [50, 0],
    [51, 1],
    [100, 1],
    [101, 2],
    [200, 2],
    [201, 3],
    [300, 3],
    [301, 4],
    [400, 4],
    [401, 5],
    [500, 5],
    [900, 5],
  ])('level(%s) = %s', (aqi, level) => expect(categoryLevel(aqi)).toBe(level));
  it('returns null for missing AQI instead of claiming "Good"', () => {
    for (const value of [null, undefined, NaN, '50']) expect(categoryLevel(value)).toBeNull();
  });
  it('groups levels into advice tiers and is cautious (1) when AQI is unknown', () => {
    expect([30, 80, 150, 250, 350, 450].map(adviceTier)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(adviceTier(null)).toBe(1);
  });
  it('has advice for every tier and audience', () => {
    for (const list of Object.values(ADVICE)) expect(list).toHaveLength(3);
  });
});

describe('time helpers (city-local timestamps are never shifted by the browser time zone)', () => {
  it('reads the hour from the text', () => {
    expect(hourOf('2026-11-24T05:00')).toBe(5);
    expect(hourOf('2026-11-24T23:15')).toBe(23);
  });
  it('formats model time and chart labels exactly as written, whatever the viewer time zone', () => {
    expect(formatModelTime('2026-11-24T14:15')).toMatch(/24 Nov.*2:15\s?pm/i);
    expect(formatChartLabel('2026-11-24T02:00')).toMatch(/24 Nov.*2\s?am/i);
    expect(formatModelTime('')).toBe('');
  });
  it.each([
    [0, 'just now'],
    [29_000, 'just now'],
    [60_000, '1 min ago'],
    [59 * 60_000, '59 min ago'],
    [60 * 60_000, '1 h ago'],
    [5 * 3_600_000, '5 h ago'],
    [24 * 3_600_000, '1 day ago'],
    [72 * 3_600_000, '3 days ago'],
    [-5000, 'just now'],
  ])('formatAge(%s) = %s', (ms, text) => expect(formatAge(ms)).toBe(text));
  it('computes age and handles unparseable timestamps', () => {
    expect(ageMs('2026-11-24T08:00:00.000Z', Date.parse('2026-11-24T08:05:00.000Z'))).toBe(300_000);
    expect(ageMs('garbage', 0)).toBe(Infinity);
    expect(formatClock('2026-11-24T08:05:00.000Z')).toMatch(/\d/);
  });
});

describe('city-local time handling is independent of the browser time zone', () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });
  const hourlySeries = Array.from({ length: 24 }, (_, i) => ({
    t: `2026-03-29T${String(i).padStart(2, '0')}:00`,
    aqi: 300 - i * 5,
  }));

  // 2026-03-29 is a DST change day in Europe: a classic source of off-by-one-hour bugs with new Date(text).
  it.each([
    'UTC',
    'Asia/Kolkata',
    'Pacific/Auckland',
    'America/Los_Angeles',
    'Europe/London',
    'Pacific/Kiritimati',
  ])('gives identical labels, hours and best hours in %s', (zone) => {
    process.env.TZ = zone;
    expect(hourOf('2026-03-29T01:00')).toBe(1);
    expect(formatModelTime('2026-03-29T01:15')).toMatch(/29 Mar.*1:15\s?am/i);
    expect(formatChartLabel('2026-03-29T01:00')).toMatch(/29 Mar.*1\s?am/i);
    const { next, best } = findBestHours(hourlySeries, 0);
    expect(next.map((point) => point.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(best).toEqual([19, 20, 21]);
  });
});

describe('findBestHours', () => {
  const series = Array.from({ length: 30 }, (_, i) => ({
    t: `2026-11-21T${String(i % 24).padStart(2, '0')}:00`,
    aqi: 300 - i * 5,
  }));
  it('chooses the three lowest daytime hours (sorted) within the next 24h and labels now vs forecast', () => {
    const { next, best } = findBestHours(series, 0);
    expect(next).toHaveLength(24);
    expect(best).toEqual([19, 20, 21]);
    expect(next[0].kind).toBe('now');
    expect(next[1].kind).toBe('forecast');
  });
  it('skips hours with no AQI and returns [] when none exist', () => {
    expect(
      findBestHours(
        series.map((s) => ({ ...s, aqi: null })),
        0,
      ).best,
    ).toEqual([]);
  });
  it('ignores night hours even if they are cleanest', () => {
    const night = Array.from({ length: 24 }, (_, i) => ({
      t: `2026-11-21T${String(i).padStart(2, '0')}:00`,
      aqi: i < 5 ? 10 : 200,
    }));
    expect(findBestHours(night, 0).best.every((h) => h >= 5)).toBe(true);
  });
});

describe('trend summaries and chart data', () => {
  it('groups by date with min/avg/max and flags days that include forecast', () => {
    const summary = summarizeByDay([
      { t: '2026-11-21T01:00', aqi: 100, future: false },
      { t: '2026-11-21T02:00', aqi: 200, future: false },
      { t: '2026-11-22T01:00', aqi: 350, future: true },
      { t: '2026-11-22T02:00', aqi: null, future: true },
    ]);
    expect(summary).toEqual([
      {
        date: '2026-11-21',
        min: 100,
        avg: 150,
        max: 200,
        category: 'Moderate',
        includesForecast: false,
      },
      {
        date: '2026-11-22',
        min: 350,
        avg: 350,
        max: 350,
        category: 'Very Poor',
        includesForecast: true,
      },
    ]);
  });
  it('describes the trend, including the empty case', () => {
    expect(describeTrend(summarizeByDay([{ t: '2026-11-21T01:00', aqi: 100 }]))).toMatch(
      /2026-11-21 100/,
    );
    expect(describeTrend([])).toMatch(/No AQI trend data/);
  });
  it('keeps estimates up to now apart from the forecast and joins them at the current hour', () => {
    const rows = toTrendChartData(
      [
        { t: '2026-11-21T01:00', aqi: 10 },
        { t: '2026-11-21T02:00', aqi: 20 },
        { t: '2026-11-21T03:00', aqi: 30 },
      ],
      1,
    );
    expect(rows.map((r) => r.observed)).toEqual([10, 20, null]);
    expect(rows.map((r) => r.forecast)).toEqual([null, 20, 30]);
    expect(rows[0].label).toMatch(/21 Nov/);
  });
  it('formats hours', () => {
    expect([0, 5, 12, 13, 21].map(formatHour)).toEqual(['12am', '5am', '12pm', '1pm', '9pm']);
  });
});

describe('assistant context', () => {
  it('contains only what the dashboard shows, including provenance flags and the cleanest hours', () => {
    const context = buildAssistantContext(makeAqi({ stale: true }));
    expect(context).toMatchObject({
      place: 'Kolkata',
      aqi: 232,
      category: 'Poor',
      dominantPollutant: 'PM2.5',
      pm25: 100,
      co: 300,
      stale: true,
      demo: false,
    });
    expect(context.bestHours).toHaveLength(3);
    const expectedKeys = [
      'aqi',
      'bestHours',
      'category',
      'co',
      'demo',
      'dominantPollutant',
      'no2',
      'o3',
      'observedAt',
      'pm10',
      'pm25',
      'place',
      'so2',
      'stale',
      'timestamp',
    ];
    expect(Object.keys(context).sort()).toEqual([...expectedKeys].sort());
  });
  it('is null without data', () => expect(buildAssistantContext(null)).toBeNull());
});

describe('chat history', () => {
  it('only sends genuine Gemini replies back as context', () => {
    expect(
      toHistory([
        { role: 'user', text: 'q1' },
        { role: 'ai', text: 'fb', source: 'fallback' },
        { role: 'user', text: 'q2' },
        { role: 'ai', text: 'real', source: 'gemini' },
        { role: 'ai', text: 'err', source: 'error' },
      ]),
    ).toEqual([
      { role: 'user', text: 'q1' },
      { role: 'user', text: 'q2' },
      { role: 'model', text: 'real' },
    ]);
  });
  it('labels replies by source, deriving it from the legacy ai flag when needed', () => {
    expect(toAssistantMessage({ text: 'a', source: 'gemini' })).toMatchObject({
      role: 'ai',
      source: 'gemini',
    });
    expect(toAssistantMessage({ text: 'a', ai: true }).source).toBe('gemini');
    expect(toAssistantMessage({ text: 'a', ai: false, note: 'n' })).toMatchObject({
      source: 'fallback',
      note: 'n',
    });
  });
});

describe('impact calculators', () => {
  it('computes monthly travel and non-negative savings', () => {
    const f = defaultFactors();
    const car = monthlyTravel(f.car, 15, 22);
    const metro = monthlyTravel(f.metro, 15, 22);
    expect(car.co2).toBeCloseTo(0.17 * 15 * 22);
    expect(commuteSavings(car, metro).cost).toBeCloseTo((9 - 1.5) * 15 * 22);
    expect(commuteSavings(metro, car)).toEqual({ co2: 0, cost: 0 });
    expect(Object.keys(MODES)).toEqual(['car', 'bike', 'bus', 'metro']);
  });
  it('sizes a purifier with the AHAM 2/3 rule', () => {
    expect(purifierCadr(12)).toEqual({ cfm: 87, m3h: 147 });
    expect(purifierCadr(-5).cfm).toBe(0);
  });
  it('compares reusable vs disposable and guards divide-by-zero', () => {
    expect(
      reusableComparison({
        disposableCost: 2,
        usesPerMonth: 60,
        reusablePrice: 300,
        reusableLifetime: 500,
      }),
    ).toEqual({ disposableMonthly: 120, reusableMonthly: 36, breakEvenUses: 150 });
    expect(
      reusableComparison({
        disposableCost: 0,
        usesPerMonth: 1,
        reusablePrice: 10,
        reusableLifetime: 0,
      }).breakEvenUses,
    ).toBeNull();
  });
  it('computes appliance savings and never goes negative', () => {
    const a = applianceSavings({
      conventionalW: 1500,
      efficientW: 900,
      hoursPerDay: 6,
      tariff: 8,
      extraPrice: 8000,
      gridFactor: 0.7,
    });
    expect(a.kwh).toBeCloseTo(108);
    expect(a.rupees).toBeCloseTo(864);
    expect(a.co2).toBeCloseTo(75.6);
    expect(a.paybackMonths).toBeCloseTo(8000 / 864);
    expect(
      applianceSavings({
        conventionalW: 500,
        efficientW: 900,
        hoursPerDay: 6,
        tariff: 8,
        extraPrice: 1,
        gridFactor: 0.7,
      }),
    ).toMatchObject({ kwh: 0, rupees: 0, paybackMonths: null });
  });
});
