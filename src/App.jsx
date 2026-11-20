import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  Wind,
  Home,
  Bot,
  CalendarClock,
  Sprout,
  Users,
  Info,
  Loader2,
  AlertTriangle,
  Send,
  Trash2,
  Printer,
  Leaf,
} from 'lucide-react';
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const CATS = [
  ['Good', '#22c55e'],
  ['Satisfactory', '#84cc16'],
  ['Moderate', '#eab308'],
  ['Poor', '#f97316'],
  ['Very Poor', '#ef4444'],
  ['Severe', '#9f1239'],
];
const lvl = (a) => (a <= 50 ? 0 : a <= 100 ? 1 : a <= 200 ? 2 : a <= 300 ? 3 : a <= 400 ? 4 : 5);
const tier = (a) => (lvl(a) <= 1 ? 0 : lvl(a) <= 3 ? 1 : 2);
const EXPLAIN = [
  'Minimal impact expected.',
  'Sensitive people may notice minor discomfort.',
  'Breathing discomfort possible for people with lung/heart conditions, children and older adults.',
  'Prolonged exposure may cause discomfort for most people.',
  'Respiratory illness risk on prolonged exposure; avoid outdoor exertion.',
  'Affects healthy people and seriously impacts those with existing conditions. Minimise outdoor exposure.',
];
const ADV = {
  general: [
    'Enjoy outdoor time; ventilate freely.',
    'Reduce long heavy workouts outdoors if you feel irritation; ventilate for 10–15 min in the cleanest hours.',
    'Keep windows shut in peak hours, run a purifier, wear a fitted N95/FFP2 outdoors, avoid outdoor exercise.',
  ],
  child: [
    'Normal outdoor play is fine.',
    'Shorten intense outdoor play; prefer morning/late-afternoon cleaner windows.',
    'Move PE/play indoors, use child-sized masks only if properly fitted, keep indoor air clean where they sleep.',
  ],
  elderly: [
    'Regular walks are fine.',
    'Walk in the cleanest window; keep prescribed medicines handy.',
    'Stay indoors, avoid exertion outdoors, check in at least twice a day.',
  ],
  worker: [
    'Normal work; stay hydrated.',
    'Take breaks in cleaner spots; consider a mask during dusty tasks.',
    'Use a fitted N95/FFP2, shorten continuous exposure, rotate duties, schedule heavy work in the cleanest hours.',
  ],
};
const post = (u, b) =>
  fetch(API + u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  }).then((r) => r.json());
const Badge = ({ d }) =>
  d?.demo ? (
    <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">
      DEMO MODE – synthetic data
    </span>
  ) : (
    <span className="rounded bg-emerald-400/20 px-2 py-0.5 text-xs text-emerald-300">
      Live model data
    </span>
  );
const NAV = [
  ['dash', 'Air Quality', Wind],
  ['chat', 'AI Assistant', Bot],
  ['plan', 'Daily Planner', CalendarClock],
  ['indoor', 'Indoor Air', Home],
  ['impact', 'Impact', Sprout],
  ['family', 'Family', Users],
  ['about', 'About', Info],
];

export default function App() {
  const [page, setPage] = useState('home');
  const [city, setCity] = useState('Kolkata');
  const [d, setD] = useState(null);
  const [loading, setL] = useState(false);
  const [err, setErr] = useState(null);
  const [cloud, setCloud] = useState(false);
  const dev = useState(() => {
    let v;
    try {
      v = localStorage.getItem('aerosage_device');
      if (!v) {
        v = crypto.randomUUID();
        localStorage.setItem('aerosage_device', v);
      }
    } catch {
      v = crypto.randomUUID();
    }
    return v;
  })[0];
  const [fam, setFam] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('aerosage_family')) || [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    fetch(`${API}/api/family?device=${dev}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.enabled) {
          setCloud(true);
          setFam(j.items);
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!cloud)
      try {
        localStorage.setItem('aerosage_family', JSON.stringify(fam));
      } catch {}
  }, [fam, cloud]);
  const addM = async (name, type) => {
    if (cloud) {
      try {
        const r = await post('/api/family', { device: dev, name, type });
        if (r.item) return setFam((f) => [...f, r.item]);
      } catch {}
    }
    setFam((f) => [...f, { id: String(Date.now()), name, type }]);
  };
  const rmM = (id) => {
    setFam((f) => f.filter((x) => x.id !== id));
    if (cloud) fetch(`${API}/api/family/${id}?device=${dev}`, { method: 'DELETE' }).catch(() => {});
  };
  const load = async (c = city, demo = false) => {
    setL(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/api/aqi?city=${encodeURIComponent(c)}${demo ? '&demo=1' : ''}`);
      const j = await r.json();
      if (!r.ok) throw j;
      setD(j);
    } catch (e) {
      setErr(e.error ? e : { error: 'Cannot reach the server. Is it running?' });
    }
    setL(false);
  };
  const go = (p) => {
    setPage(p);
    if (!['home', 'about', 'indoor', 'impact'].includes(p) && !d && !loading) load();
  };
  const ctx = d && {
    place: d.place.name,
    aqi: d.current.aqi,
    category: d.current.category,
    pm25: d.current.pm25,
    pm10: d.current.pm10,
    no2: d.current.no2,
    o3: d.current.o3,
    timestamp: d.fetchedAt,
    demo: d.demo,
  };
  const needs = !['home', 'about', 'indoor', 'impact'].includes(page);
  return (
    <div className="min-h-screen">
      <nav
        className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-white/10 bg-navy-900/90 px-3 py-2 backdrop-blur"
        aria-label="Main"
      >
        <button
          onClick={() => setPage('home')}
          className="mr-2 flex items-center gap-2 font-bold text-teal-400"
        >
          <Leaf size={20} className="text-leaf" />
          <span className="bg-gradient-to-r from-teal-400 to-leaf bg-clip-text text-transparent">
            AeroSage AI
          </span>
        </button>
        {NAV.map(([k, l, I]) => (
          <button
            key={k}
            onClick={() => go(k)}
            aria-current={page === k}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm ${page === k ? 'bg-gradient-to-r from-teal-400/25 to-leaf/20 text-teal-200' : 'text-slate-300 hover:bg-white/5'}`}
          >
            <I size={15} />
            <span className="hidden sm:inline">{l}</span>
          </button>
        ))}
      </nav>
      <main className="mx-auto max-w-6xl p-4">
        {page === 'home' && (
          <Landing
            city={city}
            setCity={setCity}
            start={() => {
              setPage('dash');
              load();
            }}
          />
        )}
        {needs && !d && <Status loading={loading} err={err} load={load} city={city} />}
        {d && page === 'dash' && (
          <Dash d={d} city={city} setCity={setCity} load={load} loading={loading} err={err} />
        )}
        {d && page === 'chat' && <Chat ctx={ctx} fam={fam} />}
        {d && page === 'plan' && <Plan d={d} />}
        {page === 'indoor' && <Indoor d={d} />}
        {page === 'impact' && <Impact />}
        {d && page === 'family' && <Family d={d} fam={fam} add={addM} remove={rmM} cloud={cloud} />}
        {page === 'about' && <About />}
      </main>
      <footer className="mt-8 border-t border-white/10 px-4 py-6 text-center text-xs text-slate-400">
        <b className="text-teal-300">AeroSage AI</b> · Smarter Air. Healthier Living.
        <br />
        Data: Open-Meteo (CAMS model) · AI: Google Gemini · General information, not medical advice
      </footer>
    </div>
  );
}

function Status({ loading, err, load, city }) {
  return (
    <div className="card text-center" role="status">
      {loading ? (
        <>
          <Loader2 className="mx-auto animate-spin text-teal-400" />
          <p className="mt-2">Fetching air quality for {city}…</p>
        </>
      ) : err ? (
        <>
          <AlertTriangle className="mx-auto text-amber-400" />
          <p className="mt-2">{err.error || 'Something went wrong.'}</p>
          <div className="mt-3 flex justify-center gap-2">
            <button className="btn" onClick={() => load()}>
              Retry
            </button>
            <button className="btn" onClick={() => load(city, true)}>
              Use demo mode
            </button>
          </div>
        </>
      ) : (
        <button className="btn" onClick={() => load()}>
          Load air quality
        </button>
      )}
    </div>
  );
}

function Landing({ city, setCity, start }) {
  return (
    <section className="py-12 text-center">
      <Skyline />
      <h1 className="text-4xl font-extrabold sm:text-6xl">
        AeroSage <span className="text-teal-400">AI</span>
      </h1>
      <p className="mt-2 text-xl text-leaf">Smarter Air. Healthier Living.</p>
      <p className="mx-auto mt-4 max-w-xl text-slate-300">
        Your personal environmental advisor for severe winter smog: live air quality, a
        Gemini-powered assistant, smart daily routines, indoor air tips and transparent
        sustainability maths.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
        className="mx-auto mt-6 flex max-w-md gap-2"
      >
        <input
          className="inp"
          aria-label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Enter your city"
        />
        <button className="btn">Check air</button>
      </form>
      <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
        {[
          [
            'Real data first',
            'Open-Meteo/CAMS air quality; clearly-labelled demo mode if unavailable.',
          ],
          ['Explains why', 'Every tip comes with a reason and labelled estimates.'],
          ['Built for families', 'Profiles for children, elders and outdoor workers.'],
        ].map(([t, s]) => (
          <div key={t} className="card">
            <h3 className="font-semibold text-teal-300">{t}</h3>
            <p className="text-sm text-slate-300">{s}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-12 text-2xl font-bold">Everything you need on a smoggy day</h2>
      <div className="mt-4 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
        {[
          [Wind, 'Live air quality', 'AQI, PM2.5, PM10 and gases with a 3-day trend and forecast.'],
          [Bot, 'AI advisor', 'Ask in plain language; get reasoned, personalised advice.'],
          [CalendarClock, 'Daily planner', 'Cleanest hours for walks, school runs and work.'],
          [Home, 'Indoor air', 'Ventilation, purifier sizing and low-cost fixes.'],
          [Sprout, 'Impact calculator', 'Transparent, editable estimates of cost and CO₂ savings.'],
          [Users, 'Family mode', 'Profiles and printable safety reports for your household.'],
        ].map(([I, t, s]) => (
          <div key={t} className="card group hover:-translate-y-1">
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400/30 to-leaf/20 text-teal-300">
              <I size={20} />
            </div>
            <h3 className="font-semibold">{t}</h3>
            <p className="text-sm text-slate-300">{s}</p>
          </div>
        ))}
      </div>
      <button className="btn mt-8 px-8 py-3 text-lg" onClick={start}>
        Check my air now
      </button>
    </section>
  );
}

function Dash({ d, city, setCity, load, loading, err }) {
  const c = d.current,
    L = lvl(c.aqi),
    col = CATS[L][1];
  const data = d.series.map((s) => ({
    ...s,
    label: new Date(s.t).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
    }),
  }));
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(city);
        }}
        className="flex gap-2"
      >
        <input
          className="inp"
          aria-label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <button className="btn" disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </form>
      {err && (
        <p role="alert" className="rounded-xl bg-amber-400/20 p-3 text-amber-200">
          {err.error}{' '}
          <button className="underline" onClick={() => load(city, true)}>
            Use demo mode
          </button>
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card text-center">
          <p className="text-sm text-slate-300">
            {d.place.name}
            {d.place.admin ? `, ${d.place.admin}` : ''}
          </p>
          <div
            className="mx-auto my-3 grid h-40 w-40 place-items-center rounded-full"
            style={{ background: `conic-gradient(${col} ${Math.min(c.aqi, 500) / 5}%, #16304f 0)` }}
          >
            <div className="grid h-32 w-32 place-items-center rounded-full bg-navy-800">
              <div>
                <div className="text-4xl font-black" style={{ color: col }}>
                  {c.aqi}
                </div>
                <div className="text-xs">AQI (India)</div>
              </div>
            </div>
          </div>
          <p className="text-xl font-bold" style={{ color: col }}>
            {c.category}
          </p>
          <p className="mt-1 text-sm text-slate-300">{EXPLAIN[L]}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {CATS.map(([n, cc], i) => (
              <span
                key={n}
                className={`rounded px-1.5 text-[10px] text-black ${i === L ? 'ring-2 ring-white' : 'opacity-50'}`}
                style={{ background: cc }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
        <div className="card md:col-span-2">
          <h2 className="mb-2 font-semibold">Pollutants (µg/m³)</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['PM2.5', c.pm25],
              ['PM10', c.pm10],
              ['NO₂', c.no2],
              ['SO₂', c.so2],
              ['O₃', c.o3],
              ['CO', c.co],
            ].map(([n, v]) => (
              <div key={n} className="rounded-xl bg-navy-900 p-3">
                <div className="text-xs text-slate-400">{n}</div>
                <div className="text-xl font-bold">{v == null ? '–' : Math.round(v)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            <Badge d={d} /> Updated {new Date(d.fetchedAt).toLocaleString()} · Source: {d.source}
          </p>
        </div>
      </div>
      <div className="card">
        <h2 className="mb-2 font-semibold">
          AQI trend: past 3 days & forecast (approx., 24h-avg based)
        </h2>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity=".6" />
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity="0" />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f2038', border: 'none' }} />
              <Area dataKey="aqi" stroke="#2dd4bf" fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Chat({ ctx, fam }) {
  const [m, setM] = useState([
    { role: 'ai', text: `Hi! I'm AeroSage AI. Ask me anything about air quality in ${ctx.place}.` },
  ]);
  const [q, setQ] = useState('');
  const [b, setB] = useState(false);
  const send = async (t) => {
    t = t || q;
    if (!t.trim() || b) return;
    setQ('');
    const h = [...m, { role: 'user', text: t }];
    setM(h);
    setB(true);
    try {
      const r = await post('/api/chat', {
        message: t,
        history: m
          .slice(1)
          .map((x) => ({ role: x.role === 'ai' ? 'model' : 'user', text: x.text })),
        context: ctx,
        profile: fam,
      });
      setM([...h, { role: 'ai', text: r.text || r.error, ai: r.ai }]);
    } catch {
      setM([...h, { role: 'ai', text: 'Could not reach the server. Please check it is running.' }]);
    }
    setB(false);
  };
  return (
    <div className="card">
      <h2 className="font-semibold">AeroSage AI Assistant</h2>
      <p className="text-xs text-slate-400">
        Answers are AI-generated suggestions based on the readings shown; not medical advice.
      </p>
      <div className="my-3 flex flex-wrap gap-2">
        {[
          'Is it safe for my kids to play outside today?',
          'How do I make my bedroom air cleaner cheaply?',
          'Best time for a morning walk?',
        ].map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-white/15 px-3 py-1 text-xs hover:bg-white/5"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto" aria-live="polite">
        {m.map((x, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-xl p-3 text-sm ${x.role === 'user' ? 'ml-8 bg-teal-400/20' : 'mr-8 bg-navy-900'}`}
          >
            {x.text}
            {x.ai === true && <div className="mt-1 text-[10px] text-slate-500">AI-generated</div>}
          </div>
        ))}
        {b && <Loader2 className="animate-spin text-teal-400" />}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          className="inp"
          aria-label="Your question"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about your family, routine, home…"
        />
        <button className="btn" aria-label="Send">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function Plan({ d }) {
  const next = d.series
    .slice(d.nowIndex, d.nowIndex + 24)
    .map((s) => ({ ...s, h: new Date(s.t).getHours() }));
  const day = next.filter((s) => s.h >= 5 && s.h <= 21 && s.aqi != null);
  const best = [...day]
    .sort((a, b) => a.aqi - b.aqi)
    .slice(0, 3)
    .map((s) => s.h)
    .sort((a, b) => a - b);
  const T = tier(d.current.aqi);
  const fmt = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold">Best outdoor windows (next 24h)</h2>
        <p className="text-sm text-slate-300">
          Lowest forecast hours between 5am–9pm:{' '}
          <b className="text-leaf">{best.map(fmt).join(', ') || 'n/a'}</b>. <Badge d={d} />
        </p>
        <div className="mt-2 h-44">
          <ResponsiveContainer>
            <BarChart data={next}>
              <XAxis dataKey="h" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f2038', border: 'none' }} />
              <Bar dataKey="aqi">
                {next.map((s, i) => (
                  <Cell key={i} fill={best.includes(s.h) ? '#34d399' : CATS[lvl(s.aqi || 0)][1]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ['Everyone', ADV.general],
          ['Children', ADV.child],
          ['Elderly', ADV.elderly],
          ['Outdoor workers', ADV.worker],
        ].map(([n, a]) => (
          <div key={n} className="card">
            <h3 className="font-semibold text-teal-300">{n}</h3>
            <p className="text-sm">{a[T]}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 className="font-semibold text-teal-300">Commute & exercise</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            Prefer metro/bus/shared transport: fewer vehicles on the road lowers local emissions.
          </li>
          <li>
            Walk or cycle short trips in the green hours above; avoid busy roads at peak traffic.
          </li>
          <li>
            {T === 2
              ? 'Exercise indoors: bodyweight circuit, yoga, skipping rope — no equipment cost.'
              : 'Outdoor exercise is reasonable in the green hours; stop if you feel throat/chest irritation.'}
          </li>
        </ul>
      </div>
    </div>
  );
}

function Indoor({ d }) {
  const [area, setArea] = useState(12);
  const a = d?.current.aqi;
  const bad = a > 200;
  const sqft = area * 10.764;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="card">
        <h2 className="font-semibold">Ventilation now</h2>
        <p className="text-sm">
          {!d
            ? 'Load air quality (Air Quality tab) for a live recommendation.'
            : bad
              ? `AQI ${a}: keep windows closed in peak hours; ventilate 5–10 min only in the cleanest forecast hour (see Planner). Seal gaps with draught strips (low cost).`
              : `AQI ${a}: brief cross-ventilation is reasonable, especially while cooking or cleaning.`}
        </p>
      </div>
      <div className="card">
        <h2 className="font-semibold">Purifier sizing</h2>
        <label className="text-sm">
          Room area (m²)
          <input
            type="number"
            min="4"
            className="inp mt-1"
            value={area}
            onChange={(e) => setArea(+e.target.value || 0)}
          />
        </label>
        <p className="mt-2 text-sm">
          Rule of thumb (AHAM, ~8ft ceiling): CADR ≥ ⅔ of floor area →{' '}
          <b>
            ≈{Math.ceil((sqft * 2) / 3)} cfm (≈{Math.ceil(((sqft * 2) / 3) * 1.699)} m³/h)
          </b>
          . Choose a true HEPA filter; avoid ozone-emitting "ionisers".
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Budget option: a DIY Corsi–Rosenthal box (box fan + 4 MERV 13 filters) is widely reported
          to be an inexpensive way to clean room air.
        </p>
      </div>
      {[
        [
          'Cooking & smoke',
          'Use the chimney/exhaust fan or open a window while cooking; prefer LPG/induction over biomass; never burn waste, leaves or coal indoors; avoid incense/mosquito coils in closed rooms.',
        ],
        [
          'Dust',
          'Damp-mop and wipe instead of dry sweeping; use a vacuum with HEPA filter if possible; wash bedding weekly; keep door mats outside.',
        ],
        [
          'Avoid sources',
          'No smoking indoors, limit aerosol sprays/fresheners, and place the purifier in the bedroom first.',
        ],
      ].map(([t, s]) => (
        <div key={t} className="card">
          <h3 className="font-semibold text-teal-300">{t}</h3>
          <p className="text-sm">{s}</p>
        </div>
      ))}
    </div>
  );
}

const MODES = {
  car: ['Petrol car (1 person)', 0.17, 9],
  bike: ['Petrol two-wheeler', 0.05, 3],
  bus: ['City bus', 0.03, 1.5],
  metro: ['Metro/rail', 0.03, 1.5],
};
function Impact() {
  const [km, setKm] = useState(15);
  const [days, setDays] = useState(22);
  const [from, setFrom] = useState('car');
  const [to, setTo] = useState('metro');
  const [f, setF] = useState(
    Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, { e: v[1], c: v[2] }])),
  );
  const calc = (k) => ({ co2: f[k].e * km * days, cost: f[k].c * km * days });
  const A = calc(from),
    B = calc(to);
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold">Commute comparison (monthly)</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          {[
            ['One-way km/day', km, setKm],
            ['Days/month', days, setDays],
          ].map(([l, v, s]) => (
            <label key={l} className="text-sm">
              {l}
              <input
                type="number"
                className="inp mt-1"
                value={v}
                onChange={(e) => s(+e.target.value || 0)}
              />
            </label>
          ))}
          {[
            ['From', from, setFrom],
            ['To', to, setTo],
          ].map(([l, v, s]) => (
            <label key={l} className="text-sm">
              {l}
              <select className="inp mt-1" value={v} onChange={(e) => s(e.target.value)}>
                {Object.entries(MODES).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m[0]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-3 text-center sm:grid-cols-3">
          <div className="rounded-xl bg-navy-900 p-3">
            <div className="text-xs text-slate-400">Estimated CO₂e saved</div>
            <div className="text-2xl font-bold text-leaf">
              {Math.max(0, A.co2 - B.co2).toFixed(0)} kg
            </div>
          </div>
          <div className="rounded-xl bg-navy-900 p-3">
            <div className="text-xs text-slate-400">Estimated cost saved</div>
            <div className="text-2xl font-bold text-leaf">
              ₹{Math.max(0, A.cost - B.cost).toFixed(0)}
            </div>
          </div>
          <div className="rounded-xl bg-navy-900 p-3">
            <div className="text-xs text-slate-400">Why it matters</div>
            <div className="text-sm">Fewer vehicle-km means less tailpipe PM, NOx and CO₂</div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3 className="font-semibold text-amber-300">
          ⚠ Assumptions — edit to match your situation
        </h3>
        <p className="mb-2 text-xs text-slate-400">
          Indicative placeholder factors, NOT measured values. Verify against official sources (e.g.
          India GHG Program, DEFRA) and your local fares/fuel prices. Results are estimates only.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th>Mode</th>
              <th>kg CO₂e / passenger-km</th>
              <th>₹ / km</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(MODES).map(([k, m]) => (
              <tr key={k}>
                <td>{m[0]}</td>
                {['e', 'c'].map((p) => (
                  <td key={p}>
                    <input
                      type="number"
                      step="0.01"
                      className="inp my-0.5 w-28"
                      value={f[k][p]}
                      onChange={(e) => setF({ ...f, [k]: { ...f[k], [p]: +e.target.value || 0 } })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Swaps />
    </div>
  );
}

function Family({ d, fam, add, remove, cloud }) {
  const [n, setN] = useState('');
  const [t, setT] = useState('child');
  const T = tier(d.current.aqi);
  const G = { child: ADV.child, elderly: ADV.elderly, worker: ADV.worker, adult: ADV.general };
  const LBL = { child: 'Child', elderly: 'Elderly', worker: 'Outdoor worker', adult: 'Adult' };
  return (
    <div className="space-y-4">
      <form
        className="card noprint flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!n.trim()) return;
          add(n.trim(), t);
          setN('');
        }}
      >
        <input
          className="inp max-w-xs"
          aria-label="Name"
          placeholder="Family member name"
          value={n}
          onChange={(e) => setN(e.target.value)}
        />
        <select className="inp max-w-[12rem]" value={t} onChange={(e) => setT(e.target.value)}>
          {Object.entries(LBL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn">Add</button>
      </form>
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            Pollution Safety Report — {d.place.name} (AQI {d.current.aqi}, {d.current.category})
          </h2>
          <button className="btn noprint" aria-label="Print report" onClick={() => window.print()}>
            <Printer size={16} />
          </button>
        </div>
        <p className="text-xs text-slate-400">
          {new Date(d.fetchedAt).toLocaleString()} · <Badge d={d} />
        </p>
        {fam.length === 0 ? (
          <p className="mt-3 text-sm">
            Add members to generate tailored guidance.{' '}
            {cloud ? 'Synced to your cloud profile (Supabase).' : 'Saved on this device only.'}
          </p>
        ) : (
          fam.map((m) => (
            <div
              key={m.id}
              className="mt-3 flex items-start justify-between gap-2 border-t border-white/10 pt-2"
            >
              <div>
                <b>{m.name}</b> <span className="text-xs text-teal-300">{LBL[m.type]}</span>
                <p className="text-sm">{G[m.type][T]}</p>
              </div>
              <button
                aria-label={`Remove ${m.name}`}
                className="noprint text-slate-400 hover:text-red-400"
                onClick={() => remove(m.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
        <h3 className="mt-4 font-semibold text-teal-300">Community tips</h3>
        <ul className="list-disc pl-5 text-sm">
          <li>Don't burn waste or leaves; report open burning to local authorities.</li>
          <li>Carpool or use public transport; avoid idling engines.</li>
          <li>Check in on elderly neighbours and outdoor workers on high-AQI days.</li>
        </ul>
      </div>
    </div>
  );
}

function About() {
  return (
    <div className="card space-y-2 text-sm">
      <h2 className="text-lg font-semibold">About AeroSage AI</h2>
      <p>
        AeroSage AI turns air-quality data into practical daily decisions. Air data: Open-Meteo
        (CAMS model). AI: Google Gemini. AQI follows India's CPCB breakpoints, approximated from
        PM2.5/PM10.
      </p>
      <p>
        <b>Limits:</b> Model data can differ from nearby ground monitors; always check official
        CPCB/SAFAR/state sources for regulatory readings. AI suggestions are general information,
        not medical advice.
      </p>
      <p>
        Contact: add your team email in <code>src/App.jsx</code>.
      </p>
    </div>
  );
}

function Skyline() {
  return (
    <svg
      viewBox="0 0 400 110"
      className="mx-auto mb-4 w-full max-w-md"
      role="img"
      aria-label="City skyline under smog, with clean air above"
    >
      <defs>
        <linearGradient id="sm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2dd4bf" stopOpacity=".05" />
          <stop offset="1" stopColor="#f97316" stopOpacity=".55" />
        </linearGradient>
      </defs>
      <rect width="400" height="110" fill="url(#sm)" rx="16" />
      <g fill="#16304f">
        {[
          [20, 50, 30],
          [55, 30, 28],
          [90, 60, 25],
          [120, 20, 30],
          [155, 45, 28],
          [190, 35, 26],
          [222, 55, 30],
          [258, 25, 28],
          [292, 48, 26],
          [325, 38, 30],
          [360, 58, 24],
        ].map(([x, y, w], i) => (
          <rect key={i} x={x} y={y + 20} width={w} height={90 - y - 20} />
        ))}
      </g>
      <g fill="#fff" opacity=".12" className="animate-[float_6s_ease-in-out_infinite]">
        <ellipse cx="90" cy="60" rx="70" ry="12" />
        <ellipse cx="260" cy="72" rx="90" ry="14" />
      </g>
      <g fill="#34d399">
        <circle cx="340" cy="22" r="10" className="animate-[float_4s_ease-in-out_infinite]" />
        <path d="M336 22q4-8 8 0q-4 8-8 0z" fill="#0a1628" />
      </g>
    </svg>
  );
}
const N = ({ l, v, s, st = 1 }) => (
  <label className="text-xs text-slate-300">
    {l}
    <input
      type="number"
      step={st}
      className="inp mt-1"
      value={v}
      onChange={(e) => s(+e.target.value || 0)}
    />
  </label>
);
function Swaps() {
  const [dc, setDc] = useState(2),
    [du, setDu] = useState(60),
    [rc, setRc] = useState(300),
    [rl, setRl] = useState(500);
  const [w1, setW1] = useState(1500),
    [w2, setW2] = useState(900),
    [h, setH] = useState(6),
    [tr, setTr] = useState(8),
    [ex, setEx] = useState(8000),
    [gf, setGf] = useState(0.7);
  const dm = dc * du,
    rm = (rc * du) / (rl || 1),
    kwh = Math.max(0, ((w1 - w2) / 1000) * h * 30),
    sv = kwh * tr;
  const Box = ({ t, v }) => (
    <div className="rounded-xl bg-navy-900 p-3 text-center">
      <div className="text-xs text-slate-400">{t}</div>
      <div className="text-lg font-bold text-leaf">{v}</div>
    </div>
  );
  return (
    <>
      <div className="card">
        <h3 className="font-semibold text-teal-300">Disposable vs reusable (cost)</h3>
        <p className="mb-2 text-xs text-amber-200">
          All inputs are your own assumptions. Environmental benefit: fewer single-use items means
          less plastic waste and less temptation to burn it; we don't state a precise figure because
          it depends on the item.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <N l="Disposable ₹/item" v={dc} s={setDc} st={0.5} />
          <N l="Uses per month" v={du} s={setDu} />
          <N l="Reusable price ₹" v={rc} s={setRc} />
          <N l="Reusable lifetime (uses)" v={rl} s={setRl} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Box t="Disposable / month" v={`₹${dm.toFixed(0)}`} />
          <Box t="Reusable / month" v={`₹${rm.toFixed(0)}`} />
          <Box t="Break-even after" v={`${dc ? Math.ceil(rc / dc) : '–'} uses`} />
        </div>
      </div>
      <div className="card">
        <h3 className="font-semibold text-teal-300">Energy-efficient vs conventional appliance</h3>
        <p className="mb-2 text-xs text-amber-200">
          Use wattage from the product label. Grid factor 0.7 kg CO₂/kWh and tariff ₹8/kWh are
          placeholders; replace with your electricity bill and an official grid emission factor.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <N l="Conventional (W)" v={w1} s={setW1} />
          <N l="Efficient (W)" v={w2} s={setW2} />
          <N l="Hours/day" v={h} s={setH} st={0.5} />
          <N l="Tariff ₹/kWh" v={tr} s={setTr} st={0.5} />
          <N l="Extra price ₹" v={ex} s={setEx} />
          <N l="Grid kg CO₂/kWh" v={gf} s={setGf} st={0.05} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Box t="kWh saved/month" v={kwh.toFixed(0)} />
          <Box t="₹ saved/month" v={`₹${sv.toFixed(0)}`} />
          <Box t="Payback" v={sv ? `${(ex / sv).toFixed(1)} mo` : '–'} />
          <Box t="Est. CO₂ saved/month" v={`${(kwh * gf).toFixed(0)} kg`} />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Why it matters: less electricity drawn means less fuel burned at power plants, cutting CO₂
          and particulate emissions at source. Estimates only.
        </p>
      </div>
    </>
  );
}
