import { Suspense, lazy } from 'react';
import { ADV, bestHours, fmtHour, tier } from '../lib/aqi.js';
import { Badge, PageTitle, Spinner, UnknownAqiNote } from './common.jsx';

const HourlyChart = lazy(() => import('./AqiCharts.jsx').then((m) => ({ default: m.HourlyChart })));

export default function Plan({ d }) {
  const { next, best } = bestHours(d.series, d.nowIndex);
  const T = tier(d.current.aqi);
  const summary = best.length
    ? `Hourly AQI for the next 24 hours. Cleanest daytime hours: ${best.map(fmtHour).join(', ')}.`
    : 'Hourly AQI for the next 24 hours. No AQI values are available.';

  return (
    <div className="space-y-4">
      <PageTitle>Daily planner</PageTitle>
      {d.current.aqi == null && <UnknownAqiNote />}
      <section className="card">
        <h2 className="font-semibold">Best outdoor windows (next 24h)</h2>
        <p className="text-sm text-slate-300">
          Lowest forecast hours between 5am–9pm:{' '}
          <b className="text-leaf">{best.map(fmtHour).join(', ') || 'n/a'}</b>.{' '}
          <Badge demo={d.demo} />
        </p>
        <div role="img" aria-label={summary} className="mt-2 h-44">
          <Suspense fallback={<Spinner label="Loading chart…" />}>
            <HourlyChart data={next} best={best} />
          </Suspense>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-teal-300 underline-offset-2 hover:underline">
            View hourly data as a table
          </summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left">
              <caption className="sr-only">Estimated AQI for each of the next 24 hours</caption>
              <thead className="text-slate-300">
                <tr>
                  <th scope="col">Hour</th>
                  <th scope="col">AQI</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {next.map((s) => (
                  <tr key={s.t}>
                    <th scope="row" className="font-normal">
                      {fmtHour(s.h)}
                    </th>
                    <td>{s.aqi ?? 'n/a'}</td>
                    <td>{best.includes(s.h) ? 'Among the cleanest hours' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ['Everyone', ADV.general],
          ['Children', ADV.child],
          ['Elderly', ADV.elderly],
          ['Outdoor workers', ADV.worker],
        ].map(([n, a]) => (
          <section key={n} className="card">
            <h2 className="font-semibold text-teal-300">{n}</h2>
            <p className="text-sm">{a[T]}</p>
          </section>
        ))}
      </div>
      <section className="card">
        <h2 className="font-semibold text-teal-300">Commute &amp; exercise</h2>
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
        <p className="mt-2 text-xs text-slate-300">General information, not medical advice.</p>
      </section>
    </div>
  );
}
