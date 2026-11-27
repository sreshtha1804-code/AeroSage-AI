import {
  AIR_QUALITY_CACHE,
  DEFAULT_PORT,
  GEMINI,
  LOCATION_CACHE,
  RATE_LIMITS,
  REQUEST_LIMITS,
} from './constants.js';

const parseOrigins = (value) =>
  value
    ? value
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean)
    : [];

const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Read and normalise all environment configuration in one place.
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const supabaseKey = env.SUPABASE_SERVICE_KEY?.trim();

  return {
    port: positiveNumber(env.PORT, DEFAULT_PORT),
    isProduction: env.NODE_ENV === 'production',
    corsOrigins: parseOrigins(env.CORS_ORIGIN),
    jsonBodyBytes: REQUEST_LIMITS.jsonBodyBytes,
    gemini: {
      apiKey: env.GEMINI_API_KEY?.trim() || undefined,
      model: env.GEMINI_MODEL?.trim() || GEMINI.defaultModel,
    },
    supabase: { url: supabaseUrl || undefined, key: supabaseKey || undefined },
    airQualityCache: {
      ...AIR_QUALITY_CACHE,
      freshMs: positiveNumber(env.AQI_CACHE_TTL_MS, AIR_QUALITY_CACHE.freshMs),
    },
    locationCache: LOCATION_CACHE,
    rateLimits: RATE_LIMITS,
    /** Values that must never appear in logs. */
    secrets: [env.GEMINI_API_KEY?.trim(), supabaseKey].filter(Boolean),
  };
}
