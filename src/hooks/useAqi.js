import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_CITY, REFRESH_INTERVAL_MS, STALE_AFTER_MS } from '../constants.js';
import { ApiError, errorMessage, fetchAirQuality } from '../lib/api.js';
import { ageMs } from '../lib/time.js';
import { useNow } from './useNow.js';

const describeResult = (data) =>
  `Air quality for ${data.place.name}: AQI ${data.current.aqi ?? 'unavailable'}, ${data.current.category}`;

/**
 * Air-quality data with explicit loading, refreshing and staleness state.
 *
 *  - `load(city, demo)` is a user action; `refresh()` re-checks the current city.
 *  - The last valid reading is kept when a refresh fails and is then reported as stale.
 *  - Slow responses from superseded requests are cancelled and ignored.
 *  - While the tab is visible the data is re-checked every `refreshIntervalMs`.
 *    Refreshing re-queries a model that updates roughly hourly: it does not guarantee a new reading.
 */
export function useAqi({
  initialCity = DEFAULT_CITY,
  refreshIntervalMs = REFRESH_INTERVAL_MS,
  staleAfterMs = STALE_AFTER_MS,
} = {}) {
  const [city, setCity] = useState(initialCity);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | refreshing | ready | error
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const controller = useRef(null);
  const active = useRef({ city: null, demo: false });
  const now = useNow();

  const run = useCallback(async ({ target, demo, background, announce }) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setStatus(background ? 'refreshing' : 'loading');
    setError(null);
    if (announce) {
      setAnnouncement(`Loading air quality for ${target}`);
    }
    try {
      const result = await fetchAirQuality(target, { demo, signal: current.signal });
      active.current = { city: target, demo };
      setData(result);
      setStatus('ready');
      if (announce) {
        setAnnouncement(describeResult(result));
      }
    } catch (failure) {
      if (current.signal.aborted) {
        return;
      } // superseded by a newer request
      const next = {
        message: errorMessage(failure),
        canDemo: failure instanceof ApiError ? failure.body?.canDemo === true : true,
      };
      setError(next);
      setStatus('error');
      if (announce) {
        setAnnouncement(`Error: ${next.message}`);
      }
    }
  }, []);

  const load = useCallback(
    (target = city, demo = false) => {
      const name = target.trim();
      if (!name) {
        setError({ message: 'Please enter a city name.', canDemo: false });
        setStatus('error');
        return Promise.resolve();
      }
      return run({ target: name, demo, background: false, announce: true });
    },
    [city, run],
  );

  const refresh = useCallback(
    ({ manual = false } = {}) => {
      const { city: activeCity, demo } = active.current;
      if (!activeCity || demo) {
        return Promise.resolve();
      }
      return run({ target: activeCity, demo: false, background: true, announce: manual });
    },
    [run],
  );

  // Re-check periodically, but only while the tab is visible, and catch up when it becomes visible again.
  const fetchedAt = data?.fetchedAt;
  const isLive = Boolean(data) && !data.demo;
  useEffect(() => {
    if (!isLive || refreshIntervalMs <= 0) {
      return undefined;
    }
    const visible = () => document.visibilityState === 'visible';
    const timer = setInterval(() => visible() && refresh(), refreshIntervalMs);
    const onVisibilityChange = () => {
      if (visible() && ageMs(fetchedAt, Date.now()) >= refreshIntervalMs) {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isLive, fetchedAt, refreshIntervalMs, refresh]);

  useEffect(() => () => controller.current?.abort(), []);

  const dataAgeMs = data ? ageMs(data.fetchedAt, now) : 0;
  const isStale =
    Boolean(data) &&
    !data.demo &&
    (Boolean(data.stale) || status === 'error' || dataAgeMs > staleAfterMs);

  return {
    city,
    setCity,
    data,
    error,
    announcement,
    loading: status === 'loading',
    refreshing: status === 'refreshing',
    isStale,
    dataAgeMs,
    now,
    load,
    refresh,
  };
}
