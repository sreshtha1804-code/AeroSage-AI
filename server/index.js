import 'dotenv/config';
import { createApp } from './app.js';
import { DEFAULT_MODEL } from './assistant.js';

const PORT = process.env.PORT || 8787;
const app = createApp();

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  console.warn('[Config] CORS_ORIGIN is not set: the API accepts requests from any origin.');
}

app.listen(PORT, () => {
  console.log(`AeroSage API listening on port ${PORT}`);
  console.log(`Gemini model: ${process.env.GEMINI_MODEL || DEFAULT_MODEL}`);
  console.log(`Gemini key configured: ${Boolean(process.env.GEMINI_API_KEY)}`);
  console.log(
    `Supabase configured: ${Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)}`,
  );
});
