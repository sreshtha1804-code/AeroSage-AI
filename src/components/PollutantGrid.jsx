const POLLUTANTS = [
  ['PM2.5', 'pm25'],
  ['PM10', 'pm10'],
  ['NO₂', 'no2'],
  ['SO₂', 'so2'],
  ['O₃', 'o3'],
  ['CO', 'co'],
];

/** Current pollutant concentrations with their units and, when known, their AQI sub-index. */
export default function PollutantGrid({ current, units }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
      {POLLUTANTS.map(([label, key]) => {
        const value = current[key];
        const subIndex = current.subIndices?.[key];
        return (
          <div key={key} className="rounded-xl bg-navy-900 p-3">
            <dt className="text-xs text-slate-300">{label}</dt>
            <dd className="text-xl font-bold">
              {value == null ? (
                <>
                  <span aria-hidden="true">–</span>
                  <span className="sr-only">not available</span>
                </>
              ) : (
                <>
                  {Math.round(value)}{' '}
                  <span className="text-xs font-normal text-slate-300">
                    {units?.[key] ?? 'µg/m³'}
                  </span>
                </>
              )}
            </dd>
            {Number.isFinite(subIndex) && (
              <dd className="text-xs text-slate-300">
                Sub-index {subIndex}
                {current.dominantPollutant === key && ' · main pollutant'}
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
