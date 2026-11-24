import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildAqiSeries, categoryFor, findNowIndex } from './aqi.js';
import { buildDemoData } from './demo.js';
import {
  DEFAULT_MODEL,
  FALLBACK_NOTES,
  buildFallbackReply,
  buildSystemInstruction,
  callGemini,
} from './assistant.js';
import { createFamilyRouter } from './family.js';
import {
  MAX_MESSAGE_LENGTH,
  parseCity,
  sanitizeContext,
  sanitizeHistory,
  sanitizeProfile,
} from './validation.js';

const distDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist');

const parseOrigins = (value) =>
  value
    ? value
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean)
    : [];

const limiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });

/**
 * Create the Express app. All external dependencies (fetch, clock, logger, env) are
 * injectable so the whole API can be tested without network access or real keys.
 */
export function createApp({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
  sleep,
  serveStatic = true,
  limits = {},
  aqiCacheTtlMs = Number(env.AQI_CACHE_TTL_MS) || 10 * 60 * 1000,
  gemini = {},
} = {}) {
  const app = express();
  const origins = parseOrigins(env.CORS_ORIGIN);
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const geminiModel = env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const supabaseKey = env.SUPABASE_SERVICE_KEY?.trim();

  // Render (and most PaaS hosts) sit behind one reverse proxy.
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: origins.length ? origins : true,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  // Health check is registered before rate limiting so platform probes never get blocked.
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'aerosage-api',
      timestamp: new Date().toISOString(),
      features: { gemini: Boolean(geminiKey), supabase: Boolean(supabaseUrl && supabaseKey) },
    });
  });

  app.use(
    '/api',
    limiter({
      windowMs: limits.api?.windowMs ?? 60_000,
      limit: limits.api?.limit ?? 120,
      message: 'Too many requests. Please slow down and try again shortly.',
    }),
  );
  const chatLimiter = limiter({
    windowMs: limits.chat?.windowMs ?? 60_000,
    limit: limits.chat?.limit ?? 15,
    message: 'Too many assistant messages. Please wait a minute and try again.',
  });

  // ---------- Air quality ----------
  const aqiCache = new Map();
  const CACHE_MAX_ENTRIES = 100;

  const getJson = async (url) => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`External API returned HTTP ${response.status}`);
    return response.json();
  };

  app.get('/api/aqi', async (req, res) => {
    const city = parseCity(req.query.city);
    if (!city) return res.status(400).json({ error: 'Please enter a city name.' });

    if (req.query.demo === '1') return res.json(buildDemoData(city));

    const cacheKey = city.toLowerCase();
    const hit = aqiCache.get(cacheKey);
    if (hit && Date.now() - hit.at < aqiCacheTtlMs) return res.json(hit.payload);

    try {
      const geocoding = await getJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      );
      const location = geocoding?.results?.[0];
      if (!location) {
        return res
          .status(404)
          .json({ error: `Could not find "${city}". Try a nearby larger city.` });
      }

      // Fetch one extra day of history so every displayed hour has a full 24 h window.
      const air = await getJson(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide&hourly=pm2_5,pm10&past_days=4&forecast_days=2&timezone=auto`,
      );
      const { hourly, current } = air || {};
      if (!Array.isArray(hourly?.time) || !hourly.time.length || !current) {
        throw new Error('Incomplete air quality response.');
      }

      const fullNowIndex = findNowIndex(hourly.time, current.time);
      const warmUpHours = Math.min(24, fullNowIndex);
      const series = buildAqiSeries(hourly, fullNowIndex).slice(warmUpHours);
      const nowIndex = fullNowIndex - warmUpHours;
      const aqi = series[nowIndex]?.aqi ?? null;

      const payload = {
        demo: false,
        place: { name: location.name, admin: location.admin1, country: location.country },
        current: {
          pm25: current.pm2_5 ?? null,
          pm10: current.pm10 ?? null,
          no2: current.nitrogen_dioxide ?? null,
          so2: current.sulphur_dioxide ?? null,
          o3: current.ozone ?? null,
          co: current.carbon_monoxide ?? null,
          aqi,
          category: categoryFor(aqi),
        },
        series,
        nowIndex,
        source:
          'Open-Meteo Air Quality API (CAMS atmospheric model, not a ground sensor). AQI is approximated with CPCB breakpoints from 24-hour average PM2.5/PM10.',
        fetchedAt: new Date().toISOString(),
      };

      if (aqiCache.size >= CACHE_MAX_ENTRIES) aqiCache.delete(aqiCache.keys().next().value);
      aqiCache.set(cacheKey, { at: Date.now(), payload });
      return res.json(payload);
    } catch (error) {
      logger.error('[AQI API]', error.name, error.message);
      return res
        .status(502)
        .json({ error: 'Live air quality service is unavailable right now.', canDemo: true });
    }
  });

  // ---------- AI assistant ----------
  app.post('/api/chat', chatLimiter, async (req, res) => {
    const { message, history, context, profile } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Please enter a message.' });
    }

    const userMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    const safeContext = sanitizeContext(context);
    const fallback = (reason) => ({
      text: buildFallbackReply(safeContext),
      ai: false,
      source: 'fallback',
      note: FALLBACK_NOTES[reason],
    });

    if (!geminiKey) {
      logger.error('[Gemini] GEMINI_API_KEY is not configured.');
      return res.json(fallback('not_configured'));
    }

    const result = await callGemini({
      fetchImpl,
      apiKey: geminiKey,
      model: geminiModel,
      systemInstruction: buildSystemInstruction(safeContext, sanitizeProfile(profile)),
      contents: [...sanitizeHistory(history), { role: 'user', parts: [{ text: userMessage }] }],
      sleep,
      logger,
      ...gemini,
    });

    if (!result.ok) return res.json(fallback(result.reason));
    return res.json({ text: result.text, ai: true, source: 'gemini' });
  });

  // ---------- Family profiles (Supabase) ----------
  app.use('/api/family', createFamilyRouter({ supabaseUrl, supabaseKey, fetchImpl, logger }));

  // Unknown API routes get JSON, never the SPA shell.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // ---------- Static frontend (only when a build exists, e.g. single-host deploys) ----------
  if (serveStatic && fs.existsSync(distDirectory)) {
    app.use(express.static(distDirectory));
    app.get('*', (_req, res) => res.sendFile(path.join(distDirectory, 'index.html')));
  } else {
    app.get('/', (_req, res) => res.json({ name: 'AeroSage API', status: 'ok' }));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON.' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    logger.error('[Unhandled]', err?.message);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
