import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { shouldFocusHeading } from '../lib/focus.js';

/** Page `h1`. Receives focus after in-app navigation so screen-reader users hear the new page. */
export function PageTitle({ children, className = 'text-2xl font-bold' }) {
  const heading = useRef(null);
  useEffect(() => {
    if (shouldFocusHeading()) {
      heading.current?.focus();
    }
  }, []);
  return (
    <h1 ref={heading} tabIndex={-1} className={`${className} focus:outline-none`}>
      {children}
    </h1>
  );
}

/** Says whether data is live model data or synthetic demo data. */
export const DataBadge = ({ demo }) =>
  demo ? (
    <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">
      DEMO MODE – synthetic data
    </span>
  ) : (
    <span className="rounded bg-emerald-400/20 px-2 py-0.5 text-xs text-emerald-300">
      Live model data
    </span>
  );

export const Spinner = ({ label }) => (
  <span role="status" className="inline-flex items-center gap-2">
    <Loader2 aria-hidden="true" className="animate-spin text-teal-400" />
    <span>{label}</span>
  </span>
);

export const UnknownAqiNote = () => (
  <p role="note" className="rounded-xl bg-amber-400/20 p-3 text-sm text-amber-200">
    An AQI value is not available for this location right now, so the guidance below is cautious and
    general. Check official CPCB / state sources before deciding.
  </p>
);

/** Labelled number input used by the calculators. */
export const NumberField = ({ label, value, onChange, step = 1, min = 0 }) => (
  <label className="text-xs text-slate-300">
    {label}
    <input
      type="number"
      step={step}
      min={min}
      className="inp mt-1"
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
    />
  </label>
);

/** Shown on every data page when the displayed reading may be out of date. */
export const StaleNotice = ({ fetchedAtText, reason }) => (
  <p
    role="status"
    className="rounded-xl border border-amber-400/50 bg-amber-400/15 p-3 text-sm text-amber-100"
  >
    <b>Stale data.</b> {reason} Showing the last valid reading, retrieved {fetchedAtText}. Values
    may have changed.
  </p>
);
