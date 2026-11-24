import { AlertTriangle } from 'lucide-react';
import { PageTitle, Spinner } from './common.jsx';

export default function Status({ loading, error, load, city, title }) {
  return (
    <section className="card text-center" aria-busy={loading}>
      <PageTitle className="sr-only">{title}</PageTitle>
      {loading ? (
        <Spinner label={`Fetching air quality for ${city}…`} />
      ) : error ? (
        <div role="alert">
          <AlertTriangle aria-hidden="true" className="mx-auto text-amber-400" />
          <p className="mt-2">{error.message}</p>
          <div className="mt-3 flex justify-center gap-2">
            <button className="btn" onClick={() => load(city)}>
              Retry
            </button>
            {error.canDemo && (
              <button className="btn" onClick={() => load(city, true)}>
                Use demo mode
              </button>
            )}
          </div>
        </div>
      ) : (
        <button className="btn" onClick={() => load(city)}>
          Load air quality
        </button>
      )}
    </section>
  );
}
