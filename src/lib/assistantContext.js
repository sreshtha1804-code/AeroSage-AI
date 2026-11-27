import { findBestHours } from './aqi.js';

/**
 * The air-quality facts sent to the assistant. Only what the user can see on screen is included,
 * so the assistant cannot "know" more than the dashboard shows.
 */
export const buildAssistantContext = (airQuality) => {
  if (!airQuality) {
    return null;
  }
  const { current, place, fetchedAt, demo, stale, series, nowIndex } = airQuality;
  return {
    place: place.name,
    aqi: current.aqi,
    category: current.category,
    dominantPollutant: current.dominantPollutantLabel ?? null,
    pm25: current.pm25,
    pm10: current.pm10,
    no2: current.no2,
    so2: current.so2,
    o3: current.o3,
    co: current.co,
    timestamp: fetchedAt,
    observedAt: current.observedAt,
    bestHours: findBestHours(series, nowIndex).best,
    stale: Boolean(stale),
    demo,
  };
};
