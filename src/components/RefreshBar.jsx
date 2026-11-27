import { RefreshCw } from 'lucide-react';
import { formatAge, formatClock } from '../lib/time.js';

/** Last-updated information, the staleness label and the manual refresh control. */
export default function RefreshBar({ data, dataAgeMs, isStale, refreshing, onRefresh }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
      <p>
        Retrieved {formatClock(data.fetchedAt)} ({formatAge(dataAgeMs)})
        {isStale && (
          <span className="ml-2 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">
            Stale
          </span>
        )}
      </p>
      {!data.demo && (
        <button
          type="button"
          className="btn flex items-center gap-1 px-3 py-1.5 text-sm"
          onClick={onRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          <RefreshCw
            aria-hidden="true"
            size={14}
            className={refreshing ? 'animate-spin' : undefined}
          />
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      )}
      <p className="w-full text-xs">
        {data.demo
          ? 'Demo values are synthetic and never refresh.'
          : 'The model behind this data updates about once an hour and the page re-checks every 15 minutes. Refreshing does not guarantee a newer reading.'}
      </p>
    </div>
  );
}
