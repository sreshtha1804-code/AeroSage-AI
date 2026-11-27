import { formatAge, formatModelTime } from '../lib/time.js';

const DATA_TYPE_LABEL = {
  model: 'Model estimate (CAMS atmospheric model) — not a ground-station measurement',
  synthetic: 'Synthetic demonstration data — not real',
};

/** Where the numbers come from, what kind of data they are, and how the AQI was estimated. */
export default function DataProvenance({ data, dataAgeMs }) {
  const { current, place, aqiMeta } = data;
  const rows = [
    ['Selected city', [place.name, place.admin, place.country].filter(Boolean).join(', ')],
    ['Provider', data.provider],
    ['Data type', DATA_TYPE_LABEL[data.dataType] ?? data.dataType],
    [
      'Model time (city local)',
      `${formatModelTime(current.observedAt)}${place.timezone ? ` · ${place.timezone}` : ''}`,
    ],
    ['Retrieved', `${new Date(data.fetchedAt).toLocaleString()} (${formatAge(dataAgeMs)})`],
    ['Forecast', 'Hours after the current time in the charts are predictions, not measurements.'],
  ];

  return (
    <section className="card" aria-label="Data sources and method">
      <h2 className="mb-2 font-semibold">About this data</h2>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-300">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {aqiMeta && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-teal-300 underline-offset-2 hover:underline">
            How the AQI is estimated
          </summary>
          <p className="mt-1 text-slate-300">{aqiMeta.method}</p>
          <p className="mt-1 text-slate-300">{data.source}</p>
        </details>
      )}
    </section>
  );
}
