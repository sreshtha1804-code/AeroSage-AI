import { CATEGORIES, CATEGORY_EXPLANATIONS, UNKNOWN_FILL, categoryLevel } from '../lib/aqi.js';

const MAX_AQI = 500;
const NEUTRAL_TEXT = '#cbd5e1';

const describeBasis = ({ basis, pollutantsUsed }) => {
  if (basis === 'full') {
    return `Estimated CPCB-style AQI from ${pollutantsUsed} pollutants`;
  }
  if (basis === 'partial') {
    return `Estimated CPCB-style AQI from ${pollutantsUsed} pollutant${pollutantsUsed === 1 ? '' : 's'} only (fewer than the 3 CPCB normally requires)`;
  }
  if (basis === 'synthetic') {
    return 'Synthetic value for demonstration';
  }
  return 'No AQI could be estimated';
};

/** AQI as a gauge plus text: the category is always stated in words, never by colour alone. */
export default function AqiGauge({ aqi, category, aqiMeta }) {
  const level = categoryLevel(aqi);
  const palette = level === null ? null : CATEGORIES[level];
  const color = palette?.text ?? NEUTRAL_TEXT;

  return (
    <>
      <div
        aria-hidden="true"
        className="mx-auto my-3 grid h-40 w-40 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${palette?.fill ?? UNKNOWN_FILL} ${Math.min(aqi ?? 0, MAX_AQI) / 5}%, #16304f 0)`,
        }}
      >
        <div className="grid h-32 w-32 place-items-center rounded-full bg-navy-800">
          <div>
            <div className="text-4xl font-black" style={{ color }}>
              {aqi ?? 'N/A'}
            </div>
            <div className="text-xs">Estimated AQI</div>
          </div>
        </div>
      </div>
      <p className="text-xl font-bold" style={{ color }}>
        <span className="sr-only">
          Estimated air quality index {aqi ?? 'not available'}. Category:{' '}
        </span>
        {category}
      </p>
      <p className="mt-1 text-sm text-slate-300">
        {level === null
          ? 'No AQI could be calculated from the available data.'
          : CATEGORY_EXPLANATIONS[level]}
      </p>
      {aqiMeta && <p className="mt-1 text-xs text-slate-300">{describeBasis(aqiMeta)}.</p>}
      <ol className="mt-3 flex flex-wrap justify-center gap-1 text-xs" aria-label="AQI categories">
        {CATEGORIES.map((item, index) => (
          <li
            key={item.name}
            aria-current={index === level ? 'true' : undefined}
            className={`rounded border px-1.5 py-0.5 ${index === level ? 'border-white bg-white/10 font-bold' : 'border-white/20 text-slate-300'}`}
            style={{ color: index === level ? item.text : undefined }}
          >
            {item.name} {item.range}
            {index === level && <span className="sr-only"> (current)</span>}
          </li>
        ))}
      </ol>
    </>
  );
}
