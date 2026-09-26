import type { Locale } from '../../shared/contract.ts';
import type { OfficeLocation } from './office-environment.ts';

export type WeatherPreference = 'auto' | 'clear' | 'rain' | 'snow';
export const WEATHER_PREFERENCE_KEY = 'cheleby.office.weather.mode';
export const WEATHER_CACHE_KEY = 'cheleby.office.weather.cache.v1';
export const WEATHER_REFRESH_MS = 15 * 60_000;
export const WEATHER_RETRY_MS = 5 * 60_000;
export const WEATHER_STALE_MS = 45 * 60_000;
const MAX_AGE_MS = 24 * 60 * 60_000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;
const CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86,
  95, 96, 99,
];
const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
const SNOW_CODES = [71, 73, 75, 77, 85, 86];
export type WeatherReading = {
  key: string;
  observedAt: number;
  fetchedAt: number;
  temperature: number;
  code: number;
  rain: number;
  showers: number;
};
export type WeatherStatus = 'no-location' | 'loading' | 'fresh' | 'stale' | 'error';
export type WeatherView = {
  mode: WeatherPreference;
  status: WeatherStatus;
  reading: WeatherReading | null;
  raining: boolean;
  snowing: boolean;
  refreshing: boolean;
  setMode: (value: string) => void;
  refresh: () => void;
};

export function weatherPreference(value: unknown): WeatherPreference {
  return value === 'rain' || value === 'clear' || value === 'snow' ? value : 'auto';
}
export function weatherLocationKey(location: OfficeLocation | null): string {
  return location ? `${location.id}:${location.latitude}:${location.longitude}` : '';
}
export function weatherUrl(location: OfficeLocation): string {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,weather_code,rain,showers',
    temperature_unit: 'celsius',
    precipitation_unit: 'mm',
    timeformat: 'unixtime',
    timezone: 'GMT',
    forecast_days: '1',
  }).toString();
  return url.toString();
}
function numberIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
export function validateWeather(value: unknown, key: string, now: number): WeatherReading | null {
  if (!key || !value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (
    r.key !== key ||
    !numberIn(r.observedAt, now - MAX_AGE_MS, now + FUTURE_TOLERANCE_MS) ||
    !numberIn(r.fetchedAt, now - MAX_AGE_MS, now + FUTURE_TOLERANCE_MS) ||
    !numberIn(r.temperature, -100, 70) ||
    !numberIn(r.code, 0, 99) ||
    !CODES.includes(r.code) ||
    !numberIn(r.rain, 0, 500) ||
    !numberIn(r.showers, 0, 500)
  )
    return null;
  return {
    key,
    observedAt: r.observedAt,
    fetchedAt: r.fetchedAt,
    temperature: r.temperature,
    code: r.code,
    rain: r.rain,
    showers: r.showers,
  };
}
export function parseWeather(value: unknown, key: string, now: number): WeatherReading | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as {
    current?: Record<string, unknown>;
    current_units?: Record<string, unknown>;
  };
  const c = body.current,
    u = body.current_units;
  if (
    !c ||
    u?.temperature_2m !== '°C' ||
    u?.time !== 'unixtime' ||
    u?.rain !== 'mm' ||
    u?.showers !== 'mm' ||
    typeof c.time !== 'number'
  )
    return null;
  return validateWeather(
    {
      key,
      observedAt: c.time * 1_000,
      fetchedAt: now,
      temperature: c.temperature_2m,
      code: c.weather_code,
      rain: c.rain,
      showers: c.showers,
    },
    key,
    now,
  );
}
export function weatherStatus(
  reading: WeatherReading | null,
  now: number,
  error: boolean,
  loading: boolean,
): WeatherStatus {
  if (!reading) return loading ? 'loading' : 'error';
  if (
    error ||
    now - reading.observedAt >= WEATHER_STALE_MS ||
    now - reading.fetchedAt >= WEATHER_STALE_MS ||
    reading.observedAt > now + FUTURE_TOLERANCE_MS ||
    reading.fetchedAt > now + FUTURE_TOLERANCE_MS
  )
    return 'stale';
  return 'fresh';
}
export function weatherRain(
  mode: WeatherPreference,
  status: WeatherStatus,
  reading: WeatherReading | null,
): boolean {
  if (mode !== 'auto') return mode === 'rain';
  if (status !== 'fresh' || !reading || SNOW_CODES.includes(reading.code)) return false;
  return RAIN_CODES.includes(reading.code) || reading.rain + reading.showers > 0;
}
export function weatherSnow(
  mode: WeatherPreference,
  status: WeatherStatus,
  reading: WeatherReading | null,
): boolean {
  if (mode !== 'auto') return mode === 'snow';
  return status === 'fresh' && !!reading && SNOW_CODES.includes(reading.code);
}
export function weatherDescription(code: number, locale: Locale): string {
  const category =
    code === 0
      ? 'clear'
      : code === 1
        ? 'mainlyClear'
        : code === 2
          ? 'clouds'
          : code === 3
            ? 'overcast'
            : code === 45 || code === 48
              ? 'fog'
              : SNOW_CODES.includes(code)
                ? 'snow'
                : code >= 95
                  ? 'storm'
                  : [56, 57, 66, 67].includes(code)
                    ? 'freezing'
                    : code < 60
                      ? 'drizzle'
                      : 'rain';
  const labels = {
    tr: {
      clear: 'Açık',
      mainlyClear: 'Az bulutlu',
      clouds: 'Parçalı bulutlu',
      overcast: 'Bulutlu',
      fog: 'Sisli',
      snow: 'Karlı',
      storm: 'Gök gürültülü',
      freezing: 'Donan yağış',
      drizzle: 'Çiseleme',
      rain: 'Yağmurlu',
    },
    en: {
      clear: 'Clear',
      mainlyClear: 'Mostly clear',
      clouds: 'Partly cloudy',
      overcast: 'Overcast',
      fog: 'Fog',
      snow: 'Snow',
      storm: 'Thunderstorms',
      freezing: 'Freezing rain',
      drizzle: 'Drizzle',
      rain: 'Rain',
    },
  };
  return labels[locale][category];
}
