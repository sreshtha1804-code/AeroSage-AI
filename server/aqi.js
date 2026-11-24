// Indian AQI helpers (CPCB-style breakpoints for PM2.5 and PM10).
// Only PM2.5 and PM10 are used; NO2/SO2/O3/CO sub-indices are NOT computed,
// so the result is an approximation of the official AQI.

// [concLow, concHigh, indexLow, indexHigh]
export const PM25_BREAKPOINTS = [
  [0, 30, 0, 50],
  [31, 60, 51, 100],
  [61, 90, 101, 200],
  [91, 120, 201, 300],
  [121, 250, 301, 400],
  [251, 380, 401, 500],
];

export const PM10_BREAKPOINTS = [
  [0, 50, 0, 50],
  [51, 100, 51, 100],
  [101, 250, 101, 200],
  [251, 350, 201, 300],
  [351, 430, 301, 400],
  [431, 510, 401, 500],
];

export const CATEGORIES = ['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe'];

/** Convert a value to a finite number, or null for missing/invalid input. */
export const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** Linear-interpolated sub-index for one pollutant. Result is capped at 500. */
export const subIndex = (concentration, table) => {
  const value = toNumber(concentration);
  if (value === null || value < 0) return null;

  const range = table.find((row) => value <= row[1]) ?? table[table.length - 1];
  const [low, high, indexLow, indexHigh] = range;
  const clamped = Math.max(low, Math.min(value, high));

  return Math.round(((indexHigh - indexLow) / (high - low)) * (clamped - low) + indexLow);
};

/** Arithmetic mean of the valid numbers in `values`, plus how many were valid. */
export const meanOf = (values) => {
  const valid = values.map(toNumber).filter((v) => v !== null);
  if (!valid.length) return { mean: null, count: 0 };
  return { mean: valid.reduce((sum, v) => sum + v, 0) / valid.length, count: valid.length };
};

/** Overall AQI = the worst available sub-index. Null when neither pollutant is usable. */
export const computeAqi = (pm25, pm10) => {
  const indices = [subIndex(pm25, PM25_BREAKPOINTS), subIndex(pm10, PM10_BREAKPOINTS)].filter(
    (v) => v !== null,
  );
  return indices.length ? Math.max(...indices) : null;
};

export const categoryFor = (aqi) => {
  if (aqi === null || aqi === undefined || !Number.isFinite(aqi)) return 'Unavailable';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
};

/** CPCB requires at least 16 valid hourly values for a 24-hour average. */
export const MIN_SAMPLES_FOR_24H = 16;

/**
 * Build the hourly AQI series using a trailing 24-hour average of PM2.5 / PM10.
 * Hours with fewer than MIN_SAMPLES_FOR_24H valid samples get null (never invented).
 */
export const buildAqiSeries = (hourly, nowIndex) => {
  const pm25Series = Array.isArray(hourly.pm2_5) ? hourly.pm2_5 : [];
  const pm10Series = Array.isArray(hourly.pm10) ? hourly.pm10 : [];

  return hourly.time.map((time, index) => {
    const start = Math.max(0, index - 23);
    const a = meanOf(pm25Series.slice(start, index + 1));
    const b = meanOf(pm10Series.slice(start, index + 1));
    const pm25 = a.count >= MIN_SAMPLES_FOR_24H ? a.mean : null;
    const pm10 = b.count >= MIN_SAMPLES_FOR_24H ? b.mean : null;

    return {
      t: time,
      pm25: pm25 === null ? null : Math.round(pm25),
      pm10: pm10 === null ? null : Math.round(pm10),
      aqi: computeAqi(pm25, pm10),
      future: index > nowIndex,
    };
  });
};

/** Index of the hourly slot that matches the "current" timestamp. */
export const findNowIndex = (hourlyTimes, currentTime) => {
  if (typeof currentTime !== 'string') return 0;
  const exact = hourlyTimes.indexOf(`${currentTime.slice(0, 13)}:00`);
  if (exact >= 0) return exact;
  const next = hourlyTimes.findIndex((t) => t >= currentTime);
  return next >= 0 ? next : 0;
};
