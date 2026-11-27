import { BEST_HOURS_COUNT, FORECAST_WINDOW_HOURS, OUTDOOR_HOURS } from '../constants.js';
import { formatChartLabel, hourOf } from './time.js';

/**
 * Indian AQI categories. `fill` is for shapes; `text` is a lighter variant that keeps at least
 * 4.5:1 contrast against the dark card background (verified in tests).
 */
export const CATEGORIES = [
  { name: 'Good', range: '0–50', fill: '#22c55e', text: '#22c55e' },
  { name: 'Satisfactory', range: '51–100', fill: '#84cc16', text: '#84cc16' },
  { name: 'Moderate', range: '101–200', fill: '#eab308', text: '#eab308' },
  { name: 'Poor', range: '201–300', fill: '#f97316', text: '#f97316' },
  { name: 'Very Poor', range: '301–400', fill: '#f87171', text: '#f87171' },
  { name: 'Severe', range: '401–500', fill: '#d946ef', text: '#e879f9' },
];

export const UNKNOWN_FILL = '#64748b';

/** Upper AQI limit of each category, in order. */
const CATEGORY_LIMITS = [50, 100, 200, 300, 400];

/** Category index 0–5, or null when the AQI is missing. */
export const categoryLevel = (aqi) => {
  if (!Number.isFinite(aqi)) {
    return null;
  }
  const index = CATEGORY_LIMITS.findIndex((limit) => aqi <= limit);
  return index === -1 ? CATEGORIES.length - 1 : index;
};

/** Advice tier: 0 low, 1 moderate, 2 high. A missing AQI is treated cautiously (tier 1). */
export const adviceTier = (aqi) => {
  const level = categoryLevel(aqi);
  if (level === null) {
    return 1;
  }
  if (level <= 1) {
    return 0;
  }
  return level <= 3 ? 1 : 2;
};

export const CATEGORY_EXPLANATIONS = [
  'Minimal impact expected.',
  'Sensitive people may notice minor discomfort.',
  'Breathing discomfort possible for people with lung/heart conditions, children and older adults.',
  'Prolonged exposure may cause discomfort for most people.',
  'Respiratory illness risk on prolonged exposure; avoid outdoor exertion.',
  'Affects healthy people and seriously impacts those with existing conditions. Minimise outdoor exposure.',
];

export const ADVICE = {
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

export const formatHour = (hour) => `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;

/**
 * The cleanest daytime hours in the next 24 hours (forecast values; hours without an AQI are skipped).
 * Hours are read from the city-local timestamp text, never from the browser's time zone.
 */
export const findBestHours = (series, nowIndex) => {
  const next = series.slice(nowIndex, nowIndex + FORECAST_WINDOW_HOURS).map((point, offset) => ({
    ...point,
    hour: hourOf(point.t),
    kind: offset === 0 ? 'now' : 'forecast',
  }));
  const best = next
    .filter(
      (point) =>
        point.hour >= OUTDOOR_HOURS.from && point.hour <= OUTDOOR_HOURS.to && point.aqi != null,
    )
    .sort((a, b) => a.aqi - b.aqi)
    .slice(0, BEST_HOURS_COUNT)
    .map((point) => point.hour)
    .sort((a, b) => a - b);
  return { next, best };
};

/** One row per calendar day with the lowest, average and highest AQI: the chart's text alternative. */
export const summarizeByDay = (series) => {
  const days = new Map();
  for (const point of series) {
    if (point.aqi == null) {
      continue;
    }
    const date = point.t.slice(0, 10);
    const day = days.get(date) ?? { date, values: [], includesForecast: false };
    day.values.push(point.aqi);
    day.includesForecast ||= point.future;
    days.set(date, day);
  }
  return [...days.values()].map(({ date, values, includesForecast }) => {
    const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    return {
      date,
      min: Math.min(...values),
      avg: average,
      max: Math.max(...values),
      category: CATEGORIES[categoryLevel(average)].name,
      includesForecast,
    };
  });
};

export const describeTrend = (summary) =>
  summary.length
    ? `AQI trend from ${summary[0].date} to ${summary.at(-1).date}. ` +
      `Daily averages: ${summary.map((day) => `${day.date} ${day.avg}`).join(', ')}.`
    : 'No AQI trend data is available.';

/**
 * Chart rows that keep model estimates for past/current hours (`observed`) apart from predictions
 * (`forecast`). The current hour is in both so the lines join; forecasts are never drawn as measurements.
 */
export const toTrendChartData = (series, nowIndex) =>
  series.map((point, index) => ({
    ...point,
    label: formatChartLabel(point.t),
    observed: index <= nowIndex ? point.aqi : null,
    forecast: index >= nowIndex ? point.aqi : null,
  }));
