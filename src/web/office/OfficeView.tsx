import { lazy, Suspense, useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { Locale, ObserverSnapshot, SessionView } from '../../shared/contract.ts';
import { dictionaries, eventLabels, statusLabels } from '../i18n.ts';
import {
  officeState,
  officeText,
  STALE_AFTER_MS,
  type CameraView,
  type SceneQuality,
} from './office-state.ts';
import type { SceneMetrics } from './OfficeScene.tsx';
import type { PowerMode } from './frame-scheduler.ts';
import './office.css';

const Scene = lazy(() => import('./OfficeScene.tsx'));
interface OfficeProps {
  snapshot: ObserverSnapshot | null;
  selected?: SessionView;
  locale: Locale;
  connection: 'connected' | 'connecting' | 'disconnected';
  onSelect: (session: SessionView) => void;
  onEvents: () => void;
}

export function OfficeView({
  snapshot,
  selected,
  locale,
  connection,
  onSelect,
  onEvents,
}: OfficeProps) {
  const [cameraView, setCameraView] = useState<CameraView>('room');
  const [cameraRevision, setCameraRevision] = useState(0);
  const [motion, setMotion] = useState(
    () => !matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [quality, setQuality] = useState<SceneQuality>('standard');
  const [powerMode, setPowerMode] = useState<PowerMode>(() => {
    try {
      return localStorage.getItem('cheleby.office.power') === 'eco' ? 'eco' : 'balanced';
    } catch {
      return 'balanced';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('cheleby.office.power', powerMode);
    } catch {
      /* storage is optional */
    }
  }, [powerMode]);
  const [details, setDetails] = useState(true);
  const [settings, setSettings] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(0);
  const [metrics, setMetrics] = useState<SceneMetrics>();
  const sessions = snapshot?.sessions ?? [];
  const sourceReady = connection === 'connected' && snapshot?.scan.status === 'ready';
  const state = officeState(sessions, selected?.id, sourceReady);
  const t = officeText[locale];
  const shared = dictionaries[locale];
  const mains = sessions.filter((session) => session.agentKind === 'main');
  const character = selectedCharacter === 0 ? state.root : state.team[selectedCharacter - 1];
  const characterAvailable =
    sourceReady &&
    !!character?.recordAvailable &&
    Date.now() - Date.parse(character.lastEventAt) <= STALE_AFTER_MS;
  const selectCharacter = useCallback((index: number) => {
    setSelectedCharacter(index);
    setDetails(true);
  }, []);
  const chooseRoom = (session: SessionView) => {
    onSelect(session);
    setSelectedCharacter(0);
  };
  const selectCamera = (view: CameraView) => {
    setCameraView(view);
    setCameraRevision((value) => value + 1);
  };
  const time = (value: string) =>
    new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const status = !sourceReady
    ? t.disconnected
    : !state.root
      ? t.waiting
      : !state.available
        ? t.stale
        : statusLabels[locale][state.root.status];

  return (
    <section className="office-experience">
      <div className="office-heading">
        <div>
          <span className="office-eyebrow">{t.preview}</span>
          <h1>
            {state.root?.project ?? 'AI Office'}
            <span> / 01</span>
          </h1>
        </div>
        <div className="office-heading-actions">
          <span className="office-status">
            <i className={`dot ${state.available ? 'connected' : ''}`} />
            {status}
          </span>
          <button
            className="icon-button"
            aria-label={t.settings}
            aria-expanded={settings}
            onClick={() => setSettings((value) => !value)}
          >
            ☷
          </button>
          <button
            className="icon-button"
            aria-label={details ? t.collapse : t.open}
            aria-expanded={details}
            onClick={() => setDetails((value) => !value)}
          >
            ◫
          </button>
        </div>
      </div>
      <div className={`office-layout ${details ? '' : 'without-details'}`}>
        <aside className="room-sidebar" aria-label={t.rooms}>
          <div className="room-sidebar-title">
            <span>{t.rooms}</span>
            <span>{mains.length}</span>
          </div>
          <div className="room-choices">
            {mains.length ? (
              mains.map((session, index) => (
                <button
                  key={session.id}
                  className={`room-choice ${state.root?.id === session.id ? 'active' : ''}`}
                  aria-pressed={state.root?.id === session.id}
                  onClick={() => chooseRoom(session)}
                >
                  <span className="room-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="room-name">
                    <strong>{session.project}</strong>
                    <small>{shared[session.source]}</small>
                  </span>
                  <i className={`state-mark ${session.status}`} />
                </button>
              ))
            ) : (
              <p className="room-empty">{t.emptyRooms}</p>
            )}
          </div>
          <div className="room-sidebar-bottom">
            <span className="small-house" aria-hidden="true">
              ⌂
            </span>
            <p>{t.subtitle}</p>
            <span>{t.observed}</span>
          </div>
        </aside>
        <div className="office-world">
          <Suspense
            fallback={
              <div className="scene-loading" role="status">
                {t.loading}
              </div>
            }
          >
            <Scene
              root={state.root}
              team={state.team}
              locale={locale}
              connected={sourceReady}
              available={state.available}
              cameraView={cameraView}
              cameraRevision={cameraRevision}
              motion={motion}
              quality={quality}
              powerMode={powerMode}
              metricsEnabled={settings}
              selectedCharacter={selectedCharacter}
              onSelectCharacter={selectCharacter}
              onMetrics={setMetrics}
              onFallback={onEvents}
            />
          </Suspense>
          <div className="world-corner-note">
            <span>CHELEBY HOME</span>
            <small>{t.prototype}</small>
          </div>
          {settings && (
            <div className="scene-settings">
              <div className="settings-title">
                <strong>{t.settings}</strong>
                <button aria-label={t.collapse} onClick={() => setSettings(false)}>
                  ×
                </button>
              </div>
              <label htmlFor="scene-power">{t.power}</label>
              <select
                id="scene-power"
                value={powerMode}
                onChange={(event) => {
                  setPowerMode(event.target.value as PowerMode);
                  if (event.target.value === 'eco') setQuality('standard');
                }}
              >
                <option value="balanced">{t.balanced}</option>
                <option value="eco">{t.eco}</option>
              </select>
              <p className="power-note">{t.powerNote}</p>
              <label htmlFor="scene-quality">{t.quality}</label>
              <select
                id="scene-quality"
                value={quality}
                onChange={(event) => setQuality(event.target.value as SceneQuality)}
              >
                <option value="standard">{t.standard}</option>
                <option value="high" disabled={powerMode === 'eco'}>
                  {t.high}
                </option>
              </select>
              <label className="motion-toggle">
                <input
                  type="checkbox"
                  checked={motion}
                  onChange={(event) => setMotion(event.target.checked)}
                />
                {t.motion}
              </label>
              <details className="scene-metrics">
                <summary>{t.metrics}</summary>
                <p>
                  {metrics
                    ? `${metrics.fps} ${t.fps} · ${metrics.calls} ${t.draws} · ${metrics.triangles.toLocaleString(locale)} ${t.triangles}`
                    : t.noMetrics}
                </p>
                {metrics && (
                  <small>
                    {t.totalFrames}: {metrics.totalFrames.toLocaleString(locale)}
                  </small>
                )}
              </details>
            </div>
          )}
          <div className="camera-dock" role="group" aria-label={t.controls}>
            {(['room', 'desk', 'overview'] as const).map((view, index) => (
              <button
                key={view}
                aria-pressed={cameraView === view}
                onClick={() => selectCamera(view)}
              >
                <span aria-hidden="true">{['⌂', '▱', '▦'][index]}</span>
                {t[view]}
              </button>
            ))}
            <span className="dock-divider" />
            <button
              className="camera-reset"
              aria-label={t.reset}
              onClick={() => selectCamera('room')}
            >
              ↺
            </button>
          </div>
          <div className="camera-hint">
            <span className="pointer-hint">
              {t.drag} · {t.zoom}
            </span>
            <span className="touch-hint">{t.touch}</span>
          </div>
        </div>
        {details && (
          <aside className="office-inspector" aria-label={t.details}>
            <div className="inspector-section">
              <div className="inspector-title">
                <h2>{t.character}</h2>
                <span>0{selectedCharacter + 1}</span>
              </div>
              <div
                className={`character-token ${selectedCharacter === 0 ? 'hoodie' : 'robot-token'}`}
                aria-hidden="true"
              >
                <span>{selectedCharacter === 0 ? '⌂' : '⠿'}</span>
              </div>
              <h3>{selectedCharacter === 0 ? t.main : `${t.robot} ${selectedCharacter}`}</h3>
              <p className="character-subtitle">{character ? shared[character.source] : t.model}</p>
              <span className={`character-status ${character ? '' : 'preview'}`}>
                {character
                  ? characterAvailable
                    ? statusLabels[locale][character.status]
                    : t.stale
                  : t.model}
              </span>
              <div className="character-picker" role="group" aria-label={t.character}>
                {['#dab985', '#6f9ec5', '#99af6d', '#a491be'].map((color, index) => (
                  <button
                    key={color}
                    style={{ '--character-color': color } as CSSProperties}
                    aria-label={index === 0 ? t.main : `${t.robot} ${index}`}
                    aria-pressed={selectedCharacter === index}
                    onClick={() => selectCharacter(index)}
                  >
                    <span />
                    {index === 0 ? '01' : `0${index + 1}`}
                  </button>
                ))}
              </div>
              <p className="inspector-note">{character ? t.characterNote : t.previewRobots}</p>
            </div>
            <div className="inspector-section team-summary">
              <span>{t.team}</span>
              <strong>{state.team.length}</strong>
              <small>{shared.subagents}</small>
            </div>
            <div className="inspector-section activity-section">
              <div className="inspector-title">
                <h2>{t.activity}</h2>
                <i className={`dot ${state.available ? 'connected' : ''}`} />
              </div>
              <ol className="office-activity">
                {state.events.length ? (
                  state.events.map((event) => (
                    <li key={event.id}>
                      <time dateTime={event.occurredAt}>{time(event.occurredAt)}</time>
                      <span>
                        <strong>{eventLabels[locale][event.kind]}</strong>
                        {event.toolName && <code>{event.toolName}</code>}
                        {event.text && <p>{event.text}</p>}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="activity-empty">{t.empty}</li>
                )}
              </ol>
              <button className="open-events" onClick={onEvents}>
                {t.events}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </aside>
        )}
      </div>
      <div className="office-caption">
        <span>
          <i className={`dot ${sourceReady ? 'connected' : ''}`} />
          {sourceReady ? t.live : t.disconnected}
        </span>
        <span>{t.previewRobots}</span>
      </div>
    </section>
  );
}
