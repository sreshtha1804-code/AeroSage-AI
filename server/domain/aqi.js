// Estimated Indian AQI (CPCB National AQI methodology).
//
// What is implemented:
//  - sub-indices for PM2.5, PM10, NO2, SO2, O3 and CO using the CPCB breakpoints;
//  - CPCB averaging: 24-hour means (PM2.5, PM10, NO2, SO2) and the maximum 8-hour running
//    mean within 24 hours (O3, CO);
//  - the "at least 16 valid hourly values" data-coverage rule;
//  - overall AQI = highest sub-index, reported only when a particulate (PM) sub-index exists.
//
// What is NOT possible here: CPCB also uses NH3 and Pb, and official AQIs come from monitoring
// stations. Our inputs are CAMS model values, so every result is an ESTIMATE and is labelled as such.

import { AVERAGING } from '../constants.js';
import { microgramsToMilligrams } from './units.js';

/** Pollutant keys used throughout the application. */
export const POLLUTANTS = Object.freeze(['pm25', 'pm10', 'no2', 'so2', 'o3', 'co']);

export const POLLUTANT_LABELS = Object.freeze({
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  so2: 'SO₂',
  o3: 'O₃',
  co: 'CO',
});

// [concentration low, concentration high, index low, index high]. CO is in mg/m³, others in µg/m³.
// The last band is open-ended in CPCB's table ("> X"); its upper end follows the width of the
// previous band (this reproduces the PM2.5 = 380 and PM10 = 510 caps) and results are capped at 500.
export const BREAKPOINTS = Object.freeze({
  pm25: [
    [0, 30, 0, 50],
    [31, 60, 51, 100],
    [61, 90, 101, 200],
    [91, 120, 201, 300],
    [121, 250, 301, 400],
    [251, 380, 401, 500],
  ],
  pm10: [
    [0, 50, 0, 50],
    [51, 100, 51, 100],
    [101, 250, 101, 200],
    [251, 350, 201, 300],
    [351, 430, 301, 400],
    [431, 510, 401, 500],
  ],
  no2: [
    [0, 40, 0, 50],
    [41, 80, 51, 100],
    [81, 180, 101, 200],
    [181, 280, 201, 300],
    [281, 400, 301, 400],
    [401, 520, 401, 500],
  ],
  so2: [
    [0, 40, 0, 50],
    [41, 80, 51, 100],
    [81, 380, 101, 200],
    [381, 800, 201, 300],
    [801, 1600, 301, 400],
    [1601, 2400, 401, 500],
  ],
  o3: [
    [0, 50, 0, 50],
    [51, 100, 51, 100],
    [101, 168, 101, 200],
    [169, 208, 201, 300],
    [209, 748, 301, 400],
    [749, 1287, 401, 500],
  ],
  co: [
    [0, 1, 0, 50],
    [1.1, 2, 51, 100],
    [2.1, 10, 101, 200],
    [10.1, 17, 201, 300],
    [17.1, 34, 301, 400],
    [34.1, 51, 401, 500],
  ],
});

const EIGHT_HOUR_POLLUTANTS = new Set(['o3', 'co']);
const PARTICULATES = ['pm25', 'pm10'];
export const MIN_POLLUTANTS_FOR_FULL_AQI = 3;

export const CATEGORIES = Object.freeze([
  'Good',
  'Satisfactory',
  'Moderate',
  'Poor',
  'Very Poor',
  'Severe',
]);

/** Convert to a finite number, or null for missing/invalid input. */
export const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** Linear-interpolated sub-index for one concentration; capped at the last band (500). */
export const subIndex = (concentration, table) => {
  const value = toNumber(concentration);
  if (value === null || value < 0) {
    return null;
  }

  const band = table.find((row) => value <= row[1]) ?? table[table.length - 1];
  const [low, high, indexLow, indexHigh] = band;
  const clamped = Math.max(low, Math.min(value, high));
  return Math.round(((indexHigh - indexLow) / (high - low)) * (clamped - low) + indexLow);
};

export const categoryFor = (aqi) => {
  if (!Number.isFinite(aqi)) {
    return 'Unavailable';
  }
  if (aqi <= 50) {
    return 'Good';
  }
  if (aqi <= 100) {
    return 'Satisfactory';
  }
  if (aqi <= 200) {
    return 'Moderate';
  }
  if (aqi <= 300) {
    return 'Poor';
  }
  if (aqi <= 400) {
    return 'Very Poor';
  }
  return 'Severe';
};

/** Mean of the valid numbers in `values` and how many were valid. */
export const meanOf = (values) => {
  const valid = values.map(toNumber).filter((value) => value !== null);
  return valid.length
    ? { mean: valid.reduce((sum, value) => sum + value, 0) / valid.length, count: valid.length }
    : { mean: null, count: 0 };
};

const windowEndingAt = (values, endIndex, size) =>
  values.slice(Math.max(0, endIndex - size + 1), endIndex + 1);

/**
 * CPCB 24-hour representative concentration (µg/m³) for the window ending at `endIndex`.
 * Null unless at least `dailyMinSamples` of the 24 hourly values are valid.
 */
export const dailyMean = (values, endIndex) => {
  const { mean, count } = meanOf(windowEndingAt(values, endIndex, AVERAGING.dailyWindowHours));
  return count >= AVERAGING.dailyMinSamples ? mean : null;
};

/**
 * CPCB 8-hour representative concentration (µg/m³): the highest 8-hour running mean (each needing
 * enough valid values) within the 24 hours ending at `endIndex`; null when 24-hour coverage is too low.
 */
export const maxEightHourMean = (values, endIndex) => {
  const day = windowEndingAt(values, endIndex, AVERAGING.dailyWindowHours);
  if (meanOf(day).count < AVERAGING.dailyMinSamples) {
    return null;
  }

  let best = null;
  for (let end = Math.max(0, endIndex - AVERAGING.dailyWindowHours + 1); end <= endIndex; end++) {
    const { mean, count } = meanOf(windowEndingAt(values, end, AVERAGING.eightHourWindow));
    if (count >= AVERAGING.eightHourMinSamples && (best === null || mean > best)) {
      best = mean;
    }
  }
  return best;
};

/** Representative concentration (µg/m³) for `pollutant` at `endIndex`, following its CPCB averaging rule. */
export const representativeConcentration = (pollutant, values, endIndex) =>
  EIGHT_HOUR_POLLUTANTS.has(pollutant)
    ? maxEightHourMean(values, endIndex)
    : dailyMean(values, endIndex);

/** Sub-index for one pollutant, converting CO to mg/m³ as CPCB requires. */
export const pollutantSubIndex = (pollutant, micrograms) => {
  const value = toNumber(micrograms);
  if (value === null) {
    return null;
  }
  return subIndex(
    pollutant === 'co' ? microgramsToMilligrams(value) : value,
    BREAKPOINTS[pollutant],
  );
};

/**
 * Combine sub-indices into the overall estimate.
 * @param {Partial<Record<string, number|null>>} subIndices
 * @returns {{ aqi: number|null, dominant: string|null, pollutantsUsed: number, basis: 'full'|'partial'|'unavailable' }}
 *   `full`: at least three pollutants including a PM. `partial`: a PM plus fewer than three pollutants.
 */
export const combineSubIndices = (subIndices) => {
  const available = POLLUTANTS.filter((key) => Number.isFinite(subIndices[key]));
  const hasParticulate = available.some((key) => PARTICULATES.includes(key));
  if (!hasParticulate) {
    return { aqi: null, dominant: null, pollutantsUsed: available.length, basis: 'unavailable' };
  }

  const dominant = available.reduce((top, key) => (subIndices[key] > subIndices[top] ? key : top));
  return {
    aqi: subIndices[dominant],
    dominant,
    pollutantsUsed: available.length,
    basis: available.length >= MIN_POLLUTANTS_FOR_FULL_AQI ? 'full' : 'partial',
  };
};

/**
 * Estimated AQI for the hour at `index`.
 * @param {Record<string, Array<number|null>>} hourly Hourly concentrations in µg/m³ keyed by pollutant.
 */
export const evaluateAqiAt = (hourly, index) => {
  const subIndices = {};
  for (const pollutant of POLLUTANTS) {
    const concentration = representativeConcentration(pollutant, hourly[pollutant] ?? [], index);
    subIndices[pollutant] =
      concentration === null ? null : pollutantSubIndex(pollutant, concentration);
  }
  return { subIndices, ...combineSubIndices(subIndices) };
};

/** Hourly series of estimated AQI values. Hours after `nowIndex` are flagged as forecast. */
export const buildAqiSeries = (times, hourly, nowIndex) =>
  times.map((time, index) => {
    const { aqi } = evaluateAqiAt(hourly, index);
    const round = (pollutant) => {
      const mean = dailyMean(hourly[pollutant] ?? [], index);
      return mean === null ? null : Math.round(mean);
    };
    return { t: time, pm25: round('pm25'), pm10: round('pm10'), aqi, future: index > nowIndex };
  });

/** Index of the hourly slot that matches the provider's "current" timestamp. */
export const findNowIndex = (times, currentTime) => {
  if (typeof currentTime !== 'string') {
    return 0;
  }
  const exact = times.indexOf(`${currentTime.slice(0, 13)}:00`);
  if (exact >= 0) {
    return exact;
  }
  const next = times.findIndex((time) => time >= currentTime);
  return next >= 0 ? next : 0;
};
