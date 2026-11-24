import { useState } from 'react';
import { MODES, commuteSavings, defaultFactors, monthlyTravel } from '../lib/impact.js';
import { NumberField, PageTitle } from './common.jsx';
import Swaps from './Swaps.jsx';

export default function Impact() {
  const [km, setKm] = useState(15);
  const [days, setDays] = useState(22);
  const [from, setFrom] = useState('car');
  const [to, setTo] = useState('metro');
  const [f, setF] = useState(defaultFactors);
  const saved = commuteSavings(monthlyTravel(f[from], km, days), monthlyTravel(f[to], km, days));

  const select = (id, label, value, setValue) => (
    <label htmlFor={id} className="text-xs text-slate-300">
      {label}
      <select id={id} className="inp mt-1" value={value} onChange={(e) => setValue(e.target.value)}>
        {Object.entries(MODES).map(([k, m]) => (
          <option key={k} value={k}>
            {m[0]}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <PageTitle>Environmental impact</PageTitle>
      <section className="card">
        <h2 className="font-semibold">Commute comparison (monthly)</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          <NumberField label="Distance travelled per day (km)" value={km} onChange={setKm} />
          <NumberField label="Days/month" value={days} onChange={setDays} />
          {select('mode-from', 'From', from, setFrom)}
          {select('mode-to', 'To', to, setTo)}
        </div>
        <div className="mt-4 grid gap-3 text-center sm:grid-cols-3" aria-live="polite">
          <div className="rounded-xl bg-navy-900 p-3">
            <div className="text-xs text-slate-300">Estimated CO₂e saved</div>
            <div className="text-2xl font-bold text-leaf">{saved.co2.toFixed(0)} kg</div>
          </div>
          <div className="rounded-xl bg-navy-900 p-3">
            <div className="text-xs text-slate-300">Estimated cost saved</div>
            <div className="text-2xl font-bold text-leaf">₹{saved.cost.toFixed(0)}</div>
          </div>
          <div className="rounded-xl bg-navy-900 p-3">
            <div className="text-xs text-slate-300">Why it matters</div>
            <div className="text-sm">Fewer vehicle-km means less tailpipe PM, NOx and CO₂</div>
          </div>
        </div>
      </section>
      <section className="card">
        <h2 className="font-semibold text-amber-300">
          ⚠ Assumptions — edit to match your situation
        </h2>
        <p className="mb-2 text-xs text-slate-300">
          Indicative placeholder factors, NOT measured values. Verify against official sources (e.g.
          India GHG Program, DEFRA) and your local fares/fuel prices. Results are estimates only.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Editable emission and cost factors per travel mode
            </caption>
            <thead className="text-slate-300">
              <tr>
                <th scope="col">Mode</th>
                <th scope="col">kg CO₂e / passenger-km</th>
                <th scope="col">₹ / km</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(MODES).map(([k, m]) => (
                <tr key={k}>
                  <th scope="row" className="font-normal">
                    {m[0]}
                  </th>
                  {[
                    ['e', 'kg CO₂e per passenger-km'],
                    ['c', 'rupees per km'],
                  ].map(([p, unit]) => (
                    <td key={p}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`${m[0]}: ${unit}`}
                        className="inp my-0.5 w-28"
                        value={f[k][p]}
                        onChange={(e) =>
                          setF({ ...f, [k]: { ...f[k], [p]: Number(e.target.value) || 0 } })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Swaps />
    </div>
  );
}
