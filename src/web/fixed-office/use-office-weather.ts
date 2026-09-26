import { useEffect, useRef, useState } from 'react';
import type { OfficeLocation } from './office-environment.ts';
import {
  WEATHER_CACHE_KEY,
  WEATHER_PREFERENCE_KEY,
  WEATHER_REFRESH_MS,
  WEATHER_RETRY_MS,
  parseWeather,
  validateWeather,
  weatherLocationKey,
  weatherPreference,
  weatherRain,
  weatherSnow,
  weatherStatus,
  weatherUrl,
  type WeatherReading,
  type WeatherView,
} from './office-weather.ts';

function readCache(key: string): WeatherReading | null {
  try {
    return validateWeather(
      JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? 'null'),
      key,
      Date.now(),
    );
  } catch {
    return null;
  }
}
function readMode() {
  try {
    return weatherPreference(localStorage.getItem(WEATHER_PREFERENCE_KEY));
  } catch {
    return 'auto' as const;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* In-memory operation remains available. */
  }
}

export function useOfficeWeather(location: OfficeLocation | null, now: number): WeatherView {
  const key = weatherLocationKey(location);
  const [mode, updateMode] = useState(readMode);
  const [state, setState] = useState<{
    key: string;
    reading: WeatherReading | null;
    error: boolean;
    loading: boolean;
  }>(() => ({ key, reading: readCache(key), error: false, loading: !!key }));
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === null || event.key === WEATHER_PREFERENCE_KEY) updateMode(readMode());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (!location) {
      setState({ key, reading: null, error: false, loading: false });
      return;
    }
    let disposed = false,
      inFlight = false,
      failed = false;
    let reading = readCache(key);
    let nextAttempt = reading
      ? reading.fetchedAt +
        (weatherStatus(reading, Date.now(), false, false) === 'fresh'
          ? WEATHER_REFRESH_MS
          : WEATHER_RETRY_MS)
      : 0;
    let lastAttempt = 0;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const publish = (loading = false) => {
      if (!disposed) setState({ key, reading, error: failed, loading });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      if (!disposed && !document.hidden)
        timer = window.setTimeout(() => void run(), Math.max(1_000, nextAttempt - Date.now()));
    };
    async function run(force = false) {
      if (disposed || document.hidden || inFlight) return;
      const time = Date.now();
      if ((!force && time < nextAttempt) || (force && time - lastAttempt < 30_000)) {
        publish();
        schedule();
        return;
      }
      inFlight = true;
      lastAttempt = time;
      controller = new AbortController();
      const request = controller;
      const deadline = window.setTimeout(() => request.abort(), 8_000);
      publish(true);
      try {
        const response = await fetch(weatherUrl(location!), {
          signal: request.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error('Weather unavailable');
        const result = parseWeather(await response.json(), key, Date.now());
        if (!result) throw new Error('Invalid weather data');
        if (disposed) return;
        reading = result;
        failed = false;
        store(WEATHER_CACHE_KEY, JSON.stringify(reading));
        nextAttempt =
          Date.now() +
          (weatherStatus(reading, Date.now(), false, false) === 'fresh'
            ? WEATHER_REFRESH_MS
            : WEATHER_RETRY_MS);
      } catch {
        if (disposed) return;
        if (document.hidden && request.signal.aborted) nextAttempt = Date.now();
        else {
          failed = true;
          nextAttempt = Date.now() + WEATHER_RETRY_MS;
        }
      } finally {
        window.clearTimeout(deadline);
        inFlight = false;
        if (!disposed) {
          publish();
          schedule();
        }
      }
    }
    const visibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        controller?.abort();
      } else void run();
    };
    const online = () => void run(true);
    const cacheChanged = (event: StorageEvent) => {
      if (event.key !== WEATHER_CACHE_KEY) return;
      const cached = readCache(key);
      if (cached && (!reading || cached.fetchedAt > reading.fetchedAt)) {
        reading = cached;
        failed = false;
        nextAttempt =
          cached.fetchedAt +
          (weatherStatus(cached, Date.now(), false, false) === 'fresh'
            ? WEATHER_REFRESH_MS
            : WEATHER_RETRY_MS);
        publish(inFlight);
        schedule();
      }
    };
    refreshRef.current = () => void run(true);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', online);
    window.addEventListener('storage', cacheChanged);
    publish(!!key && !reading);
    void run();
    return () => {
      disposed = true;
      controller?.abort();
      window.clearTimeout(timer);
      refreshRef.current = () => {};
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', online);
      window.removeEventListener('storage', cacheChanged);
    };
    // Coordinates/id form the request identity; names and locale do not refetch weather.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const reading = state.key === key ? state.reading : null;
  const refreshing = state.key === key && state.loading;
  const status = !key
    ? 'no-location'
    : weatherStatus(
        reading,
        now,
        state.key === key && state.error,
        refreshing || state.key !== key,
      );
  return {
    mode,
    status,
    reading,
    raining: weatherRain(mode, status, reading),
    snowing: weatherSnow(mode, status, reading),
    refreshing,
    setMode: (value) => {
      const next = weatherPreference(value);
      updateMode(next);
      store(WEATHER_PREFERENCE_KEY, next);
    },
    refresh: () => refreshRef.current(),
  };
}
