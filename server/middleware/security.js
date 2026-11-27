import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/** Build a JSON-speaking rate limiter. */
export const createLimiter = ({ windowMs, limit }, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });

/**
 * Security middleware that applies to every request: proxy trust, secure headers,
 * a CORS allow-list and a bounded JSON body parser.
 */
export function applySecurityMiddleware(app, config) {
  // Render (and most PaaS hosts) sit behind exactly one reverse proxy.
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : true,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: config.jsonBodyBytes }));
}

/** API responses can contain personal context or live data, so they are never cached by browsers or proxies. */
export const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
