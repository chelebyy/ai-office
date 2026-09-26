import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWeather,
  validateWeather,
  weatherStatus,
  weatherRain,
  weatherSnow,
  weatherUrl,
  weatherLocationKey,
  weatherPreference,
  weatherDescription,
  WEATHER_STALE_MS,
} from '../src/web/fixed-office/office-weather.ts';
import type { OfficeLocation } from '../src/web/fixed-office/office-environment.ts';

const now = Date.parse('2026-09-19T12:00:00Z');
const city: OfficeLocation = {
  id: 745044,
  name: 'İstanbul',
  countryCode: 'TR',
  region: 'İstanbul',
  latitude: 41.01,
  longitude: 28.95,
  timezone: 'Europe/Istanbul',
};
const key = weatherLocationKey(city);
const body = () => ({
  current_units: { time: 'unixtime', temperature_2m: '°C', rain: 'mm', showers: 'mm' },
  current: { time: now / 1000, temperature_2m: 22.4, weather_code: 61, rain: 0.2, showers: 0 },
});
const reading = () => parseWeather(body(), key, now)!;

test('weather request has bounded fields, coordinates and explicit timestamp/units', () => {
  const url = new URL(weatherUrl(city));
  assert.equal(url.origin, 'https://api.open-meteo.com');
  assert.equal(url.pathname, '/v1/forecast');
  assert.equal(url.searchParams.get('current'), 'temperature_2m,weather_code,rain,showers');
  assert.equal(url.searchParams.get('latitude'), '41.01');
  assert.equal(url.searchParams.get('longitude'), '28.95');
  assert.equal(url.searchParams.get('timeformat'), 'unixtime');
  assert.equal(url.searchParams.get('timezone'), 'GMT');
  assert.equal(url.searchParams.get('temperature_unit'), 'celsius');
  assert.equal(url.searchParams.get('precipitation_unit'), 'mm');
  assert.equal(url.searchParams.get('forecast_days'), '1');
  assert.equal(weatherLocationKey(null), '');
  assert.notEqual(key, weatherLocationKey({ ...city, latitude: 42 }));
});

test('weather validates units, numeric values, known codes and time boundaries', () => {
  assert.deepEqual(reading(), {
    key,
    observedAt: now,
    fetchedAt: now,
    temperature: 22.4,
    code: 61,
    rain: 0.2,
    showers: 0,
  });
  assert.equal(parseWeather(null, key, now), null);
  for (const field of ['temperature_2m', 'rain', 'showers', 'time'] as const) {
    const invalid = body();
    invalid.current_units[field] = 'unexpected';
    assert.equal(parseWeather(invalid, key, now), null);
  }
  for (const invalid of [
    { temperature_2m: null },
    { temperature_2m: '22' },
    { temperature_2m: Infinity },
    { weather_code: 4 },
    { rain: -1 },
    { showers: 501 },
    { time: (now + 300001) / 1000 },
    { time: (now - 86400001) / 1000 },
  ]) {
    assert.equal(
      parseWeather({ ...body(), current: { ...body().current, ...invalid } }, key, now),
      null,
    );
  }
  assert.equal(validateWeather(reading(), 'another-city', now), null);
  assert.equal(validateWeather({ ...reading(), fetchedAt: now + 300001 }, key, now), null);
  assert.equal(validateWeather(reading(), key, now + 86400001), null);
});

test('fresh downloads never make an old provider observation fresh', () => {
  const fresh = reading();
  assert.equal(weatherStatus(fresh, now + WEATHER_STALE_MS - 1, false, false), 'fresh');
  assert.equal(weatherStatus(fresh, now + WEATHER_STALE_MS, false, false), 'stale');
  assert.equal(
    weatherStatus({ ...fresh, observedAt: now - WEATHER_STALE_MS }, now, false, false),
    'stale',
  );
  assert.equal(
    weatherStatus({ ...fresh, fetchedAt: now - WEATHER_STALE_MS }, now, false, false),
    'stale',
  );
  assert.equal(weatherStatus(fresh, now, true, false), 'stale');
  assert.equal(weatherStatus(fresh, now - 300001, false, false), 'stale');
  assert.equal(weatherStatus(null, now, false, true), 'loading');
  assert.equal(weatherStatus(null, now, true, false), 'error');
});

test('snow uses fresh snow codes or an explicit appearance preference without mixing rain', () => {
  assert.equal(weatherPreference('snow'), 'snow');
  assert.equal(weatherSnow('snow', 'no-location', null), true);
  assert.equal(weatherRain('snow', 'fresh', reading()), false);
  for (const code of [71, 73, 75, 77, 85, 86]) {
    const snow = { ...reading(), code, rain: 1 };
    assert.equal(weatherSnow('auto', 'fresh', snow), true);
    assert.equal(weatherRain('auto', 'fresh', snow), false);
    for (const status of ['stale', 'error', 'loading', 'no-location'] as const)
      assert.equal(weatherSnow('auto', status, snow), false);
    for (const mode of ['rain', 'clear'] as const)
      assert.equal(weatherSnow(mode, 'fresh', snow), false);
  }
  for (const code of [0, 3, 61, 66, 67, 95, 96, 99])
    assert.equal(weatherSnow('auto', 'fresh', { ...reading(), code }), false);
  assert.equal(weatherSnow('auto', 'fresh', null), false);
});

test('automatic rain requires fresh liquid precipitation; snow never becomes rain', () => {
  for (const status of ['stale', 'error', 'loading', 'no-location'] as const)
    assert.equal(weatherRain('auto', status, reading()), false);
  assert.equal(weatherRain('auto', 'fresh', reading()), true);
  assert.equal(weatherRain('auto', 'fresh', { ...reading(), code: 3, rain: 0, showers: 0 }), false);
  assert.equal(
    weatherRain('auto', 'fresh', { ...reading(), code: 95, rain: 0, showers: 0.4 }),
    true,
  );
  for (const code of [71, 73, 75, 77, 85, 86])
    assert.equal(weatherRain('auto', 'fresh', { ...reading(), code, rain: 1 }), false);
  assert.equal(weatherRain('rain', 'no-location', null), true);
  assert.equal(weatherRain('clear', 'fresh', reading()), false);
  assert.equal(weatherPreference('unknown'), 'auto');
  assert.equal(weatherDescription(61, 'tr'), 'Yağmurlu');
  assert.equal(weatherDescription(0, 'en'), 'Clear');
});
