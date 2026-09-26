import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTRY_CODES,
  locationSearchUrl,
  parseLocations,
  solarLighting,
  validLocation,
  type OfficeLocation,
} from '../src/web/fixed-office/office-environment.ts';
import { officeTheme } from '../src/web/fixed-office/office-theme.ts';

const istanbul: OfficeLocation = {
  id: 745044,
  name: 'İstanbul',
  countryCode: 'TR',
  region: 'İstanbul',
  latitude: 41.01384,
  longitude: 28.94966,
  timezone: 'Europe/Istanbul',
};
test('location validation rejects corrupt coordinates and time zones without coercion', () => {
  assert.deepEqual(validLocation(istanbul), istanbul);
  for (const broken of [
    null,
    {},
    { ...istanbul, latitude: NaN },
    { ...istanbul, longitude: 190 },
    { ...istanbul, latitude: '41' },
    { ...istanbul, timezone: 'Not/AZone' },
    { ...istanbul, countryCode: 'ZZ' },
    { ...istanbul, id: -1 },
  ])
    assert.equal(validLocation(broken), null);
  assert.equal(new Set(COUNTRY_CODES).size, 249);
});
test('city results retain disambiguation and accept only valid populated places in the selected country', () => {
  const result = { ...istanbul, country_code: 'TR', admin1: 'İstanbul', feature_code: 'PPLA' };
  const cities = parseLocations(
    {
      results: [
        result,
        result,
        { ...result, id: 2, country_code: 'US' },
        { ...result, id: 3, timezone: null },
        { ...result, id: 4, feature_code: 'MT' },
      ],
    },
    'TR',
  );
  assert.deepEqual(cities, [istanbul]);
  assert.deepEqual(parseLocations({ error: true }, 'TR'), []);
  const url = new URL(locationSearchUrl('TR', 'İzmir & count=99', 'tr'));
  assert.equal(url.searchParams.get('name'), 'İzmir & count=99');
  assert.equal(url.searchParams.get('count'), '10');
  assert.equal(url.searchParams.get('countryCode'), 'TR');
  assert.throws(() => locationSearchUrl('ZZ', 'Paris', 'en'));
});
test('solar lighting follows a location across day, evening twilight, night and dawn', () => {
  assert.equal(solarLighting(Date.parse('2026-09-19T10:00:00Z'), istanbul).theme, 'day');
  assert.deepEqual(solarLighting(Date.parse('2026-09-19T16:30:00Z'), istanbul), {
    theme: 'sunset',
    dawn: false,
  });
  assert.equal(solarLighting(Date.parse('2026-09-19T22:00:00Z'), istanbul).theme, 'night');
  assert.deepEqual(solarLighting(Date.parse('2026-09-19T03:30:00Z'), istanbul), {
    theme: 'sunset',
    dawn: true,
  });
  assert.equal(
    solarLighting(Date.parse('2026-09-19T10:00:00Z'), {
      ...istanbul,
      latitude: -33.8688,
      longitude: 151.2093,
      timezone: 'Australia/Sydney',
    }).theme,
    'night',
  );
});
test('polar seasons and the international date line do not need artificial clock-hour fallback', () => {
  const pole = { ...istanbul, latitude: 89, longitude: 0 };
  assert.equal(solarLighting(Date.parse('2026-06-21T00:00:00Z'), pole).theme, 'day');
  assert.equal(solarLighting(Date.parse('2026-12-21T12:00:00Z'), pole).theme, 'night');
  const a = solarLighting(Date.parse('2026-09-19T23:00:00Z'), {
    ...istanbul,
    latitude: 0,
    longitude: 180,
  });
  const b = solarLighting(Date.parse('2026-09-19T23:00:00Z'), {
    ...istanbul,
    latitude: 0,
    longitude: -180,
  });
  assert.deepEqual(a, b);
});
test('absolute solar instants ignore PC time zone while saved manual modes remain compatible', () => {
  const now = Date.parse('2026-03-29T10:00:00Z');
  assert.deepEqual(
    solarLighting(now, istanbul),
    solarLighting(now, { ...istanbul, timezone: 'America/New_York' }),
  );
  assert.equal(solarLighting(NaN, istanbul).theme, 'sunset');
  assert.equal(solarLighting(now, null).theme, 'sunset');
  for (const theme of ['day', 'sunset', 'night', 'auto']) assert.equal(officeTheme(theme), theme);
  assert.equal(officeTheme('garbage'), 'sunset');
});
