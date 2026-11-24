import { useState } from 'react';
import { purifierCadr } from '../lib/impact.js';
import { PageTitle } from './common.jsx';

const TIPS = [
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
];

export default function Indoor({ d }) {
  const [area, setArea] = useState(12);
  const aqi = d?.current.aqi;
  const { cfm, m3h } = purifierCadr(area);

  let ventilation;
  if (!d) ventilation = 'Load air quality (Air Quality tab) for a live recommendation.';
  else if (aqi == null)
    ventilation =
      'AQI is unavailable right now. Ventilate briefly only when you can smell no smoke or dust outside.';
  else if (aqi > 200)
    ventilation = `AQI ${aqi}: keep windows closed in peak hours; ventilate 5–10 min only in the cleanest forecast hour (see Planner). Seal gaps with draught strips (low cost).`;
  else
    ventilation = `AQI ${aqi}: brief cross-ventilation is reasonable, especially while cooking or cleaning.`;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <PageTitle>Indoor air quality</PageTitle>
      </div>
      <section className="card">
        <h2 className="font-semibold">Ventilation now</h2>
        <p className="text-sm">{ventilation}</p>
      </section>
      <section className="card">
        <h2 className="font-semibold">Purifier sizing</h2>
        <label className="text-sm">
          Room area (m²)
          <input
            type="number"
            min="4"
            className="inp mt-1"
            value={area}
            onChange={(e) => setArea(Number(e.target.value) || 0)}
          />
        </label>
        <p className="mt-2 text-sm">
          Rule of thumb (AHAM, ~8ft ceiling): CADR ≥ ⅔ of floor area →{' '}
          <b>
            ≈{cfm} cfm (≈{m3h} m³/h)
          </b>
          . Choose a true HEPA filter; avoid ozone-emitting &quot;ionisers&quot;.
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Budget option: a DIY Corsi–Rosenthal box (box fan + 4 MERV 13 filters) is widely reported
          to be an inexpensive way to clean room air.
        </p>
      </section>
      {TIPS.map(([t, s]) => (
        <section key={t} className="card">
          <h2 className="font-semibold text-teal-300">{t}</h2>
          <p className="text-sm">{s}</p>
        </section>
      ))}
    </div>
  );
}
