import { AlertTriangle } from 'lucide-react';
import { PageTitle, Spinner } from './common.jsx';

function ErrorPanel({ error, onRetry, onDemo }) {
  return (
    <div role="alert">
      <AlertTriangle aria-hidden="true" className="mx-auto text-amber-400" />
      <p className="mt-2">{error.message}</p>
      <div className="mt-3 flex justify-center gap-2">
        <button className="btn" onClick={onRetry}>
          Retry
        </button>
        {error.canDemo && (
          <button className="btn" onClick={onDemo}>
            Use demo mode
          </button>
        )}
      </div>
    </div>
  );
}

/** Shown on data pages until the first reading arrives: loading, error (with retry), or a load prompt. */
export default function Status({ loading, error, load, city, title }) {
  let body = (
    <button className="btn" onClick={() => load(city)}>
      Load air quality
    </button>
  );
  if (loading) {
    body = <Spinner label={`Fetching air quality for ${city}…`} />;
  } else if (error) {
    body = <ErrorPanel error={error} onRetry={() => load(city)} onDemo={() => load(city, true)} />;
  }

  return (
    <section className="card text-center" aria-busy={loading}>
      <PageTitle className="sr-only">{title}</PageTitle>
      {body}
    </section>
  );
}
