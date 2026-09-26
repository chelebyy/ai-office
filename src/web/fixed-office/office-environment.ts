import { getPosition } from 'suncalc';
import type { OfficeTheme } from './office-theme.ts';

// ISO 3166-1 alpha-2; names are localized by the browser, not shipped per language.
export const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );

export type OfficeLocation = {
  id: number;
  name: string;
  countryCode: string;
  region: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export function validLocation(value: unknown): OfficeLocation | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    !Number.isInteger(v.id) ||
    (v.id as number) < 0 ||
    typeof v.name !== 'string' ||
    !v.name.trim() ||
    v.name.length > 160 ||
    typeof v.countryCode !== 'string' ||
    !COUNTRY_CODES.includes(v.countryCode) ||
    typeof v.region !== 'string' ||
    v.region.length > 160 ||
    typeof v.latitude !== 'number' ||
    !Number.isFinite(v.latitude) ||
    Math.abs(v.latitude) > 90 ||
    typeof v.longitude !== 'number' ||
    !Number.isFinite(v.longitude) ||
    Math.abs(v.longitude) > 180 ||
    typeof v.timezone !== 'string' ||
    v.timezone.length > 80
  )
    return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: v.timezone }).format();
  } catch {
    return null;
  }
  return {
    id: v.id as number,
    name: v.name.trim(),
    countryCode: v.countryCode,
    region: v.region,
    latitude: v.latitude,
    longitude: v.longitude,
    timezone: v.timezone,
  };
}

export function parseLocations(value: unknown, country: string): OfficeLocation[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !Array.isArray((value as { results?: unknown }).results)
  )
    return [];
  const results = (value as { results: unknown[] }).results.slice(0, 20);
  const cities = results
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      if (typeof r.feature_code !== 'string' || !r.feature_code.startsWith('PPL')) return null;
      return validLocation({ ...r, countryCode: r.country_code, region: r.admin1 ?? '' });
    })
    .filter((city): city is OfficeLocation => city !== null && city.countryCode === country);
  return cities.filter((c, i) => cities.findIndex((other) => other.id === c.id) === i).slice(0, 8);
}

export function locationSearchUrl(country: string, query: string, locale: string): string {
  if (!COUNTRY_CODES.includes(country) || query.trim().length < 2 || query.length > 100)
    throw new Error('Invalid city search');
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({
    name: query.trim(),
    countryCode: country,
    count: '10',
    language: locale === 'tr' ? 'tr' : 'en',
    format: 'json',
  }).toString();
  return url.toString();
}

export function solarLighting(
  now: number,
  location: OfficeLocation | null,
): { theme: OfficeTheme; dawn: boolean } {
  if (!location || !Number.isFinite(now)) return { theme: 'sunset', dawn: false };
  // SunCalc v2 uses degrees and absolute instants. This also handles polar day/night
  // without relying on possibly absent sunrise/sunset events or the PC's time zone.
  const altitude = getPosition(new Date(now), location.latitude, location.longitude).altitude;
  if (!Number.isFinite(altitude)) return { theme: 'sunset', dawn: false };
  if (altitude >= 6) return { theme: 'day', dawn: false };
  if (altitude < -6) return { theme: 'night', dawn: false };
  const later = getPosition(new Date(now + 60_000), location.latitude, location.longitude).altitude;
  return { theme: 'sunset', dawn: later > altitude };
}
