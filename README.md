# AeroSage AI - Smarter Air. Healthier Living.

React + Vite + Tailwind + Recharts frontend, Node/Express backend, Gemini AI, Open-Meteo air quality (no key needed), optional Supabase.

## Run locally (Node 18+)
    npm install
    cp .env.example .env      # add GEMINI_API_KEY (optional; chat falls back to labelled rule-based replies)
    npm run server            # terminal 1, API on :8787
    npm run dev               # terminal 2, UI on :5173 (proxies /api to :8787)

## Deploy: backend on Render
1. Push to GitHub (`.env` is git-ignored).
2. Render > New > Blueprint (uses `render.yaml`) or Web Service: build `npm install`, start `npm start`.
3. Env vars: `GEMINI_API_KEY`, optional `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`, and `CORS_ORIGIN` = your Vercel URL.
4. Check `https://<service>.onrender.com/api/health` returns `{"status":"ok"}`.

## Deploy: frontend on Vercel
1. Vercel > Add New Project > import the repo (framework Vite is auto-detected via `vercel.json`).
2. Environment variable `VITE_API_URL` = your Render URL (no trailing slash).
3. Deploy. Then put the Vercel URL into Render's `CORS_ORIGIN` and redeploy Render.
Note: Render's free tier sleeps when idle; the first request can take ~30 s.

## Supabase (optional)
Run `supabase/schema.sql` in the SQL editor, then set the two Supabase variables on Render. Without them, profiles stay in browser storage.

## Data honesty
Live AQI is model data (CAMS via Open-Meteo) approximated to CPCB breakpoints; source and timestamp are shown. If live data fails the app offers a badged DEMO mode. Impact calculators use user-editable, labelled assumptions. AI output is general information, not medical advice.
