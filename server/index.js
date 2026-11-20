import 'dotenv/config';
import express from 'express';
import cors from 'cors';
const app = express();
app.get('/api/health', (_, r) => r.json({ status: 'ok' }));
app.use(
  cors(
    process.env.CORS_ORIGIN
      ? { origin: process.env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, '')) }
      : undefined,
  ),
  express.json({ limit: '100kb' }),
);
// CPCB (India) AQI sub-index breakpoints: [Clo,Chi,Ilo,Ihi]
const T25 = [
  [0, 30, 0, 50],
  [31, 60, 51, 100],
  [61, 90, 101, 200],
  [91, 120, 201, 300],
  [121, 250, 301, 400],
  [251, 380, 401, 500],
];
const T10 = [
  [0, 50, 0, 50],
  [51, 100, 51, 100],
  [101, 250, 101, 200],
  [251, 350, 201, 300],
  [351, 430, 301, 400],
  [431, 510, 401, 500],
];
const sub = (c, T) => {
  if (c == null) return null;
  const r = T.find((t) => c <= t[1]) || T[5];
  return Math.round(((r[3] - r[2]) / (r[1] - r[0])) * (Math.min(c, r[1]) - r[0]) + r[2]);
};
const mean = (a) => {
  const v = a.filter((x) => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const indAqi = (p25, p10) => Math.max(sub(p25, T25) ?? 0, sub(p10, T10) ?? 0);
const CAT = (a) =>
  a <= 50
    ? 'Good'
    : a <= 100
      ? 'Satisfactory'
      : a <= 200
        ? 'Moderate'
        : a <= 300
          ? 'Poor'
          : a <= 400
            ? 'Very Poor'
            : 'Severe';
const j = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
};

function demo(city) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const series = [];
  for (let i = -72; i <= 24; i++) {
    const t = new Date(now.getTime() + i * 36e5);
    const h = t.getHours();
    const p25 = Math.round(150 + 70 * Math.cos(((h - 7) / 24) * 2 * Math.PI) + (i % 7) * 4);
    const p10 = Math.round(p25 * 1.6);
    series.push({ t: t.toISOString(), pm25: p25, pm10: p10, aqi: indAqi(p25, p10), future: i > 0 });
  }
  const nowIndex = 72,
    c = series[nowIndex];
  return {
    demo: true,
    place: { name: city || 'Demo City', country: 'Synthetic data' },
    current: {
      pm25: c.pm25,
      pm10: c.pm10,
      no2: 48,
      so2: 12,
      o3: 30,
      co: 900,
      aqi: c.aqi,
      category: CAT(c.aqi),
    },
    series,
    nowIndex,
    source: 'DEMO MODE – synthetic values, NOT real measurements',
    fetchedAt: new Date().toISOString(),
  };
}

app.get('/api/aqi', async (req, res) => {
  const city = String(req.query.city || '')
    .trim()
    .slice(0, 80);
  if (!city) return res.status(400).json({ error: 'Please enter a city name.' });
  if (req.query.demo === '1') return res.json(demo(city));
  try {
    const g = await j(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    );
    const loc = g.results?.[0];
    if (!loc)
      return res.status(404).json({ error: `Could not find "${city}". Try a nearby larger city.` });
    const a = await j(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.latitude}&longitude=${loc.longitude}&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide&hourly=pm2_5,pm10&past_days=3&forecast_days=2&timezone=auto`,
    );
    const H = a.hourly,
      cur = a.current;
    let ni = H.time.indexOf(cur.time.slice(0, 13) + ':00');
    if (ni < 0) ni = H.time.findIndex((t) => t >= cur.time);
    if (ni < 0) ni = 0;
    const series = H.time.map((t, i) => {
      const w = i - 23 < 0 ? 0 : i - 23;
      const p25 = mean(H.pm2_5.slice(w, i + 1)),
        p10 = mean(H.pm10.slice(w, i + 1));
      return {
        t,
        pm25: p25 == null ? null : Math.round(p25),
        pm10: p10 == null ? null : Math.round(p10),
        aqi: indAqi(p25, p10),
        future: i > ni,
      };
    });
    const a24 = series[ni].aqi;
    res.json({
      demo: false,
      place: { name: loc.name, admin: loc.admin1, country: loc.country },
      current: {
        pm25: cur.pm2_5,
        pm10: cur.pm10,
        no2: cur.nitrogen_dioxide,
        so2: cur.sulphur_dioxide,
        o3: cur.ozone,
        co: cur.carbon_monoxide,
        aqi: a24,
        category: CAT(a24),
      },
      series,
      nowIndex: ni,
      source:
        'Open-Meteo Air Quality API (CAMS atmospheric model, not a ground sensor). AQI is approximated with CPCB breakpoints from 24h-average PM2.5/PM10.',
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res
      .status(502)
      .json({ error: 'Live air quality service is unavailable right now.', canDemo: true });
  }
});

const fallback = (m, c) =>
  `(Rule-based reply – AI key not configured)\nAQI ${c?.aqi ?? '?'} (${c?.category ?? 'unknown'}) in ${c?.place ?? 'your area'}. General guidance: ${c?.aqi > 200 ? 'limit outdoor exertion, wear a well-fitted N95/FFP2 mask if you must go out, keep windows closed during peaks and run a purifier in the room you use most.' : c?.aqi > 100 ? 'sensitive groups should reduce prolonged outdoor exertion; ventilate briefly when air is cleaner.' : 'conditions are comparatively fine; normal activity is reasonable.'} Why: fine particles (PM2.5) enter deep into the lungs, so cutting exposure and indoor sources helps. This is general information, not medical advice.`;

app.post('/api/chat', async (req, res) => {
  const { message, history = [], context, profile = [] } = req.body || {};
  if (!message || typeof message !== 'string')
    return res.status(400).json({ error: 'Message required' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ text: fallback(message, context), ai: false });
  const sys = `You are AeroSage AI, a practical urban air-quality advisor for Indian families. Rules: use ONLY the provided air quality context for current readings and never invent live measurements; if data is missing say so. Give actionable, affordable, specific advice, and for each recommendation briefly say WHY. Label any numeric environmental/cost estimates as "estimate" with assumptions. Do not diagnose or give medical claims; for symptoms advise seeing a doctor. Keep answers concise with short bullets.\nAIR QUALITY CONTEXT (${context?.demo ? 'DEMO synthetic data' : 'real model data'}): ${JSON.stringify(context || {})}\nHOUSEHOLD: ${JSON.stringify(profile)}`;
  const contents = [
    ...history.slice(-8).map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(h.text).slice(0, 2000) }],
    })),
    { role: 'user', parts: [{ text: message.slice(0, 2000) }] },
  ];
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents }),
        signal: AbortSignal.timeout(30000),
      },
    );
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.map((p) => p.text).join('');
    if (!text) throw new Error(d.error?.message || 'empty');
    res.json({ text, ai: true });
  } catch (e) {
    res.json({
      text: fallback(message, context),
      ai: false,
      note: 'AI service error; showing rule-based guidance.',
    });
  }
});

// ---- Family profiles in Supabase (optional; server-side key only) ----
const SB = process.env.SUPABASE_URL,
  SK = process.env.SUPABASE_SERVICE_KEY;
const sbq = (p, o = {}) =>
  fetch(`${SB}/rest/v1/${p}`, {
    ...o,
    headers: {
      apikey: SK,
      Authorization: `Bearer ${SK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    signal: AbortSignal.timeout(10000),
  });
const UUID = /^[0-9a-f-]{20,40}$/i,
  TYPES = ['child', 'elderly', 'worker', 'adult'];
app.get('/api/family', async (q, r) => {
  if (!SB || !SK) return r.json({ enabled: false });
  const d = q.query.device;
  if (!UUID.test(d || '')) return r.status(400).json({ error: 'bad device' });
  try {
    const x = await sbq(`profiles?device_id=eq.${d}&select=id,name,type&order=created_at`);
    if (!x.ok) throw 0;
    r.json({ enabled: true, items: await x.json() });
  } catch {
    r.json({ enabled: false });
  }
});
app.post('/api/family', async (q, r) => {
  if (!SB || !SK) return r.status(503).json({ error: 'cloud off' });
  const { device, name, type } = q.body || {};
  if (!UUID.test(device || '') || !TYPES.includes(type) || !name)
    return r.status(400).json({ error: 'invalid' });
  try {
    const x = await sbq('profiles', {
      method: 'POST',
      body: JSON.stringify({ device_id: device, name: String(name).slice(0, 40), type }),
    });
    const j = await x.json();
    if (!x.ok) throw 0;
    r.json({ item: { id: j[0].id, name: j[0].name, type: j[0].type } });
  } catch {
    r.status(502).json({ error: 'save failed' });
  }
});
app.delete('/api/family/:id', async (q, r) => {
  if (!SB || !SK || !UUID.test(q.params.id) || !UUID.test(q.query.device || ''))
    return r.status(400).json({ error: 'invalid' });
  try {
    await sbq(`profiles?id=eq.${q.params.id}&device_id=eq.${q.query.device}`, { method: 'DELETE' });
    r.json({ ok: true });
  } catch {
    r.status(502).json({ error: 'delete failed' });
  }
});

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_, r) => r.sendFile(path.join(dist, 'index.html')));
}
if (!fs.existsSync(dist)) app.get('/', (_, r) => r.json({ name: 'AeroSage API', status: 'ok' }));
app.listen(process.env.PORT || 8787, () => console.log('AeroSage API ready'));
