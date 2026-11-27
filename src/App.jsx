import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, CalendarClock, Home, Info, Leaf, Sprout, Users, Wind } from 'lucide-react';
import { useAqi } from './hooks/useAqi.js';
import { useAssistantChat } from './hooks/useAssistantChat.js';
import { useFamilyProfiles } from './hooks/useFamilyProfiles.js';
import { buildAssistantContext } from './lib/assistantContext.js';
import { enableNavigationFocus } from './lib/focus.js';
import { formatClock } from './lib/time.js';
import About from './components/About.jsx';
import Chat from './components/Chat.jsx';
import Dash from './components/Dash.jsx';
import Family from './components/Family.jsx';
import Impact from './components/Impact.jsx';
import Indoor from './components/Indoor.jsx';
import Landing from './components/Landing.jsx';
import Plan from './components/Plan.jsx';
import Status from './components/Status.jsx';
import { StaleNotice } from './components/common.jsx';

const HOME_TITLE = 'AeroSage AI – Smart Environmental Health Assistant';

/**
 * Pages of the app. `needsData` pages show a loading/error state until air-quality data exists;
 * the others work without it.
 */
const PAGES = {
  dash: {
    label: 'Air Quality',
    icon: Wind,
    needsData: true,
    render: ({ aqi, airQuality }) => (
      <Dash
        airQuality={airQuality}
        aqiState={aqi}
        citySearch={{ city: aqi.city, setCity: aqi.setCity }}
      />
    ),
  },
  chat: {
    label: 'AI Assistant',
    icon: Bot,
    needsData: true,
    render: ({ chat, assistantContext }) => <Chat context={assistantContext} chat={chat} />,
  },
  plan: {
    label: 'Daily Planner',
    icon: CalendarClock,
    needsData: true,
    render: ({ airQuality }) => <Plan airQuality={airQuality} />,
  },
  indoor: {
    label: 'Indoor Air',
    icon: Home,
    needsData: false,
    render: ({ airQuality }) => <Indoor airQuality={airQuality} />,
  },
  impact: { label: 'Impact', icon: Sprout, needsData: false, render: () => <Impact /> },
  family: {
    label: 'Family',
    icon: Users,
    needsData: true,
    render: ({ airQuality, family }) => <Family airQuality={airQuality} family={family} />,
  },
  about: { label: 'About', icon: Info, needsData: false, render: () => <About /> },
};

const pageTitle = (page) => (page === 'home' ? HOME_TITLE : `${PAGES[page].label} – AeroSage AI`);

function NavBar({ page, onNavigate }) {
  return (
    <header>
      <nav
        className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-white/10 bg-navy-900/90 px-3 py-2 backdrop-blur"
        aria-label="Main"
      >
        <button
          onClick={() => onNavigate('home')}
          aria-current={page === 'home' ? 'page' : undefined}
          className="mr-2 flex items-center gap-2 rounded font-bold text-teal-400"
        >
          <Leaf aria-hidden="true" size={20} className="text-leaf" />
          <span className="bg-gradient-to-r from-teal-400 to-leaf bg-clip-text text-transparent">
            AeroSage AI
          </span>
          <span className="sr-only">home</span>
        </button>
        {Object.entries(PAGES).map(([id, { label, icon: Icon }]) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            aria-current={page === id ? 'page' : undefined}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm ${page === id ? 'bg-gradient-to-r from-teal-400/25 to-leaf/20 text-teal-200' : 'text-slate-300 hover:bg-white/5'}`}
          >
            <Icon aria-hidden="true" size={15} />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const aqi = useAqi();
  const family = useFamilyProfiles();
  const airQuality = aqi.data;
  const assistantContext = useMemo(() => buildAssistantContext(airQuality), [airQuality]);
  const chat = useAssistantChat({ context: assistantContext, familyMembers: family.members });

  const navigate = useCallback((next) => {
    enableNavigationFocus();
    setPage(next);
  }, []);

  const needsData = page !== 'home' && PAGES[page].needsData;
  const { load } = aqi;
  const idle = !airQuality && !aqi.loading && !aqi.error;
  useEffect(() => {
    if (needsData && idle) {
      load();
    }
  }, [needsData, idle, load]);

  useEffect(() => {
    document.title = pageTitle(page);
  }, [page]);

  const startFromLanding = () => {
    load(aqi.city);
    navigate('dash');
  };

  const renderPage = () => {
    if (page === 'home') {
      return <Landing city={aqi.city} setCity={aqi.setCity} start={startFromLanding} />;
    }
    if (needsData && !airQuality) {
      return (
        <Status
          loading={aqi.loading}
          error={aqi.error}
          load={aqi.load}
          city={aqi.city}
          title={PAGES[page].label}
        />
      );
    }
    return PAGES[page].render({ aqi, airQuality, family, chat, assistantContext });
  };

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>
      <NavBar page={page} onNavigate={navigate} />
      <div role="status" aria-live="polite" className="sr-only">
        {aqi.announcement}
      </div>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl space-y-4 p-4 focus:outline-none">
        {needsData && airQuality && aqi.isStale && (
          <StaleNotice
            fetchedAtText={formatClock(airQuality.fetchedAt)}
            reason={
              aqi.error
                ? 'The latest refresh failed.'
                : 'The data provider may be unavailable or the reading is old.'
            }
          />
        )}
        {renderPage()}
      </main>
      <footer className="mt-8 border-t border-white/10 px-4 py-6 text-center text-xs text-slate-300">
        <b className="text-teal-300">AeroSage AI</b> · Smarter Air. Healthier Living.
        <br />
        Smart Environmental Health Assistant · Data: Open-Meteo (CAMS model) · AI: Google Gemini ·
        General information, not medical advice
      </footer>
    </div>
  );
}
