import { AVERAGING } from '../constants.js';
import {
  buildAqiSeries,
  categoryFor,
  evaluateAqiAt,
  findNowIndex,
  POLLUTANT_LABELS,
} from './aqi.js';

export const AQI_METHOD =
  'Estimated CPCB-style AQI: highest sub-index of the available pollutants, using 24-hour means (PM2.5, PM10, NO₂, SO₂) ' +
  'and maximum 8-hour means (O₃, CO), requiring at least 16 valid hours. Not an official station-based AQI.';

export const SOURCE_TEXT =
  'Open-Meteo Air Quality API (CAMS atmospheric model, not a ground sensor). AQI is an estimate that follows CPCB breakpoints and averaging.';

/** Local model time ("2026-11-24T14:00") + UTC offset → absolute ISO timestamp. */
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export const toUtcIso = (localTime, utcOffsetSeconds) => {
  // Date.parse is lenient with malformed text, so the format is checked explicitly first.
  if (!Number.isFinite(utcOffsetSeconds) || !LOCAL_TIME.test(localTime)) {
    return null;
  }
  const asUtc = Date.parse(`${localTime.slice(0, 16)}:00Z`);
  return Number.isNaN(asUtc) ? null : new Date(asUtc - utcOffsetSeconds * 1000).toISOString();
};

/**
 * Build the /api/aqi response for a live lookup. Pure function: no I/O, no clock access except `fetchedAt`.
 * @param {object} location Validated geocoding result.
 * @param {ReturnType<import('./airQualityParser.js').parseAirQuality>} air
 * @param {Date} [now]
 */
export const buildAirQualityPayload = (location, air, now = new Date()) => {
  const fullNowIndex = findNowIndex(air.times, air.currentTime);
  // Drop the warm-up hours: they exist only so that every displayed hour has a full averaging window.
  const warmUp = Math.min(AVERAGING.warmUpHours, fullNowIndex);
  const series = buildAqiSeries(air.times, air.hourly, fullNowIndex).slice(warmUp);
  const nowIndex = fullNowIndex - warmUp;
  const evaluation = evaluateAqiAt(air.hourly, fullNowIndex);

  return {
    demo: false,
    stale: false,
    dataType: 'model',
    provider: 'Open-Meteo (CAMS model)',
    place: { ...location, timezone: air.timezone },
    current: {
      ...air.current,
      aqi: evaluation.aqi,
      category: categoryFor(evaluation.aqi),
      dominantPollutant: evaluation.dominant,
      dominantPollutantLabel: evaluation.dominant ? POLLUTANT_LABELS[evaluation.dominant] : null,
      subIndices: evaluation.subIndices,
      observedAt: air.currentTime,
      observedAtUtc: toUtcIso(air.currentTime, air.utcOffsetSeconds),
    },
    units: air.units,
    aqiMeta: {
      estimated: true,
      basis: evaluation.basis,
      pollutantsUsed: evaluation.pollutantsUsed,
      method: AQI_METHOD,
    },
    series,
    nowIndex,
    source: SOURCE_TEXT,
    fetchedAt: now.toISOString(),
  };
};
