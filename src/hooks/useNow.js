import { useEffect, useState } from 'react';
import { CLOCK_TICK_MS } from '../constants.js';

/** Current time in ms, refreshed on an interval so relative times and staleness stay accurate. */
export function useNow(intervalMs = CLOCK_TICK_MS) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
