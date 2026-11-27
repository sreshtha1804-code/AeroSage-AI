/**
 * Central place for every tunable number used by the API.
 * Keeping them here avoids "magic numbers" scattered through the code base.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const DEFAULT_PORT = 8787;

export const REQUEST_LIMITS = Object.freeze({
  jsonBodyBytes: 100 * 1024,
  cityMaxLength: 80,
  messageMaxLength: 2000,
  profileNameMaxLength: 40,
  historyMaxItems: 8,
  profilesInPromptMax: 10,
  profilesPerDevice: 20,
});

export const TIMEOUTS_MS = Object.freeze({
  openMeteo: 8 * SECOND,
  gemini: 15 * SECOND,
  geminiTotalBudget: 40 * SECOND,
  supabase: 10 * SECOND,
});

export const RETRY_POLICIES = Object.freeze({
  openMeteo: { maxAttempts: 2, baseDelayMs: 300, maxDelayMs: 1500 },
  gemini: { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 4 * SECOND },
});

/** Fresh entries are served directly; stale entries are only served when the provider fails. */
export const AIR_QUALITY_CACHE = Object.freeze({
  freshMs: 10 * MINUTE,
  staleMs: 6 * HOUR,
  maxEntries: 100,
});

export const RATE_LIMITS = Object.freeze({
  api: { windowMs: MINUTE, limit: 120 },
  chat: { windowMs: MINUTE, limit: 15 },
});

export const GEMINI = Object.freeze({
  defaultModel: 'gemini-2.5-flash',
  temperature: 0.7,
  maxOutputTokens: 2048,
  maxReplyChars: 4000,
  maxRetryAfterMs: 5 * SECOND,
});

/** Averaging rules that CPCB applies before an AQI may be reported. */
export const AVERAGING = Object.freeze({
  dailyWindowHours: 24,
  dailyMinSamples: 16,
  eightHourWindow: 8,
  eightHourMinSamples: 6,
  /** Hours of history requested in addition to what is displayed, so every shown hour has a full window. */
  warmUpHours: 24,
});

export const AIR_QUALITY_WINDOW = Object.freeze({ pastDays: 4, forecastDays: 2 });

export const PROFILE_TYPES = Object.freeze(['child', 'elderly', 'worker', 'adult']);

/** Geocoding results rarely change, so a resolved city location is remembered for a day. */
export const LOCATION_CACHE = Object.freeze({
  freshMs: 24 * HOUR,
  staleMs: 24 * HOUR,
  maxEntries: 200,
});
