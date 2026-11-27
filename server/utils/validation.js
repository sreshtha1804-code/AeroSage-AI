import { PROFILE_TYPES, REQUEST_LIMITS } from '../constants.js';
import { categoryFor, POLLUTANT_LABELS, toNumber } from '../domain/aqi.js';

export const FAMILY_TYPES = PROFILE_TYPES;
export const MAX_MESSAGE_LENGTH = REQUEST_LIMITS.messageMaxLength;
export const MAX_PROFILE_NAME = REQUEST_LIMITS.profileNameMaxLength;
export const MAX_HISTORY_ITEMS = REQUEST_LIMITS.historyMaxItems;
export const MAX_PROFILES_IN_PROMPT = REQUEST_LIMITS.profilesInPromptMax;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g;

/** Remove control characters and collapse whitespace so user text cannot break prompt structure. */
export const cleanText = (value, maxLength) =>
  typeof value === 'string'
    ? value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';

export const parseCity = (raw) => {
  if (typeof raw !== 'string') {
    return '';
  }
  return cleanText(raw, REQUEST_LIMITS.cityMaxLength);
};

/** Accepts place as a string or {name, admin, country}; returns a short string. */
const placeToString = (place, fallbackCity) => {
  if (typeof place === 'string') {
    return cleanText(place, 100);
  }
  if (place && typeof place === 'object') {
    return cleanText([place.name, place.admin, place.country].filter(Boolean).join(', '), 100);
  }
  return cleanText(fallbackCity, 100);
};

const numberOrNull = (value) => {
  const n = toNumber(value);
  return n === null ? null : Math.round(n * 10) / 10;
};

const HOURS_IN_DAY = 24;
const MAX_BEST_HOURS = 3;
const KNOWN_POLLUTANT_LABELS = Object.values(POLLUTANT_LABELS);

/** Up to three distinct whole hours (0-23), e.g. the cleanest hours suggested by the planner. */
const sanitizeHours = (hours) =>
  Array.isArray(hours)
    ? [...new Set(hours.filter((h) => Number.isInteger(h) && h >= 0 && h < HOURS_IN_DAY))].slice(
        0,
        MAX_BEST_HOURS,
      )
    : [];

/** Whitelist the air-quality context accepted from the browser; anything else is dropped. */
export const sanitizeContext = (context) => {
  const src = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
  const current = src.current && typeof src.current === 'object' ? src.current : {};
  const pick = (key) => numberOrNull(src[key] ?? current[key]);
  const aqiRaw = pick('aqi');
  const aqi = aqiRaw === null ? null : Math.min(Math.max(aqiRaw, 0), 500);
  const dominant = cleanText(src.dominantPollutant, 10);

  return {
    place: placeToString(src.place, src.city) || 'your area',
    aqi,
    aqiIsEstimate: true,
    // Always derived from the AQI so a client cannot send a mismatched category.
    category: categoryFor(aqi),
    dominantPollutant: KNOWN_POLLUTANT_LABELS.includes(dominant) ? dominant : null,
    pm25: pick('pm25'),
    pm10: pick('pm10'),
    no2: pick('no2'),
    so2: pick('so2'),
    o3: pick('o3'),
    co: pick('co'),
    unit: 'ug/m3',
    timestamp: cleanText(src.timestamp, 40),
    observedAt: cleanText(src.observedAt, 40),
    bestHours: sanitizeHours(src.bestHours),
    stale: src.stale === true,
    demo: src.demo === true,
  };
};

export const sanitizeProfile = (profile) => {
  if (!Array.isArray(profile)) {
    return [];
  }
  return profile
    .slice(0, MAX_PROFILES_IN_PROMPT)
    .map((item) => ({
      name: cleanText(item?.name, MAX_PROFILE_NAME),
      type: FAMILY_TYPES.includes(item?.type) ? item.type : 'adult',
    }))
    .filter((item) => item.name);
};

/** Gemini needs a conversation that starts with a user turn. */
export const sanitizeHistory = (history) => {
  if (!Array.isArray(history)) {
    return [];
  }
  const turns = history
    .slice(-MAX_HISTORY_ITEMS)
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .map((item) => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.text.trim().slice(0, MAX_MESSAGE_LENGTH) }],
    }));
  while (turns.length && turns[0].role !== 'user') {
    turns.shift();
  }
  return turns;
};
