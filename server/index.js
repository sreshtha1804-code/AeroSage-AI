
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// ======================================================
// 1. SERVER CONFIGURATION
// ======================================================

const app = express();

const PORT = process.env.PORT || 8787;

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean)
  : null;

app.use(
  cors(
    corsOrigins
      ? { origin: corsOrigins }
      : undefined
  )
);

app.use(express.json({ limit: '100kb' }));

// ======================================================
// 2. HEALTH CHECK
// ======================================================

app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'aerosage-api',
    timestamp: new Date().toISOString(),
  });
});

// ======================================================
// 3. INDIAN AQI CALCULATION
// CPCB-style PM2.5 and PM10 breakpoints
// ======================================================

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

const sub = (concentration, table) => {
  if (
    concentration == null ||
    !Number.isFinite(Number(concentration))
  ) {
    return null;
  }

  const value = Number(concentration);

  if (value < 0) return null;

  const range =
    table.find((item) => value <= item[1]) ||
    table[table.length - 1];

  const [low, high, indexLow, indexHigh] = range;

  const clamped = Math.max(
    low,
    Math.min(value, high)
  );

  return Math.round(
    ((indexHigh - indexLow) / (high - low)) *
      (clamped - low) +
      indexLow
  );
};

const mean = (values) => {
  const valid = values.filter(
    (value) =>
      value != null &&
      Number.isFinite(Number(value))
  );

  if (!valid.length) return null;

  return (
    valid.reduce(
      (sum, value) => sum + Number(value),
      0
    ) / valid.length
  );
};

const indAqi = (pm25, pm10) => {
  const values = [
    sub(pm25, T25),
    sub(pm10, T10),
  ].filter((value) => value != null);

  return values.length ? Math.max(...values) : null;
};

const CAT = (aqi) => {
  if (aqi == null) return 'Unavailable';

  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';

  return 'Severe';
};

// ======================================================
// 4. COMMON API HELPER
// ======================================================

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(
      `External API returned HTTP ${response.status}`
    );
  }

  return response.json();
};

// ======================================================
// 5. DEMO AIR QUALITY DATA
// ======================================================

function demo(city) {
  const now = new Date();

  now.setMinutes(0, 0, 0);

  const series = [];

  for (let i = -72; i <= 24; i++) {
    const time = new Date(
      now.getTime() + i * 36e5
    );

    const hour = time.getHours();

    const pm25 = Math.round(
      150 +
        70 *
          Math.cos(
            ((hour - 7) / 24) * 2 * Math.PI
          ) +
        (i % 7) * 4
    );

    const pm10 = Math.round(pm25 * 1.6);

    series.push({
      t: time.toISOString(),
      pm25,
      pm10,
      aqi: indAqi(pm25, pm10),
      future: i > 0,
    });
  }

  const nowIndex = 72;
  const current = series[nowIndex];

  return {
    demo: true,

    place: {
      name: city || 'Demo City',
      country: 'Synthetic data',
    },

    current: {
      pm25: current.pm25,
      pm10: current.pm10,
      no2: 48,
      so2: 12,
      o3: 30,
      co: 900,
      aqi: current.aqi,
      category: CAT(current.aqi),
    },

    series,
    nowIndex,

    source:
      'DEMO MODE - synthetic values, NOT real measurements',

    fetchedAt: new Date().toISOString(),
  };
}

// ======================================================
// 6. LIVE AIR QUALITY API
// ======================================================

app.get('/api/aqi', async (req, res) => {
  const city = String(req.query.city || '')
    .trim()
    .slice(0, 80);

  if (!city) {
    return res.status(400).json({
      error: 'Please enter a city name.',
    });
  }

  if (req.query.demo === '1') {
    return res.json(demo(city));
  }

  try {
    // Step 1: Find city coordinates.

    const geocoding = await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );

    const location = geocoding.results?.[0];

    if (!location) {
      return res.status(404).json({
        error: `Could not find "${city}". Try a nearby larger city.`,
      });
    }

    // Step 2: Fetch air quality information.

    const air = await fetchJson(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide&hourly=pm2_5,pm10&past_days=3&forecast_days=2&timezone=auto`
    );

    const hourly = air.hourly;
    const current = air.current;

    if (!hourly?.time || !current) {
      throw new Error(
        'Incomplete air quality response.'
      );
    }

    // Step 3: Find the current hour.

    let nowIndex = hourly.time.indexOf(
      current.time.slice(0, 13) + ':00'
    );

    if (nowIndex < 0) {
      nowIndex = hourly.time.findIndex(
        (time) => time >= current.time
      );
    }

    if (nowIndex < 0) nowIndex = 0;

    // Step 4: Calculate hourly AQI estimates.

    const series = hourly.time.map(
      (time, index) => {
        const start = Math.max(0, index - 23);

        const pm25 = mean(
          hourly.pm2_5.slice(start, index + 1)
        );

        const pm10 = mean(
          hourly.pm10.slice(start, index + 1)
        );

        return {
          t: time,

          pm25:
            pm25 == null ? null : Math.round(pm25),

          pm10:
            pm10 == null ? null : Math.round(pm10),

          aqi: indAqi(pm25, pm10),

          future: index > nowIndex,
        };
      }
    );

    const estimatedAqi =
      series[nowIndex]?.aqi ?? null;

    // Step 5: Return structured information.

    return res.json({
      demo: false,

      place: {
        name: location.name,
        admin: location.admin1,
        country: location.country,
      },

      current: {
        pm25: current.pm2_5,
        pm10: current.pm10,
        no2: current.nitrogen_dioxide,
        so2: current.sulphur_dioxide,
        o3: current.ozone,
        co: current.carbon_monoxide,

        aqi: estimatedAqi,
        category: CAT(estimatedAqi),
      },

      series,
      nowIndex,

      source:
        'Open-Meteo Air Quality API (CAMS atmospheric model, not a ground sensor). AQI is approximated with CPCB breakpoints from 24-hour average PM2.5/PM10.',

      fetchedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error(
      '[AQI API Error]',
      error.message
    );

    return res.status(502).json({
      error:
        'Live air quality service is unavailable right now.',
      canDemo: true,
    });
  }
});

// ======================================================
// 7. AEROSAGE AI FALLBACK ASSISTANT
// ======================================================

const getPlaceName = (context) => {
  const place = context?.place;

  if (typeof place === 'string') {
    return place;
  }

  if (place && typeof place === 'object') {
    return [
      place.name,
      place.admin,
      place.country,
    ]
      .filter(Boolean)
      .join(', ');
  }

  return context?.city || 'your area';
};

const fallback = (message, context) => {
  const aqi =
    context?.current?.aqi ?? context?.aqi;

  const category =
    context?.current?.category ??
    context?.category ??
    CAT(aqi);

  const place = getPlaceName(context);

  let advice;

  if (aqi == null) {
    advice =
      'I do not have a current AQI reading. Please check the Air Quality section for your city before making outdoor activity decisions.';
  } else if (aqi > 200) {
    advice =
      'Limit outdoor exertion, wear a well-fitted N95 or FFP2 mask if you must go outside, keep windows closed during pollution peaks, and use an air purifier if available.';
  } else if (aqi > 100) {
    advice =
      'Sensitive groups should reduce prolonged outdoor exertion. Ventilate briefly when outdoor air is cleaner.';
  } else {
    advice =
      'Conditions are comparatively fine. Normal outdoor activity is reasonable, while continuing to monitor changing conditions.';
  }

  return `I am AeroSage AI, your environmental health assistant.

Your question: ${message}

Available air quality information:
- Location: ${place}
- Estimated AQI: ${aqi ?? 'Unavailable'}
- Category: ${category}

Guidance:
${advice}

Why this matters:
Fine particles such as PM2.5 can penetrate deep into the lungs. Reducing exposure and controlling indoor pollution sources can help.

Note: I am currently using basic guidance because the AI service is unavailable. This is general information, not medical advice.`;
};

// ======================================================
// 8. GEMINI AI ASSISTANT WITH AUTOMATIC RETRIES
// ======================================================

app.post('/api/chat', async (req, res) => {
  const {
    message,
    history = [],
    context = {},
    profile = [],
  } = req.body || {};

  if (
    !message ||
    typeof message !== 'string' ||
    !message.trim()
  ) {
    return res.status(400).json({
      error: 'Please enter a message.',
    });
  }

  const userMessage = message.trim().slice(0, 2000);

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  const model =
    process.env.GEMINI_MODEL?.trim() ||
    'gemini-3.8-flash';

  // Check API key.

  if (!apiKey) {
    console.error(
      '[Gemini] GEMINI_API_KEY is missing.'
    );

    return res.json({
      text: fallback(userMessage, context),
      ai: false,
      note: 'Gemini API key is not configured.',
    });
  }

  // Prepare system instructions.

  const systemInstruction = `
You are AeroSage AI, a practical urban air-quality and environmental health advisor for Indian families.

YOUR ROLE:
Help users understand pollution, improve indoor air quality, protect their families, and make informed daily decisions.

IMPORTANT RULES:

1. Use ONLY the supplied air-quality context for current environmental readings.
2. Never invent live AQI values, pollutant readings, forecasts, or weather information.
3. If current data is missing, clearly say that it is unavailable.
4. Explain environmental concepts in simple language.
5. Give practical, affordable and actionable recommendations.
6. Briefly explain WHY each recommendation helps.
7. Consider children, elderly people, outdoor workers, and sensitive groups when relevant.
8. Clearly label numeric estimates and explain their assumptions.
9. Never diagnose illnesses or promise medical outcomes.
10. If a user reports symptoms, recommend consulting a qualified medical professional.
11. Do not pretend to have performed an action that you have not performed.
12. Be friendly, clear, accurate and concise.
13. Use short headings and bullet points when helpful.

AIR QUALITY CONTEXT:
${JSON.stringify(context)}

HOUSEHOLD PROFILE:
${JSON.stringify(profile)}
`;

  // Prepare conversation history.

  const safeHistory = Array.isArray(history)
    ? history.slice(-8)
    : [];

  const contents = safeHistory
    .filter(
      (item) =>
        item &&
        typeof item.text === 'string' &&
        item.text.trim()
    )
    .map((item) => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [
        {
          text: item.text.slice(0, 2000),
        },
      ],
    }));

  contents.push({
    role: 'user',
    parts: [
      {
        text: userMessage,
      },
    ],
  });

  // Retry configuration.

  const maxAttempts = 3;

  const retryableStatuses = [
    429,
    500,
    502,
    503,
    504,
  ];

  const requestUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const requestBody = {
    systemInstruction: {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    },

    contents,

    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  };

  // Gemini request with automatic retries.

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      console.log(
        `[Gemini] Sending request using model: ${model} (attempt ${attempt}/${maxAttempts})`
      );

      const response = await fetch(
        requestUrl,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },

          body: JSON.stringify(requestBody),

          signal: AbortSignal.timeout(30000),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      // Handle API errors.

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ||
          response.statusText;

        console.error('[Gemini API Error]', {
          status: response.status,
          message: errorMessage,
          attempt,
        });

        // Retry temporary server or rate-limit errors.

        if (
          retryableStatuses.includes(response.status) &&
          attempt < maxAttempts
        ) {
          const delay = 1000 * attempt;

          console.log(
            `[Gemini] Temporary error. Retrying in ${delay}ms...`
          );

          await new Promise((resolve) =>
            setTimeout(resolve, delay)
          );

          continue;
        }

        return res.json({
          text: fallback(userMessage, context),
          ai: false,
          note: `Gemini API returned HTTP ${response.status}. Basic guidance is being shown instead.`,
        });
      }

      // Extract generated response.

      const generatedText =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || '')
          .join('')
          .trim();

      if (!generatedText) {
        console.error(
          '[Gemini] Empty response received.',
          {
            finishReason:
              data.candidates?.[0]?.finishReason,
            promptFeedback: data.promptFeedback,
          }
        );

        return res.json({
          text: fallback(userMessage, context),
          ai: false,
          note: 'Gemini did not return generated text.',
        });
      }

      console.log(
        '[Gemini] AI response generated successfully.'
      );

      return res.json({
        text: generatedText,
        ai: true,
      });

    } catch (error) {
      console.error(
        '[Gemini Request Failed]',
        {
          name: error.name,
          message: error.message,
          attempt,
        }
      );

      // Retry connection and timeout failures.

      if (attempt < maxAttempts) {
        const delay = 1000 * attempt;

        console.log(
          `[Gemini] Connection failed. Retrying in ${delay}ms...`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, delay)
        );

        continue;
      }

      return res.json({
        text: fallback(userMessage, context),
        ai: false,
        note:
          'Gemini is temporarily unavailable. Basic guidance is being shown instead.',
      });
    }
  }
});

// ======================================================
// 9. SUPABASE FAMILY PROFILE CONFIGURATION
// ======================================================

const SUPABASE_URL =
  process.env.SUPABASE_URL?.replace(/\/$/, '');

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY;

const UUID = /^[0-9a-f-]{20,40}$/i;

const TYPES = [
  'child',
  'elderly',
  'worker',
  'adult',
];

const supabaseRequest = async (
  endpoint,
  options = {}
) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Supabase is not configured.'
    );
  }

  return fetch(
    `${SUPABASE_URL}/rest/v1/${endpoint}`,
    {
      ...options,

      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...options.headers,
      },

      signal: AbortSignal.timeout(10000),
    }
  );
};

// ======================================================
// 10. GET FAMILY PROFILES
// ======================================================

app.get('/api/family', async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.json({
      enabled: false,
      items: [],
    });
  }

  const device = req.query.device;

  if (!UUID.test(device || '')) {
    return res.status(400).json({
      error: 'Invalid device ID.',
    });
  }

  try {
    const response = await supabaseRequest(
      `profiles?device_id=eq.${device}&select=id,name,type&order=created_at`
    );

    if (!response.ok) {
      throw new Error(
        `Supabase returned HTTP ${response.status}`
      );
    }

    const items = await response.json();

    return res.json({
      enabled: true,
      items,
    });

  } catch (error) {
    console.error(
      '[Family GET Error]',
      error.message
    );

    return res.json({
      enabled: false,
      items: [],
    });
  }
});

// ======================================================
// 11. CREATE FAMILY PROFILE
// ======================================================

app.post('/api/family', async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({
      error:
        'Family cloud storage is not configured.',
    });
  }

  const {
    device,
    name,
    type,
  } = req.body || {};

  if (
    !UUID.test(device || '') ||
    !TYPES.includes(type) ||
    typeof name !== 'string' ||
    !name.trim()
  ) {
    return res.status(400).json({
      error:
        'Invalid family profile information.',
    });
  }

  try {
    const response = await supabaseRequest(
      'profiles',
      {
        method: 'POST',

        body: JSON.stringify({
          device_id: device,
          name: name.trim().slice(0, 40),
          type,
        }),
      }
    );

    const data = await response
      .json()
      .catch(() => []);

    if (!response.ok) {
      console.error(
        '[Family POST Error]',
        {
          status: response.status,
          message:
            data?.message || data?.hint,
        }
      );

      throw new Error(
        'Could not save family profile.'
      );
    }

    const item = data[0];

    return res.json({
      item: {
        id: item.id,
        name: item.name,
        type: item.type,
      },
    });

  } catch (error) {
    console.error(
      '[Family POST Failed]',
      error.message
    );

    return res.status(502).json({
      error:
        'Unable to save family profile.',
    });
  }
});

// ======================================================
// 12. DELETE FAMILY PROFILE
// ======================================================

app.delete(
  '/api/family/:id',
  async (req, res) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(503).json({
        error:
          'Family cloud storage is not configured.',
      });
    }

    const { id } = req.params;
    const device = req.query.device;

    if (
      !UUID.test(id || '') ||
      !UUID.test(device || '')
    ) {
      return res.status(400).json({
        error:
          'Invalid profile or device ID.',
      });
    }

    try {
      const response = await supabaseRequest(
        `profiles?id=eq.${id}&device_id=eq.${device}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error(
          `Supabase returned HTTP ${response.status}`
        );
      }

      return res.json({
        ok: true,
      });

    } catch (error) {
      console.error(
        '[Family DELETE Error]',
        error.message
      );

      return res.status(502).json({
        error:
          'Unable to delete family profile.',
      });
    }
  }
);

// ======================================================
// 13. FRONTEND STATIC FILE SERVING
// ======================================================

const currentFile =
  fileURLToPath(import.meta.url);

const currentDirectory =
  path.dirname(currentFile);

const distDirectory =
  path.join(currentDirectory, '../dist');

if (fs.existsSync(distDirectory)) {
  app.use(express.static(distDirectory));

  app.get('*', (_, res) => {
    res.sendFile(
      path.join(distDirectory, 'index.html')
    );
  });

} else {
  app.get('/', (_, res) => {
    res.json({
      name: 'AeroSage API',
      status: 'ok',
    });
  });
}

// ======================================================
// 14. START SERVER
// ======================================================

app.listen(PORT, () => {
  console.log('====================================');
  console.log('       AEROSAGE AI BACKEND');
  console.log('====================================');

  console.log(
    `Server running on port ${PORT}`
  );

  console.log(
    `Gemini model: ${process.env.GEMINI_MODEL || 'gemini-3.8-flash'}`
  );

  console.log(
    `Gemini key configured: ${Boolean(process.env.GEMINI_API_KEY)}`
  );

  console.log(
    `Supabase configured: ${Boolean(SUPABASE_URL && SUPABASE_KEY)}`
  );

  console.log('====================================');
});
