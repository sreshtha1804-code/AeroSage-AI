import express from 'express';

/** Liveness probe for Render. Reports which optional features are configured, never any secret. */
export function createHealthRouter({ geminiConfigured, supabaseConfigured }) {
  const router = express.Router();
  router.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'aerosage-api',
      timestamp: new Date().toISOString(),
      features: { gemini: geminiConfigured, supabase: supabaseConfigured },
    });
  });
  return router;
}
