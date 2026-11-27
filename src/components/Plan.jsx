import { Suspense, lazy } from 'react';
import { ADVICE, adviceTier, findBestHours, formatHour } from '../lib/aqi.js';
import { DataBadge, PageTitle, Spinner, UnknownAqiNote } from './common.jsx';

const HourlyChart = lazy(() =>
  import('./AqiCharts.jsx').then((module) => ({ default: module.HourlyChart })),
);

const AUDIENCES = [
  ['Everyone', 'general'],
  ['Children', 'child'],
  ['Elderly', 'elderly'],
  ['Outdoor workers', 'worker'],
];

const KIND_LABEL = { now: 'Now (model estimate)', forecast: 'Forecast' };

const describeHourly = (best) =>
  best.length
    ? `Forecast AQI for the next 24 hours. Cleanest daytime hours: ${best.map(formatHour).join(', ')}.`
    : 'Forecast AQI for the next 24 hours. No AQI values are available.';

/** Daily planner: the cleanest forecast hours and tailored guidance by audience. */
export default function Plan({ airQuality }) {
  const { next, best } = findBestHours(airQuality.series, airQuality.nowIndex);
  const tier = adviceTier(airQuality.current.aqi);

  return (
    <div className="space-y-4">
      <PageTitle>Daily planner</PageTitle>
      {airQuality.current.aqi == null && <UnknownAqiNote />}
      <section className="card">
        <h2 className="font-semibold">Best outdoor windows (next 24h, forecast)</h2>
        <p className="text-sm text-slate-300">
          Lowest forecast hours between 5am–9pm, city local time:{' '}
          <b className="text-leaf">{best.map(formatHour).join(', ') || 'n/a'}</b>.{' '}
          <DataBadge demo={airQuality.demo} />
        </p>
        <div role="img" aria-label={describeHourly(best)} className="mt-2 h-44">
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
                  <th scope="col">Type</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {next.map((point) => (
                  <tr key={point.t}>
                    <th scope="row" className="font-normal">
                      {formatHour(point.hour)}
                    </th>
                    <td>{point.aqi ?? 'n/a'}</td>
                    <td>{KIND_LABEL[point.kind]}</td>
                    <td>{best.includes(point.hour) ? 'Among the cleanest hours' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {AUDIENCES.map(([title, key]) => (
          <section key={key} className="card">
            <h2 className="font-semibold text-teal-300">{title}</h2>
            <p className="text-sm">{ADVICE[key][tier]}</p>
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
            {tier === 2
              ? 'Exercise indoors: bodyweight circuit, yoga, skipping rope — no equipment cost.'
              : 'Outdoor exercise is reasonable in the green hours; stop if you feel throat/chest irritation.'}
          </li>
        </ul>
        <p className="mt-2 text-xs text-slate-300">General information, not medical advice.</p>
      </section>
    </div>
  );
}
