import { UpstreamError } from '../errors.js';
import { isSupportedUnit, normalizeUnit, toMicrogramsPerM3 } from './units.js';

/** Open-Meteo field name for each pollutant key used inside the application. */
export const PROVIDER_FIELDS = Object.freeze({
  pm25: 'pm2_5',
  pm10: 'pm10',
  no2: 'nitrogen_dioxide',
  so2: 'sulphur_dioxide',
  o3: 'ozone',
  co: 'carbon_monoxide',
});

/** Unit documented by Open-Meteo, used only when the response omits a unit for a field. */
const DOCUMENTED_UNIT = 'μg/m³';
const NORMALIZED_UNIT_LABEL = 'µg/m³';
const HOURLY_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const invalid = (message) => new UpstreamError('invalid_response', message);

/** Validate a geocoding hit and return only the fields we use. */
export const parseLocation = (raw) => {
  const { latitude, longitude, name } = raw ?? {};
  const validCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  if (!validCoordinates || typeof name !== 'string' || !name) {
    throw invalid('Geocoding result is invalid.');
  }
  return {
    name,
    admin: typeof raw.admin1 === 'string' ? raw.admin1 : undefined,
    country: typeof raw.country === 'string' ? raw.country : undefined,
    latitude,
    longitude,
  };
};

/** Convert one provider series to µg/m³ numbers (invalid, negative or unsupported values become null). */
const toSeries = (values, unit, length) => {
  if (!Array.isArray(values) || values.length !== length || !isSupportedUnit(unit)) {
    return Array.from({ length }, () => null);
  }
  return values.map((value) => {
    const micrograms = toMicrogramsPerM3(value, unit);
    return micrograms === null || micrograms < 0 ? null : micrograms;
  });
};

/** A single current value in µg/m³, or null when missing, negative or in an unsupported unit. */
const toCurrentValue = (value, unit) => {
  const micrograms = toMicrogramsPerM3(value, unit);
  return micrograms !== null && micrograms >= 0 ? micrograms : null;
};

const assertValidStructure = (raw) => {
  const times = raw?.hourly?.time;
  const wellFormed =
    Array.isArray(times) &&
    times.length > 0 &&
    times.every((t) => typeof t === 'string' && HOURLY_TIME.test(t));
  if (!wellFormed) {
    throw invalid('Hourly timestamps are missing or malformed.');
  }
  if (typeof raw.current?.time !== 'string') {
    throw invalid('Current conditions are missing.');
  }
};

/** Hourly series, current values and display unit for every pollutant. */
const parsePollutants = (raw, length) => {
  const hourly = {};
  const current = {};
  const units = {};
  for (const [key, field] of Object.entries(PROVIDER_FIELDS)) {
    const hourlyUnit = raw.hourly_units?.[field] ?? DOCUMENTED_UNIT;
    const currentUnit = raw.current_units?.[field] ?? DOCUMENTED_UNIT;
    hourly[key] = toSeries(raw.hourly[field], hourlyUnit, length);
    current[key] = toCurrentValue(raw.current[field], currentUnit);
    units[key] = isSupportedUnit(currentUnit)
      ? NORMALIZED_UNIT_LABEL
      : `unsupported (${normalizeUnit(currentUnit) ?? 'unknown'})`;
  }
  return { hourly, current, units };
};

const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);

/**
 * Validate an Open-Meteo air-quality response and normalise it.
 * @returns {{ times: string[], hourly: Record<string, Array<number|null>>, current: Record<string, number|null>,
 *   currentTime: string, timezone: string|null, utcOffsetSeconds: number|null, units: Record<string, string> }}
 * @throws {UpstreamError} with code `invalid_response` when the structure cannot be trusted.
 */
export const parseAirQuality = (raw) => {
  assertValidStructure(raw);
  const times = raw.hourly.time;
  return {
    times,
    ...parsePollutants(raw, times.length),
    currentTime: raw.current.time,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : null,
    utcOffsetSeconds: finiteOrNull(raw.utc_offset_seconds),
  };
};
