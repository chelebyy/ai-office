import { ART } from './scene-layout.ts';
import { OFFICE_WINDOW_PATH } from './NightWindow.tsx';
import type { Locale } from '../../shared/contract.ts';
import type { OfficeLocation } from './office-environment.ts';
import { weatherDescription, type WeatherView } from './office-weather.ts';
import './office-weather.css';

const text = {
  tr: {
    title: 'Hava durumu',
    auto: 'Otomatik',
    clear: 'Açık',
    rain: 'Yağmurlu',
    snow: 'Karlı',
    manualSnow: 'Karlı görünüm',
    noLocation: 'Şehir seç',
    loading: 'Hava yükleniyor…',
    error: 'Hava verisi alınamadı',
    stale: 'Son bilinen',
    refreshing: 'Yenileniyor…',
    manualRain: 'Yağmurlu görünüm',
    manualClear: 'Açık görünüm',
    settings: 'Hava durumu ayarları',
    help: 'Otomatik görünüm seçili şehrin havasını izler. Manuel seçim yalnızca pencere efektini değiştirir.',
    note: 'Veri 15 dakikada bir yenilenir. Eski veride otomatik yağış durur; gizli sekmede ve azaltılmış hareket tercihinde efekt hareket etmez.',
    refresh: 'Şimdi yenile',
    source: 'Hava verisi',
    time: 'Veri saati',
    missing: 'Gerçek hava bilgisi için önce şehir seç.',
    known: 'Güncel hava bilgisi',
  },
  en: {
    title: 'Weather',
    auto: 'Automatic',
    clear: 'Clear',
    rain: 'Rainy',
    snow: 'Snowy',
    manualSnow: 'Snowy appearance',
    noLocation: 'Choose city',
    loading: 'Loading weather…',
    error: 'Weather unavailable',
    stale: 'Last known',
    refreshing: 'Refreshing…',
    manualRain: 'Rainy appearance',
    manualClear: 'Clear appearance',
    settings: 'Weather settings',
    help: 'Automatic follows the selected city. Manual selection changes only the window effect.',
    note: 'Data refreshes every 15 minutes. Old data stops automatic precipitation; hidden tabs and reduced motion pause the effect.',
    refresh: 'Refresh now',
    source: 'Weather data',
    time: 'Data time',
    missing: 'Choose a city for current weather information.',
    known: 'Current weather information',
  },
};

function summary(weather: WeatherView, locale: Locale) {
  const c = text[locale],
    reading = weather.reading;
  if (!reading)
    return weather.status === 'no-location'
      ? c.noLocation
      : weather.status === 'loading'
        ? c.loading
        : c.error;
  return `${weather.status === 'stale' ? c.stale + ': ' : ''}${Math.round(reading.temperature)}°C · ${weatherDescription(reading.code, locale)}`;
}

export function WeatherBadge({
  weather,
  locale,
  location,
  onOpen,
}: {
  weather: WeatherView;
  locale: Locale;
  location: OfficeLocation | null;
  onOpen: () => void;
}) {
  const c = text[locale];
  const details = summary(weather, locale);
  return (
    <button
      type="button"
      className="fo-weather-pill"
      data-testid="weather-badge"
      data-status={weather.status}
      title={`${location?.name ?? c.title} · ${details}`}
      aria-label={`${c.settings}: ${location?.name ?? ''} ${details}`}
      onClick={onOpen}
    >
      <span className="fo-weather-city">
        <i aria-hidden="true" />
        {location?.name ?? c.title}
      </span>
      <span>{details}</span>
      {weather.mode !== 'auto' && (
        <small>
          {{ rain: c.manualRain, clear: c.manualClear, snow: c.manualSnow }[weather.mode]}
        </small>
      )}
    </button>
  );
}

export function WeatherSettings({
  weather,
  locale,
  location,
}: {
  weather: WeatherView;
  locale: Locale;
  location: OfficeLocation | null;
}) {
  const c = text[locale];
  return (
    <section className="fo-weather-settings">
      <h3>{c.title}</h3>
      <label className="fo-setting">
        {c.title}
        <select
          aria-label={c.title}
          value={weather.mode}
          aria-describedby="weather-help"
          onChange={(e) => weather.setMode(e.target.value)}
        >
          <option value="auto">{c.auto}</option>
          <option value="clear">{c.clear}</option>
          <option value="rain">{c.rain}</option>
          <option value="snow">{c.snow}</option>
        </select>
      </label>
      <p className="fo-muted" id="weather-help">
        {c.help}
      </p>
      <div className="fo-weather-details" role="status">
        <strong>{location?.name ?? c.missing}</strong>
        <span>{summary(weather, locale)}</span>
        {weather.reading && location && (
          <small>
            {c.time}:{' '}
            {new Intl.DateTimeFormat(locale, {
              timeZone: location.timezone,
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(weather.reading.observedAt)}
          </small>
        )}
        {weather.refreshing && weather.reading && <small>{c.refreshing}</small>}
      </div>
      {location && (
        <button
          type="button"
          className="fo-weather-refresh"
          disabled={weather.refreshing}
          onClick={weather.refresh}
        >
          {c.refresh}
        </button>
      )}
      <p className="fo-muted">{c.note}</p>
      <p className="fo-weather-source">
        {c.source}:{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
      </p>
    </section>
  );
}

export function WindowWeather({
  id,
  kind,
  frozen,
}: {
  id: string;
  kind: 'rain' | 'snow' | null;
  frozen: boolean;
}) {
  if (!kind) return null;
  // Keep precipitation in a small composited layer, outside the full-room SVG.
  const x = 820,
    y = 25,
    width = 345,
    height = 200;
  return (
    <div
      data-layer={`window-${kind}`}
      data-frozen={frozen}
      className={`fo-window-precipitation fo-window-${kind}`}
      aria-hidden="true"
      style={{
        left: `${((x - ART.x) / ART.widthOfRoom) * 100}%`,
        top: `${(y / ART.heightOfRoom) * 100}%`,
        width: `${(width / ART.widthOfRoom) * 100}%`,
        height: `${(height / ART.heightOfRoom) * 100}%`,
        clipPath: `url(#${id}-weather-window)`,
      }}
    >
      <svg width="0" height="0" className="fo-rain-defs">
        <defs>
          <clipPath id={`${id}-weather-window`} clipPathUnits="objectBoundingBox">
            <path
              transform={`matrix(${1 / width} 0 0 ${1 / height} ${-x / width} ${-y / height})`}
              d={OFFICE_WINDOW_PATH}
            />
          </clipPath>
        </defs>
      </svg>
      <div className="fo-rain-mask">
        {kind === 'snow' ? (
          <>
            <div className="fo-weather-fall fo-snow-fall fo-snow-far" />
            <div className="fo-weather-fall fo-snow-fall" />
          </>
        ) : (
          <div className="fo-weather-fall fo-rain-fall" />
        )}
      </div>
    </div>
  );
}
