// Indian AQI categories. `fill` is for shapes; `text` is a lighter variant that keeps
// at least 4.5:1 contrast against the dark card background (verified in tests).
export const CATS = [
  { name: 'Good', range: '0–50', fill: '#22c55e', text: '#22c55e' },
  { name: 'Satisfactory', range: '51–100', fill: '#84cc16', text: '#84cc16' },
  { name: 'Moderate', range: '101–200', fill: '#eab308', text: '#eab308' },
  { name: 'Poor', range: '201–300', fill: '#f97316', text: '#f97316' },
  { name: 'Very Poor', range: '301–400', fill: '#f87171', text: '#f87171' },
  { name: 'Severe', range: '401–500', fill: '#d946ef', text: '#e879f9' },
];

export const UNKNOWN_FILL = '#64748b';

/** Category index 0–5, or null when AQI is missing. */
export const lvl = (aqi) => {
  if (aqi === null || aqi === undefined || !Number.isFinite(aqi)) return null;
  if (aqi <= 50) return 0;
  if (aqi <= 100) return 1;
  if (aqi <= 200) return 2;
  if (aqi <= 300) return 3;
  if (aqi <= 400) return 4;
  return 5;
};

/** Advice tier: 0 low, 1 moderate, 2 high. Missing AQI is treated cautiously (tier 1). */
export const tier = (aqi) => {
  const level = lvl(aqi);
  if (level === null) return 1;
  return level <= 1 ? 0 : level <= 3 ? 1 : 2;
};

export const EXPLAIN = [
  'Minimal impact expected.',
  'Sensitive people may notice minor discomfort.',
  'Breathing discomfort possible for people with lung/heart conditions, children and older adults.',
  'Prolonged exposure may cause discomfort for most people.',
  'Respiratory illness risk on prolonged exposure; avoid outdoor exertion.',
  'Affects healthy people and seriously impacts those with existing conditions. Minimise outdoor exposure.',
];

export const ADV = {
  general: [
    'Enjoy outdoor time; ventilate freely.',
    'Reduce long heavy workouts outdoors if you feel irritation; ventilate for 10–15 min in the cleanest hours.',
    'Keep windows shut in peak hours, run a purifier, wear a fitted N95/FFP2 outdoors, avoid outdoor exercise.',
  ],
  child: [
    'Normal outdoor play is fine.',
    'Shorten intense outdoor play; prefer morning/late-afternoon cleaner windows.',
    'Move PE/play indoors, use child-sized masks only if properly fitted, keep indoor air clean where they sleep.',
  ],
  elderly: [
    'Regular walks are fine.',
    'Walk in the cleanest window; keep prescribed medicines handy.',
    'Stay indoors, avoid exertion outdoors, check in at least twice a day.',
  ],
  worker: [
    'Normal work; stay hydrated.',
    'Take breaks in cleaner spots; consider a mask during dusty tasks.',
    'Use a fitted N95/FFP2, shorten continuous exposure, rotate duties, schedule heavy work in the cleanest hours.',
  ],
};

export const fmtHour = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

/** The three lowest-AQI daytime hours (5am–9pm) in the next 24 hours; hours with no AQI are skipped. */
export const bestHours = (series, nowIndex) => {
  const next = series
    .slice(nowIndex, nowIndex + 24)
    .map((s) => ({ ...s, h: new Date(s.t).getHours() }));
  const best = next
    .filter((s) => s.h >= 5 && s.h <= 21 && s.aqi != null)
    .sort((a, b) => a.aqi - b.aqi)
    .slice(0, 3)
    .map((s) => s.h)
    .sort((a, b) => a - b);
  return { next, best };
};

/** One row per calendar day: min / average / max AQI. Used as the chart's text alternative. */
export const dailySummary = (series) => {
  const days = new Map();
  for (const point of series) {
    if (point.aqi == null) continue;
    const key = point.t.slice(0, 10);
    const day = days.get(key) ?? { date: key, values: [], future: false };
    day.values.push(point.aqi);
    day.future = day.future || point.future;
    days.set(key, day);
  }
  return [...days.values()].map(({ date, values, future }) => {
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const max = Math.max(...values);
    return { date, min: Math.min(...values), avg, max, category: CATS[lvl(avg)].name, future };
  });
};

export const sentenceForChart = (summary) =>
  summary.length
    ? `AQI trend from ${summary[0].date} to ${summary.at(-1).date}. ` +
      `Daily averages: ${summary.map((d) => `${d.date} ${d.avg}`).join(', ')}.`
    : 'No AQI trend data is available.';
