import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, errorMessage, fetchAqi } from '../lib/api.js';

/** Loads air-quality data and ignores responses from superseded requests. */
export function useAqi(initialCity = 'Kolkata') {
  const [city, setCity] = useState(initialCity);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const controller = useRef(null);

  const load = useCallback(
    async (target = city, demo = false) => {
      const name = target.trim();
      if (!name) {
        setError({ message: 'Please enter a city name.', canDemo: false });
        return;
      }
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setLoading(true);
      setError(null);
      try {
        setData(await fetchAqi(name, { demo, signal: current.signal }));
      } catch (e) {
        if (current.signal.aborted) return; // superseded by a newer request
        setError({
          message: errorMessage(e),
          canDemo: e instanceof ApiError ? e.body?.canDemo === true : true,
        });
      } finally {
        if (controller.current === current) setLoading(false);
      }
    },
    [city],
  );

  useEffect(() => () => controller.current?.abort(), []);

  return { city, setCity, data, loading, error, load };
}
