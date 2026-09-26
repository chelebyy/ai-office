import { useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from '../../shared/contract.ts';
import {
  COUNTRY_CODES,
  locationSearchUrl,
  parseLocations,
  type OfficeLocation,
} from './office-environment.ts';
import './location-setup.css';

const text = {
  tr: {
    title: 'Ofisini nereye kuralım?',
    intro: 'Şehrini seç; ofisin ışığı gün boyunca güneşle birlikte değişsin.',
    country: 'Ülke',
    choose: 'Ülke seç',
    city: 'Şehir',
    placeholder: 'En az 2 harf yaz',
    search: 'Şehir bul',
    searching: 'Şehirler aranıyor…',
    empty: 'Bu ülkede eşleşen şehir bulunamadı. Başka bir yazım deneyebilirsin.',
    error: 'Şehir araması şu an yanıt vermiyor. Tekrar deneyebilir veya şimdilik atlayabilirsin.',
    save: 'Otomatik ışığı aç',
    skip: 'Şimdilik atla',
    cancel: 'Vazgeç',
    hint: 'GPS izni gerekmez. Seçimin bu tarayıcıda saklanır; tüm odalarında geçerli olur.',
    source: 'Şehir araması:',
    selected: 'Seçilen şehir',
  },
  en: {
    title: 'Where shall we set up your office?',
    intro: 'Choose a city and let your office follow the sun throughout the day.',
    country: 'Country',
    choose: 'Choose a country',
    city: 'City',
    placeholder: 'Type at least 2 letters',
    search: 'Find city',
    searching: 'Searching cities…',
    empty: 'No matching city in this country. Try another spelling.',
    error: 'City search is unavailable. Try again or skip for now.',
    save: 'Enable automatic lighting',
    skip: 'Skip for now',
    cancel: 'Cancel',
    hint: 'No GPS permission needed. Your choice stays in this browser and applies to all rooms.',
    source: 'City search:',
    selected: 'Selected city',
  },
};

export function LocationSetup({
  locale,
  location,
  firstRun,
  onSave,
  onCancel,
}: {
  locale: Locale;
  location: OfficeLocation | null;
  firstRun: boolean;
  onSave: (city: OfficeLocation) => void;
  onCancel: () => void;
}) {
  const c = text[locale];
  const [country, setCountry] = useState(location?.countryCode ?? '');
  const [query, setQuery] = useState(location?.name ?? '');
  const [selected, setSelected] = useState(location);
  const [results, setResults] = useState<OfficeLocation[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error' | 'ready'>('idle');
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    return COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
      a.name.localeCompare(b.name, locale),
    );
  }, [locale]);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  function clearSearch() {
    generation.current++;
    request.current?.abort();
    setSelected(null);
    setResults([]);
    setStatus('idle');
  }
  async function search() {
    request.current?.abort();
    const current = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    const deadline = window.setTimeout(() => controller.abort(), 8_000);
    setStatus('loading');
    setResults([]);
    setSelected(null);
    try {
      const response = await fetch(locationSearchUrl(country, query, locale), {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error('City search failed');
      const data = parseLocations(await response.json(), country);
      if (generation.current !== current) return;
      setResults(data);
      setStatus(data.length ? 'ready' : 'empty');
    } catch {
      if (generation.current === current) setStatus('error');
    } finally {
      clearTimeout(deadline);
    }
  }
  return (
    <section className="fo-location" data-testid="location-setup">
      <p className="fo-location-intro">{c.intro}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (country && query.trim().length >= 2) void search();
        }}
      >
        <label>
          {c.country}
          <select
            aria-label={c.country}
            value={country}
            onChange={(e) => {
              clearSearch();
              setCountry(e.target.value);
              setQuery('');
            }}
          >
            <option value="">{c.choose}</option>
            {countries.map((item) => (
              <option value={item.code} key={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {c.city}
          <input
            aria-label={c.city}
            value={query}
            disabled={!country}
            maxLength={100}
            autoComplete="off"
            placeholder={c.placeholder}
            onChange={(e) => {
              clearSearch();
              setQuery(e.target.value);
            }}
          />
        </label>
        <button
          type="submit"
          disabled={!country || query.trim().length < 2 || status === 'loading'}
        >
          {c.search}
        </button>
      </form>
      <div className="fo-location-status" role="status">
        {status === 'loading'
          ? c.searching
          : status === 'empty'
            ? c.empty
            : status === 'error'
              ? c.error
              : ''}
      </div>
      {results.length > 0 && (
        <ul className="fo-location-results">
          {results.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                aria-pressed={selected?.id === city.id}
                onClick={() => setSelected(city)}
              >
                <strong>{city.name}</strong>
                <span>
                  {city.region} · {city.timezone}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <p className="fo-location-selected">
          {c.selected}: <strong>{selected.name}</strong> · {selected.region} · {selected.timezone}
        </p>
      )}
      <p className="fo-muted">{c.hint}</p>
      <p className="fo-location-source">
        {c.source}{' '}
        <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>{' '}
        /{' '}
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          GeoNames
        </a>
      </p>
      <div className="fo-location-actions">
        <button type="button" onClick={onCancel}>
          {firstRun ? c.skip : c.cancel}
        </button>
        <button
          type="button"
          className="fo-location-save"
          disabled={!selected}
          onClick={() => selected && onSave(selected)}
        >
          {c.save}
        </button>
      </div>
    </section>
  );
}

export function locationTitle(locale: Locale) {
  return text[locale].title;
}
