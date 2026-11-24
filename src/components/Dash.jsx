import { Suspense, lazy, useMemo } from 'react';
import { CATS, EXPLAIN, dailySummary, lvl, sentenceForChart } from '../lib/aqi.js';
import { Badge, PageTitle, Spinner } from './common.jsx';

const TrendChart = lazy(() => import('./AqiCharts.jsx').then((m) => ({ default: m.TrendChart })));

const POLLUTANTS = [
  ['PM2.5', 'pm25'],
  ['PM10', 'pm10'],
  ['NO₂', 'no2'],
  ['SO₂', 'so2'],
  ['O₃', 'o3'],
  ['CO', 'co'],
];

export function AqiGauge({ aqi, category }) {
  const level = lvl(aqi);
  const cat = level === null ? null : CATS[level];
  const color = cat?.text ?? '#cbd5e1';
  return (
    <>
      <div
        aria-hidden="true"
        className="mx-auto my-3 grid h-40 w-40 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${cat?.fill ?? '#64748b'} ${Math.min(aqi ?? 0, 500) / 5}%, #16304f 0)`,
        }}
      >
        <div className="grid h-32 w-32 place-items-center rounded-full bg-navy-800">
          <div>
            <div className="text-4xl font-black" style={{ color }}>
              {aqi ?? 'N/A'}
            </div>
            <div className="text-xs">AQI (India)</div>
          </div>
        </div>
      </div>
      <p className="text-xl font-bold" style={{ color }}>
        <span className="sr-only">Air quality index {aqi ?? 'not available'}. Category: </span>
        {category}
      </p>
      <p className="mt-1 text-sm text-slate-300">
        {level === null ? 'No AQI could be calculated from the available data.' : EXPLAIN[level]}
      </p>
      <ol className="mt-3 flex flex-wrap justify-center gap-1 text-xs" aria-label="AQI categories">
        {CATS.map((c, i) => (
          <li
            key={c.name}
            aria-current={i === level ? 'true' : undefined}
            className={`rounded border px-1.5 py-0.5 ${i === level ? 'border-white bg-white/10 font-bold' : 'border-white/20 text-slate-300'}`}
            style={{ color: i === level ? c.text : undefined }}
          >
            {c.name} {c.range}
            {i === level && <span className="sr-only"> (current)</span>}
          </li>
        ))}
      </ol>
    </>
  );
}

export function DailySummaryTable({ summary, caption }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-teal-300 underline-offset-2 hover:underline">
        View chart data as a table
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-slate-300">
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Lowest AQI</th>
              <th scope="col">Average AQI</th>
              <th scope="col">Highest AQI</th>
              <th scope="col">Category (avg)</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((d) => (
              <tr key={d.date}>
                <th scope="row" className="font-normal">
                  {d.date}
                  {d.future ? ' (includes forecast)' : ''}
                </th>
                <td>{d.min}</td>
                <td>{d.avg}</td>
                <td>{d.max}</td>
                <td>{d.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function Dash({ d, city, setCity, load, loading, error }) {
  const c = d.current;
  const chartData = useMemo(
    () =>
      d.series.map((s) => ({
        ...s,
        label: new Date(s.t).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
        }),
      })),
    [d.series],
  );
  const summary = useMemo(() => dailySummary(d.series), [d.series]);

  return (
    <div className="space-y-4">
      <PageTitle>Air quality in {d.place.name}</PageTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(city);
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="dash-city" className="mb-1 block text-sm text-slate-300">
            Search a city
          </label>
          <input
            id="dash-city"
            className="inp"
            autoComplete="address-level2"
            maxLength={80}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <button className="btn" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && (
        <p role="alert" className="rounded-xl bg-amber-400/20 p-3 text-amber-200">
          {error.message}{' '}
          {error.canDemo && (
            <button className="underline" onClick={() => load(city, true)}>
              Use demo mode
            </button>
          )}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3" aria-busy={loading}>
        <section className="card text-center" aria-label="Current air quality index">
          <p className="text-sm text-slate-300">
            {d.place.name}
            {d.place.admin ? `, ${d.place.admin}` : ''}
          </p>
          <AqiGauge aqi={c.aqi} category={c.category} />
        </section>
        <section className="card md:col-span-2">
          <h2 className="mb-2 font-semibold">Pollutants (µg/m³)</h2>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {POLLUTANTS.map(([label, key]) => (
              <div key={key} className="rounded-xl bg-navy-900 p-3">
                <dt className="text-xs text-slate-300">{label}</dt>
                <dd className="text-xl font-bold">
                  {c[key] == null ? (
                    <>
                      <span aria-hidden="true">–</span>
                      <span className="sr-only">not available</span>
                    </>
                  ) : (
                    Math.round(c[key])
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-300">
            <Badge demo={d.demo} /> Updated {new Date(d.fetchedAt).toLocaleString()} · Source:{' '}
            {d.source}
          </p>
        </section>
      </div>
      <section className="card">
        <h2 className="mb-2 font-semibold">
          AQI trend: past 3 days &amp; forecast (approx., 24h-avg based)
        </h2>
        <div role="img" aria-label={sentenceForChart(summary)} className="h-64">
          <Suspense fallback={<Spinner label="Loading chart…" />}>
            <TrendChart data={chartData} />
          </Suspense>
        </div>
        <DailySummaryTable summary={summary} caption="Daily AQI summary for the chart above" />
      </section>
    </div>
  );
}
