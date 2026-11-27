/**
 * Concentration unit handling. CPCB reports gases such as CO in mg/m³, while Open-Meteo reports
 * every pollutant in µg/m³, so units must be read and converted explicitly, never assumed.
 */

/** Canonical key such as "ug/m3" from "μg/m³" (Greek mu), "µg/m³" (micro sign) or "ug/m3". */
export const normalizeUnit = (unit) =>
  typeof unit === 'string'
    ? unit.trim().toLowerCase().replace(/[µμ]/g, 'u').replace(/³/g, '3').replace(/\s+/g, '')
    : null;

const TO_MICROGRAMS = { 'ug/m3': 1, 'mg/m3': 1000 };

/** @returns {boolean} whether `unit` is a mass concentration we can convert. */
export const isSupportedUnit = (unit) => normalizeUnit(unit) in TO_MICROGRAMS;

/**
 * Convert a concentration to µg/m³. Returns null for missing values or unsupported units
 * (e.g. ppb), so a wrong unit can never silently produce a wrong AQI.
 */
export const toMicrogramsPerM3 = (value, unit) => {
  const factor = TO_MICROGRAMS[normalizeUnit(unit)];
  return factor === undefined || typeof value !== 'number' || !Number.isFinite(value)
    ? null
    : value * factor;
};

export const microgramsToMilligrams = (micrograms) => micrograms / 1000;
