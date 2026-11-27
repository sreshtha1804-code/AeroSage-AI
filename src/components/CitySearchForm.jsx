import { MAX_CITY_LENGTH } from '../constants.js';

/**
 * City search used on the landing page and the dashboard.
 * `error` links the field to its message for screen readers.
 */
export default function CitySearchForm({
  id,
  city,
  onCityChange,
  onSubmit,
  submitLabel,
  busy = false,
  visibleLabel = true,
  error = null,
  className = '',
}) {
  const errorId = `${id}-error`;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={className}
    >
      <div className="min-w-[12rem] flex-1">
        <label
          htmlFor={id}
          className={visibleLabel ? 'mb-1 block text-sm text-slate-300' : 'sr-only'}
        >
          {visibleLabel ? 'Search a city' : 'City'}
        </label>
        <input
          id={id}
          className="inp"
          autoComplete="address-level2"
          maxLength={MAX_CITY_LENGTH}
          value={city}
          placeholder={visibleLabel ? undefined : 'Enter your city'}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onCityChange(event.target.value)}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-amber-200">
            {error}
          </p>
        )}
      </div>
      <button className="btn" disabled={busy}>
        {busy ? 'Searching…' : submitLabel}
      </button>
    </form>
  );
}
