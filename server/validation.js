import { categoryFor, toNumber } from './aqi.js';

export const FAMILY_TYPES = ['child', 'elderly', 'worker', 'adult'];
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_PROFILE_NAME = 40;
export const MAX_HISTORY_ITEMS = 8;
export const MAX_PROFILES_IN_PROMPT = 10;

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
  if (typeof raw !== 'string') return '';
  return cleanText(raw, 80);
};

/** Accepts place as a string or {name, admin, country}; returns a short string. */
const placeToString = (place, fallbackCity) => {
  if (typeof place === 'string') return cleanText(place, 100);
  if (place && typeof place === 'object') {
    return cleanText([place.name, place.admin, place.country].filter(Boolean).join(', '), 100);
  }
  return cleanText(fallbackCity, 100);
};

const numberOrNull = (value) => {
  const n = toNumber(value);
  return n === null ? null : Math.round(n * 10) / 10;
};

/** Whitelist the air-quality context accepted from the browser. */
export const sanitizeContext = (context) => {
  const src = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
  const current = src.current && typeof src.current === 'object' ? src.current : {};
  const aqiRaw = numberOrNull(src.aqi ?? current.aqi);
  const aqi = aqiRaw === null ? null : Math.min(Math.max(aqiRaw, 0), 500);

  return {
    place: placeToString(src.place, src.city) || 'your area',
    aqi,
    // Always derived from the AQI so a client cannot send a mismatched category.
    category: categoryFor(aqi),
    pm25: numberOrNull(src.pm25 ?? current.pm25),
    pm10: numberOrNull(src.pm10 ?? current.pm10),
    no2: numberOrNull(src.no2 ?? current.no2),
    o3: numberOrNull(src.o3 ?? current.o3),
    timestamp: cleanText(src.timestamp, 40),
    demo: src.demo === true,
  };
};

export const sanitizeProfile = (profile) => {
  if (!Array.isArray(profile)) return [];
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
  if (!Array.isArray(history)) return [];
  const turns = history
    .slice(-MAX_HISTORY_ITEMS)
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .map((item) => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.text.trim().slice(0, MAX_MESSAGE_LENGTH) }],
    }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
};
