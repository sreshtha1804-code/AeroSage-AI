import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { TtlCache } from './utils/ttlCache.js';
import { applySecurityMiddleware, createLimiter, noStore } from './middleware/security.js';
import { apiNotFound, createErrorHandler } from './middleware/errorHandlers.js';
import { createOpenMeteoClient } from './services/openMeteo.js';
import { createAirQualityService } from './services/airQualityService.js';
import { createGeminiClient } from './services/gemini.js';
import { createProfileStore } from './services/profileStore.js';
import { createHealthRouter } from './routes/health.js';
import { createAqiRouter } from './routes/aqi.js';
import { createChatRouter } from './routes/chat.js';
import { createFamilyRouter } from './routes/family.js';

const distDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist');

/**
 * Compose the Express application. Every external dependency (env, fetch, logger, timing) is
 * injectable so the whole API can be tested without network access or real keys.
 *
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {ReturnType<typeof createLogger>} [options.logger]
 * @param {boolean} [options.serveStatic] serve the built frontend when `staticDir` exists (single-host deployments)
 * @param {string} [options.staticDir] directory of the built frontend (defaults to ../dist)
 * @param {object} [options.overrides] test hooks: rateLimits, airQualityCache, geminiRetry, openMeteoRetry, sleep, random, now
 */
export function createApp({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger,
  serveStatic = true,
  staticDir = distDirectory,
  overrides = {},
} = {}) {
  const config = loadConfig(env);
  const log = logger ?? createLogger({ secrets: config.secrets });
  const timing = { sleep: overrides.sleep, random: overrides.random };

  const airQualityService = createAirQualityService({
    client: createOpenMeteoClient({
      fetchImpl,
      logger: log,
      retryPolicy: overrides.openMeteoRetry,
      ...timing,
    }),
    payloadCache: new TtlCache({
      ...config.airQualityCache,
      ...overrides.airQualityCache,
      now: overrides.cacheNow,
    }),
    locationCache: new TtlCache({ ...config.locationCache, now: overrides.cacheNow }),
    logger: log,
    now: overrides.now,
  });
  const gemini = config.gemini.apiKey
    ? createGeminiClient({
        fetchImpl,
        apiKey: config.gemini.apiKey,
        model: config.gemini.model,
        logger: log,
        retryPolicy: overrides.geminiRetry,
        ...timing,
      })
    : null;
  const profileStore = createProfileStore({
    url: config.supabase.url,
    key: config.supabase.key,
    fetchImpl,
  });

  const rateLimits = { ...config.rateLimits, ...overrides.rateLimits };
  const app = express();
  applySecurityMiddleware(app, config);

  // The health check is mounted before rate limiting so platform probes are never blocked.
  app.use(
    '/api/health',
    createHealthRouter({
      geminiConfigured: Boolean(gemini),
      supabaseConfigured: profileStore.configured,
    }),
  );
  app.use(
    '/api',
    noStore,
    createLimiter(rateLimits.api, 'Too many requests. Please slow down and try again shortly.'),
  );
  app.use('/api/aqi', createAqiRouter({ airQualityService, logger: log }));
  app.use(
    '/api/chat',
    createChatRouter({
      gemini,
      logger: log,
      limiter: createLimiter(
        rateLimits.chat,
        'Too many assistant messages. Please wait a minute and try again.',
      ),
    }),
  );
  app.use('/api/family', createFamilyRouter({ store: profileStore, logger: log }));
  app.use('/api', apiNotFound);

  if (serveStatic && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  } else {
    app.get('/', (_req, res) => res.json({ name: 'AeroSage API', status: 'ok' }));
  }

  app.use(createErrorHandler(log));
  return app;
}
