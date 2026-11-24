import { describe, expect, it } from 'vitest';
import {
  ADV,
  CATS,
  bestHours,
  dailySummary,
  fmtHour,
  lvl,
  sentenceForChart,
  tier,
} from '../../src/lib/aqi.js';
import {
  MODES,
  applianceSavings,
  commuteSavings,
  defaultFactors,
  monthlyTravel,
  purifierCadr,
  reusableComparison,
} from '../../src/lib/impact.js';

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
  it.each(CATS.map((c) => [c.name, c.text]))(
    'category text colour for %s is >= 4.5:1',
    (_n, color) => {
      expect(contrast(color, cardBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, pageBg)).toBeGreaterThanOrEqual(4.5);
    },
  );
  it.each(CATS.map((c) => [c.name, c.fill]))(
    'category fill for %s is >= 3:1 against the card (graphics)',
    (_n, color) => {
      expect(contrast(color, cardBg)).toBeGreaterThanOrEqual(3);
    },
  );
  it('body helper text (slate-300 #cbd5e1) and button text pass', () => {
    expect(contrast('#cbd5e1', cardBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#94a3b8', cardBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#0a1628', '#2dd4bf')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#0a1628', '#34d399')).toBeGreaterThanOrEqual(4.5);
  });
  it('input border (slate-400) meets 3:1 for UI components', () => {
    expect(contrast('#94a3b8', pageBg)).toBeGreaterThanOrEqual(3);
  });
});

describe('lvl / tier', () => {
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
  ])('lvl(%s) = %s', (aqi, level) => expect(lvl(aqi)).toBe(level));
  it('returns null for missing AQI instead of claiming "Good"', () => {
    expect(lvl(null)).toBeNull();
    expect(lvl(undefined)).toBeNull();
    expect(lvl(NaN)).toBeNull();
  });
  it('tier groups levels and is cautious (1) when AQI is unknown', () => {
    expect([tier(30), tier(80), tier(150), tier(250), tier(350), tier(450)]).toEqual([
      0, 0, 1, 1, 2, 2,
    ]);
    expect(tier(null)).toBe(1);
  });
  it('has advice for every tier and persona', () => {
    for (const list of Object.values(ADV)) expect(list).toHaveLength(3);
    expect(CATS).toHaveLength(6);
  });
});

describe('fmtHour', () => {
  it.each([
    [0, '12am'],
    [5, '5am'],
    [12, '12pm'],
    [13, '1pm'],
    [21, '9pm'],
  ])('%s -> %s', (h, s) => expect(fmtHour(h)).toBe(s));
});

describe('bestHours', () => {
  const series = Array.from({ length: 30 }, (_, i) => ({
    t: `2026-11-21T${String(i % 24).padStart(2, '0')}:00:00`,
    aqi: 300 - i * 5,
  }));
  it('chooses the three lowest daytime hours, sorted, within the next 24h', () => {
    const { next, best } = bestHours(series, 0);
    expect(next).toHaveLength(24);
    expect(best).toEqual([19, 20, 21]);
  });
  it('skips hours with no AQI and returns [] when none exist', () => {
    const blank = series.map((s) => ({ ...s, aqi: null }));
    expect(bestHours(blank, 0).best).toEqual([]);
  });
});

describe('dailySummary', () => {
  it('groups by date with min/avg/max and flags forecast days', () => {
    const s = dailySummary([
      { t: '2026-11-21T01:00', aqi: 100, future: false },
      { t: '2026-11-21T02:00', aqi: 200, future: false },
      { t: '2026-11-22T01:00', aqi: 350, future: true },
      { t: '2026-11-22T02:00', aqi: null, future: true },
    ]);
    expect(s).toEqual([
      { date: '2026-11-21', min: 100, avg: 150, max: 200, category: 'Moderate', future: false },
      { date: '2026-11-22', min: 350, avg: 350, max: 350, category: 'Very Poor', future: true },
    ]);
  });
  it('produces a readable chart description, including the empty case', () => {
    expect(sentenceForChart(dailySummary([{ t: '2026-11-21T01:00', aqi: 100 }]))).toMatch(
      /2026-11-21 100/,
    );
    expect(sentenceForChart([])).toMatch(/No AQI trend data/);
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
    const r = reusableComparison({
      disposableCost: 2,
      usesPerMonth: 60,
      reusablePrice: 300,
      reusableLifetime: 500,
    });
    expect(r).toEqual({ disposableMonthly: 120, reusableMonthly: 36, breakEvenUses: 150 });
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
    const worse = applianceSavings({
      conventionalW: 500,
      efficientW: 900,
      hoursPerDay: 6,
      tariff: 8,
      extraPrice: 1,
      gridFactor: 0.7,
    });
    expect(worse).toMatchObject({ kwh: 0, rupees: 0, paybackMonths: null });
  });
});
