import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger({ secrets: config.secrets });

if (config.isProduction && config.corsOrigins.length === 0) {
  logger.warn('[Config] CORS_ORIGIN is not set: the API accepts requests from any origin.');
}

createApp({ logger }).listen(config.port, () => {
  logger.info(`AeroSage API listening on port ${config.port}`);
  logger.info(
    `Gemini model: ${config.gemini.model} (key configured: ${Boolean(config.gemini.apiKey)})`,
  );
  logger.info(`Supabase configured: ${Boolean(config.supabase.url && config.supabase.key)}`);
});
