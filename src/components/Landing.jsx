import { Bot, CalendarClock, Home, Sprout, Users, Wind } from 'lucide-react';
import CitySearchForm from './CitySearchForm.jsx';
import { PageTitle } from './common.jsx';
import Skyline from './Skyline.jsx';

const PILLARS = [
  ['Real data first', 'Open-Meteo/CAMS air quality; clearly-labelled demo mode if unavailable.'],
  ['Explains why', 'Every tip comes with a reason and labelled estimates.'],
  ['Built for families', 'Profiles for children, elders and outdoor workers.'],
];

const FEATURES = [
  [Wind, 'Live air quality', 'AQI, PM2.5, PM10 and gases with a 3-day trend and forecast.'],
  [Bot, 'AI advisor', 'Ask in plain language; get reasoned, personalised advice.'],
  [CalendarClock, 'Daily planner', 'Cleanest hours for walks, school runs and work.'],
  [Home, 'Indoor air', 'Ventilation, purifier sizing and low-cost fixes.'],
  [Sprout, 'Impact calculator', 'Transparent, editable estimates of cost and CO₂ savings.'],
  [Users, 'Family mode', 'Profiles and printable safety reports for your household.'],
];

export default function Landing({ city, setCity, start }) {
  return (
    <section className="py-12 text-center">
      <Skyline />
      <PageTitle className="text-4xl font-extrabold sm:text-6xl">
        AeroSage <span className="text-teal-400">AI</span>
      </PageTitle>
      <p className="mt-2 text-xl text-leaf">Smarter Air. Healthier Living.</p>
      <p className="mx-auto mt-4 max-w-xl text-slate-300">
        Your Smart Environmental Health Assistant for severe winter smog: live air quality, a
        Gemini-powered assistant, smart daily routines, indoor air tips and transparent
        sustainability maths.
      </p>
      <CitySearchForm
        id="home-city"
        city={city}
        onCityChange={setCity}
        onSubmit={start}
        submitLabel="Check air"
        visibleLabel={false}
        className="mx-auto mt-6 flex max-w-md gap-2"
      />
      <h2 className="mt-10 sr-only">Why AeroSage AI</h2>
      <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
        {PILLARS.map(([t, s]) => (
          <div key={t} className="card">
            <h3 className="font-semibold text-teal-300">{t}</h3>
            <p className="text-sm text-slate-300">{s}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-12 text-2xl font-bold">Everything you need on a smoggy day</h2>
      <div className="mt-4 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([Icon, t, s]) => (
          <div key={t} className="card group hover:-translate-y-1">
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400/30 to-leaf/20 text-teal-300">
              <Icon aria-hidden="true" size={20} />
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
