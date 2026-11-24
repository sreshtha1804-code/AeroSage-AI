import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, CalendarClock, Home, Info, Leaf, Sprout, Users, Wind } from 'lucide-react';
import { useAqi } from './hooks/useAqi.js';
import { createFamilyMember, deleteFamilyMember, getFamily } from './lib/api.js';
import { enableNavigationFocus } from './lib/focus.js';
import { getDeviceId, loadFamily, saveFamily, uid } from './lib/storage.js';
import About from './components/About.jsx';
import Chat from './components/Chat.jsx';
import Dash from './components/Dash.jsx';
import Family from './components/Family.jsx';
import Impact from './components/Impact.jsx';
import Indoor from './components/Indoor.jsx';
import Landing from './components/Landing.jsx';
import Plan from './components/Plan.jsx';
import Status from './components/Status.jsx';

const NAV = [
  ['dash', 'Air Quality', Wind],
  ['chat', 'AI Assistant', Bot],
  ['plan', 'Daily Planner', CalendarClock],
  ['indoor', 'Indoor Air', Home],
  ['impact', 'Impact', Sprout],
  ['family', 'Family', Users],
  ['about', 'About', Info],
];
const TITLES = Object.fromEntries(NAV.map(([k, label]) => [k, label]));
// Pages that work without air-quality data.
const STANDALONE = ['home', 'about', 'indoor', 'impact'];

export default function App() {
  const [page, setPage] = useState('home');
  const { city, setCity, data, loading, error, load } = useAqi('Kolkata');
  const [cloud, setCloud] = useState(false);
  const [device] = useState(getDeviceId);
  const [fam, setFam] = useState(loadFamily);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    getFamily(device)
      .then((j) => {
        if (j.enabled) {
          setCloud(true);
          setFam(j.items);
        }
      })
      .catch(() => {});
  }, [device]);

  useEffect(() => {
    if (!cloud) saveFamily(fam);
  }, [fam, cloud]);

  useEffect(() => {
    document.title =
      page === 'home'
        ? 'AeroSage AI – Smarter Air. Healthier Living.'
        : `${TITLES[page]} – AeroSage AI`;
  }, [page]);

  const addMember = async (name, type) => {
    if (cloud) {
      try {
        const r = await createFamilyMember({ device, name, type });
        if (r.item) return setFam((f) => [...f, r.item]);
      } catch {
        /* fall back to on-device storage below */
      }
    }
    setFam((f) => [...f, { id: uid(), name, type }]);
  };

  const removeMember = (id) => {
    setFam((f) => f.filter((x) => x.id !== id));
    if (cloud) deleteFamilyMember(id, device).catch(() => {});
  };

  const go = useCallback(
    (p) => {
      enableNavigationFocus();
      setPage(p);
      if (!STANDALONE.includes(p) && !data && !loading) load();
    },
    [data, loading, load],
  );

  const ctx = useMemo(
    () =>
      data && {
        place: data.place.name,
        aqi: data.current.aqi,
        category: data.current.category,
        pm25: data.current.pm25,
        pm10: data.current.pm10,
        no2: data.current.no2,
        o3: data.current.o3,
        timestamp: data.fetchedAt,
        demo: data.demo,
      },
    [data],
  );

  const needsData = !STANDALONE.includes(page);
  const announcement = loading
    ? `Loading air quality for ${city}`
    : error
      ? `Error: ${error.message}`
      : data
        ? `Air quality for ${data.place.name}: AQI ${data.current.aqi ?? 'unavailable'}, ${data.current.category}`
        : '';

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>
      <header>
        <nav
          className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-white/10 bg-navy-900/90 px-3 py-2 backdrop-blur"
          aria-label="Main"
        >
          <button
            onClick={() => go('home')}
            aria-current={page === 'home' ? 'page' : undefined}
            className="mr-2 flex items-center gap-2 rounded font-bold text-teal-400"
          >
            <Leaf aria-hidden="true" size={20} className="text-leaf" />
            <span className="bg-gradient-to-r from-teal-400 to-leaf bg-clip-text text-transparent">
              AeroSage AI
            </span>
            <span className="sr-only">home</span>
          </button>
          {NAV.map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => go(k)}
              aria-current={page === k ? 'page' : undefined}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm ${page === k ? 'bg-gradient-to-r from-teal-400/25 to-leaf/20 text-teal-200' : 'text-slate-300 hover:bg-white/5'}`}
            >
              <Icon aria-hidden="true" size={15} />
              <span className="sr-only sm:not-sr-only">{label}</span>
            </button>
          ))}
        </nav>
      </header>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl p-4 focus:outline-none">
        {page === 'home' && (
          <Landing
            city={city}
            setCity={setCity}
            start={() => {
              go('dash');
              load(city);
            }}
          />
        )}
        {needsData && !data && (
          <Status loading={loading} error={error} load={load} city={city} title={TITLES[page]} />
        )}
        {data && page === 'dash' && (
          <Dash
            d={data}
            city={city}
            setCity={setCity}
            load={load}
            loading={loading}
            error={error}
          />
        )}
        {data && page === 'chat' && (
          <Chat ctx={ctx} fam={fam} messages={messages} setMessages={setMessages} />
        )}
        {data && page === 'plan' && <Plan d={data} />}
        {page === 'indoor' && <Indoor d={data} />}
        {page === 'impact' && <Impact />}
        {data && page === 'family' && (
          <Family d={data} fam={fam} add={addMember} remove={removeMember} cloud={cloud} />
        )}
        {page === 'about' && <About />}
      </main>
      <footer className="mt-8 border-t border-white/10 px-4 py-6 text-center text-xs text-slate-300">
        <b className="text-teal-300">AeroSage AI</b> · Smarter Air. Healthier Living.
        <br />
        Data: Open-Meteo (CAMS model) · AI: Google Gemini · General information, not medical advice
      </footer>
    </div>
  );
}
