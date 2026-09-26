import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { SessionView, Source } from '../../shared/contract.ts';
import { useObserver } from '../use-observer.ts';
import { useLanguage } from '../use-language.ts';
import { useOfficeTheme } from './use-office-theme.ts';
import { useOfficeWeather } from './use-office-weather.ts';
import { WeatherSettings } from './OfficeWeather.tsx';
import { LocationSetup, locationTitle } from './LocationSetup.tsx';
import OfficeArtwork, { actorName, stateLabel } from './OfficeArtwork.tsx';
import { characters, type CharacterId } from './scene-layout.ts';
import {
  fixedOfficeState,
  restoredRoomId,
  freshness,
  latestMessage,
  remember,
  safeTime,
  sessionName,
  stored,
} from './fixed-state.ts';
import { WallFeed } from './WallFeed.tsx';
import { activityLabel } from './activity-labels.ts';
import { fixedCopy } from './copy.ts';
import { ProjectNavigator } from './ProjectNavigator.tsx';
import { OfficePower, officePowerLabel } from './OfficePower.tsx';
import { officeRooms } from './office-rooms.ts';
import { RoomIdentitySettings } from './RoomIdentity.tsx';
import { roomAccentKey } from './room-accent.ts';
import { Icon, type IconName } from './Icon.tsx';
import './fixed-office.css';

type Dialog = {
  kind: 'sessions' | 'actor' | 'tasks' | 'settings' | 'scope' | 'feed' | 'location' | 'identity';
  actor?: CharacterId;
  sessionId?: string;
} | null;

export default function FixedOfficeApp() {
  const [viewPaused, setPaused] = useState(false);
  const { snapshot, transportConnection: connection, runtime } = useObserver(viewPaused);
  const runtimePaused = Boolean(runtime && runtime.state !== 'running');
  const paused = viewPaused || runtimePaused;
  const [selectedId, setSelectedId] = useState(() => stored('cheleby.selected', ''));
  const selectionRestored = useRef(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [labels, setLabels] = useState(true);
  const [screens, setScreens] = useState(true);
  const [showCharacters, setShowCharacters] = useState(true);
  const [motionPreview, setMotionPreview] = useState(
    () => new URLSearchParams(window.location.search).get('motion') === 'preview',
  );
  const [robotMotionPreview, setRobotMotionPreview] = useState(
    () => new URLSearchParams(window.location.search).get('robotMotion') === 'preview',
  );
  const [mobilePanel, setMobilePanel] = useState<'feed' | 'agents'>('feed');
  const teamRef = useRef<HTMLElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const consoleRef = useRef<HTMLElement>(null);
  const office = fixedOfficeState(snapshot, selectedId);
  const {
    locale,
    preference: language,
    setPreference: setLanguage,
  } = useLanguage(office.root?.locale);
  const copy = fixedCopy[locale];
  const { theme, preference, location, setupDone, dawn, setTheme, saveLocation, skipSetup } =
    useOfficeTheme(now);
  const weather = useOfficeWeather(location, now);
  useEffect(() => {
    if (!setupDone) setDialog((current) => current ?? { kind: 'location' });
  }, [setupDone]);
  function closeDialog() {
    if (dialog?.kind === 'location' && !setupDone) skipSetup();
    setDialog(null);
  }
  const selected = office.members.find((s) => s.id === selectedId) ?? office.root;
  const stateProps = { copy, connection, paused, now };
  const hasWorkingRoom = officeRooms(snapshot, connection, paused, now).some(
    (room) => room.state === 'working' || room.state === 'waiting',
  );
  const runtimeLabel =
    runtimePaused && runtime && connection === 'connected'
      ? officePowerLabel(locale, runtime.state)
      : null;
  const roomIndicatorLabel =
    runtimeLabel ??
    (paused
      ? copy.paused
      : connection !== 'connected'
        ? copy[connection === 'connecting' ? 'connecting' : 'offline']
        : hasWorkingRoom
          ? copy.roomActive
          : copy.roomInactive);
  const actor = dialog?.actor;
  const detail = dialog?.sessionId
    ? office.members.find((s) => s.id === dialog.sessionId)
    : actor
      ? office.actors[actor]
      : selected;
  const detailName = actor ? actorName(actor, copy, detail) : sessionName(detail, copy.subagent);
  const detailsId = detail?.id ?? '';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = 'AI Office';
  }, [locale]);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const timer = window.setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  useEffect(() => {
    const element = dialogRef.current;
    if (!dialog || !element) return;
    const previous = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [dialog]);

  useEffect(() => {
    if (selectionRestored.current) return;
    const restored = restoredRoomId(snapshot, selectedId);
    if (restored === null) return;
    selectionRestored.current = true;
    setSelectedId(restored);
    remember('cheleby.selected', restored);
  }, [selectedId, snapshot]);

  function chooseSession(s: SessionView) {
    selectionRestored.current = true;
    setSelectedId(s.id);
    remember('cheleby.selected', s.id);
    setDialog(null);
  }
  function chooseActor(id: CharacterId) {
    const s = office.actors[id];
    if (s) {
      selectionRestored.current = true;
      setSelectedId(s.id);
      remember('cheleby.selected', s.id);
    }
    setDialog({ kind: 'actor', actor: id });
  }
  function history(id?: string) {
    if (id) remember('cheleby.selected', id);
    window.location.assign('/?view=events');
  }
  function focusPanel(ref: React.RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ block: 'nearest' });
    ref.current?.focus();
  }
  function sourceName(s: Source) {
    return s === 'desktop' ? copy.desktop : s === 'cli' ? copy.cli : copy.unknown;
  }
  function memberName(s: SessionView) {
    return sessionName(s, `${copy.subagent} · ${s.id.slice(-6)}`);
  }
  const nav: { key: string; label: string; icon: IconName; action?: () => void }[] = [
    {
      key: 'live',
      label: copy.office,
      icon: 'live',
      action: () => {
        setMobilePanel('feed');
        requestAnimationFrame(() => focusPanel(consoleRef));
      },
    },
    {
      key: 'agents',
      label: copy.agents,
      icon: 'agents',
      action: () => {
        setMobilePanel('agents');
        requestAnimationFrame(() => focusPanel(teamRef));
      },
    },
    { key: 'tasks', label: copy.tasks, icon: 'tasks', action: () => setDialog({ kind: 'tasks' }) },
    {
      key: 'terminal',
      label: copy.terminal,
      icon: 'terminal',
      action: () => history(selected?.id),
    },
    {
      key: 'projects',
      label: copy.projects,
      icon: 'files',
      action: () => setDialog({ kind: 'sessions' }),
    },
    { key: 'git', label: copy.git, icon: 'git', action: () => setDialog({ kind: 'scope' }) },
    {
      key: 'settings',
      label: copy.settings,
      icon: 'settings',
      action: () => setDialog({ kind: 'settings' }),
    },
  ];
  const counters = [
    { icon: 'tasks', name: copy.turns, value: office.counts.turns, color: '#618fff' },
    { icon: 'terminal', name: copy.tools, value: office.counts.starts, color: '#15c6bb' },
    { icon: 'check', name: copy.results, value: office.counts.results, color: '#b584ff' },
    { icon: 'agents', name: copy.team, value: office.members.length, color: '#efb852' },
  ] as const;

  return (
    <div className="fixed-office">
      <a
        className="fo-skip"
        href="#office-console"
        onClick={() => {
          setMobilePanel('feed');
          requestAnimationFrame(() => focusPanel(consoleRef));
        }}
      >
        {copy.office}
      </a>
      <aside className="fo-sidebar" aria-label="AI Office">
        <div className="fo-brand">
          AI<span>OFFICE</span>
        </div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.key}
              className={n.key === 'live' ? 'fo-nav-active' : ''}
              onClick={n.action}
              disabled={!n.action}
              title={n.action ? n.label : copy.future}
              aria-current={n.key === 'live' ? 'page' : undefined}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.key === 'live' && <i />}
            </button>
          ))}
        </nav>
        <div className="fo-sidebar-bottom">
          <button
            className="fo-project-picker"
            onClick={() => setDialog({ kind: 'sessions' })}
            title={office.root?.project}
          >
            <Icon name="layers" />
            <span>{office.root?.project ?? copy.selectSession}</span>
            <Icon name="chevron" size={12} />
          </button>
          <p className={`fo-connection fo-${connection}`} role="status">
            <span className="fo-dot" />
            {connection !== 'connected'
              ? copy[connection]
              : (runtimeLabel ?? (paused ? copy.paused : copy[connection]))}
          </p>
          <p>
            <Icon name="agents" size={13} />
            {office.members.length} {copy.team.toLocaleLowerCase(locale)}
          </p>
          <button
            className="fo-text-button"
            disabled={runtimePaused}
            onClick={() => setPaused((p) => !p)}
          >
            <Icon name={paused ? 'play' : 'pause'} size={13} />
            {paused ? copy.resume : copy.pause}
          </button>
        </div>
      </aside>
      <main className="fo-workspace" aria-label={copy.office}>
        <header className="fo-workspace-toolbar">
          <button className="fo-room-picker" onClick={() => setDialog({ kind: 'sessions' })}>
            <Icon name="layers" />
            <span>{office.root?.project ?? copy.selectSession}</span>
            <Icon name="chevron" size={14} />
          </button>
          <div className="fo-toolbar-actions">
            <button className="fo-expand-feed" onClick={() => setDialog({ kind: 'feed' })}>
              <Icon name="external" size={16} />
              {locale === 'tr' ? 'Akışı büyüt' : 'Expand feed'}
            </button>
            <OfficePower locale={locale} />
          </div>
        </header>
        <OfficeArtwork
          weather={weather}
          location={location}
          onOpenWeather={() => setDialog({ kind: location ? 'settings' : 'location' })}
          theme={theme}
          actors={office.actors}
          members={office.members}
          activeId={selected?.id}
          locale={locale}
          copy={copy}
          connection={connection}
          paused={paused}
          now={now}
          labels={labels}
          screens={screens}
          showCharacters={showCharacters}
          motionPreview={motionPreview}
          robotMotionPreview={robotMotionPreview}
          onCloseRobotMotion={() => setRobotMotionPreview(false)}
          onCloseMotion={() => setMotionPreview(false)}
          onSelect={chooseActor}
          onCustomize={() => setDialog({ kind: 'identity' })}
        />
        {(snapshot?.scan.status === 'source_missing' || snapshot?.scan.status === 'error') && (
          <div className="fo-source-banner" role="alert">
            {snapshot.scan.status === 'error' ? copy.scanError : copy.sourceMissing}
          </div>
        )}
        <div
          className="fo-panel-tabs"
          aria-label={locale === 'tr' ? 'Görünüm seçimi' : 'Choose view'}
        >
          <button
            aria-pressed={mobilePanel === 'feed'}
            aria-controls="office-console"
            onClick={() => setMobilePanel('feed')}
          >
            {copy.office}
          </button>
          <button
            aria-pressed={mobilePanel === 'agents'}
            aria-controls="office-team"
            onClick={() => setMobilePanel('agents')}
          >
            {copy.agents} · {office.members.length}
          </button>
        </div>
        <div className="fo-bottom-grid" data-mobile-panel={mobilePanel}>
          <section
            className="fo-panel fo-console"
            id="office-console"
            ref={consoleRef}
            tabIndex={-1}
            aria-label={copy.office}
          >
            <PanelHeader title={copy.office}>
              <button
                onClick={() => setDialog({ kind: 'feed' })}
                aria-label={locale === 'tr' ? 'Akışı büyüt' : 'Expand feed'}
              >
                <Icon name="external" size={16} />
              </button>
            </PanelHeader>
            <WallFeed
              expanded
              session={office.root}
              members={office.members}
              locale={locale}
              state={stateLabel(office.root, stateProps)}
            />
          </section>
          <section
            className="fo-panel fo-team"
            id="office-team"
            ref={teamRef}
            tabIndex={-1}
            aria-label={copy.agents}
          >
            <PanelHeader title={copy.agents}>
              <button
                onClick={() => setDialog({ kind: 'sessions' })}
                aria-label={copy.selectSession}
              >
                <Icon name="chevron" size={13} />
              </button>
            </PanelHeader>
            <div className="fo-team-list">
              {characters.map((c) => {
                const s = office.actors[c.id];
                return (
                  <button
                    key={c.id}
                    onClick={() => chooseActor(c.id)}
                    className={s && s.id === selected?.id ? 'fo-team-selected' : ''}
                    style={{ '--actor-color': c.color } as CSSProperties}
                  >
                    <span className="fo-avatar">
                      <Icon name={c.id === 'main' ? 'terminal' : 'agents'} />
                    </span>
                    <span>
                      <strong title={s?.agentTask ?? undefined}>{actorName(c.id, copy, s)}</strong>
                      {s && <small>{stateLabel(s, stateProps)}</small>}
                    </span>
                    <i
                      className={`fo-state-dot fo-fresh-${freshness(s, connection, paused, now)}`}
                    />
                  </button>
                );
              })}
              {office.team.length > 3 && (
                <button className="fo-overflow" onClick={() => setDialog({ kind: 'tasks' })}>
                  +{office.team.length - 3} · {copy.moreAgents}
                </button>
              )}
            </div>
            <footer>{copy.readOnly}</footer>
          </section>
        </div>
      </main>
      <aside className="fo-right" aria-label={copy.projects}>
        <section className="fo-panel fo-projects" tabIndex={-1} aria-label={copy.projects}>
          <PanelHeader title={copy.projects}>
            <span
              className="fo-room-indicator"
              data-active={hasWorkingRoom}
              role="status"
              aria-label={roomIndicatorLabel}
            >
              <i aria-hidden="true" />
              {roomIndicatorLabel}
            </span>
            <button onClick={() => setDialog({ kind: 'sessions' })} aria-label={copy.allSessions}>
              <Icon name="external" size={13} />
            </button>
          </PanelHeader>
          <ProjectNavigator
            snapshot={snapshot}
            selectedRootId={office.root?.id}
            {...stateProps}
            onSelect={chooseSession}
          />
          <button className="fo-panel-link" onClick={() => setDialog({ kind: 'sessions' })}>
            {copy.allSessions} →
          </button>
        </section>
        <section className="fo-panel fo-stats" tabIndex={-1} aria-label={copy.stats}>
          <PanelHeader title={copy.stats}>
            <button onClick={() => setDialog({ kind: 'scope' })} aria-label={copy.scope}>
              <Icon name="chevron" size={13} />
            </button>
          </PanelHeader>
          {counters.map((c) => (
            <div
              className="fo-stat"
              key={c.name}
              style={{ '--stat-color': c.color } as CSSProperties}
            >
              <span className="fo-stat-icon">
                <Icon name={c.icon} />
              </span>
              <span>{c.name}</span>
              <strong>{snapshot ? c.value : '—'}</strong>
            </div>
          ))}
          <p className="fo-stat-note">{copy.readWindow}</p>
        </section>
      </aside>
      <dialog
        ref={dialogRef}
        className={`fo-dialog${dialog?.kind === 'feed' ? ' fo-feed-dialog' : ''}`}
        onCancel={closeDialog}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const elements = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button, a[href], input, select, textarea, summary, [tabindex]',
            ),
          ).filter(
            (element) =>
              element.tabIndex >= 0 &&
              !element.matches(':disabled') &&
              element.getClientRects().length,
          );
          const first = elements[0];
          const last = elements.at(-1);
          if (!first || !last) return;
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              !elements.includes(document.activeElement as HTMLElement))
          ) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDialog();
        }}
        aria-labelledby="fo-dialog-title"
      >
        <div className="fo-dialog-content">
          <header>
            <span className="fo-eyebrow">AI OFFICE</span>
            <button onClick={closeDialog} aria-label={copy.close}>
              <Icon name="close" />
            </button>
            <h2 id="fo-dialog-title">
              {dialog?.kind === 'identity'
                ? locale === 'tr'
                  ? 'Odayı kişiselleştir'
                  : 'Personalize room'
                : dialog?.kind === 'location'
                  ? locationTitle(locale)
                  : dialog?.kind === 'feed'
                    ? locale === 'tr'
                      ? 'Canlı akış'
                      : 'Live feed'
                    : dialog?.kind === 'sessions'
                      ? copy.selectSession
                      : dialog?.kind === 'settings'
                        ? copy.settings
                        : dialog?.kind === 'scope'
                          ? copy.scope
                          : dialog?.kind === 'tasks'
                            ? copy.tasks
                            : detailName}
            </h2>
          </header>
          {dialog?.kind === 'identity' && office.root && (
            <RoomIdentitySettings
              key={roomAccentKey(office.root)}
              project={office.root}
              locale={locale}
            />
          )}
          {dialog?.kind === 'feed' && (
            <WallFeed
              expanded
              session={office.root}
              members={office.members}
              locale={locale}
              state={stateLabel(office.root, stateProps)}
            />
          )}
          {dialog?.kind === 'sessions' && (
            <ProjectNavigator
              snapshot={snapshot}
              selectedRootId={office.root?.id}
              {...stateProps}
              onSelect={chooseSession}
              expandedView
            />
          )}
          {dialog?.kind === 'actor' && (
            <>
              {detail ? (
                <>
                  <div className="fo-detail-status">
                    <span className="fo-dot" />
                    {stateLabel(detail, stateProps)}
                  </div>
                  <dl>
                    <dt>{copy.source}</dt>
                    <dd>{sourceName(detail.source)}</dd>
                    <dt>{copy.session}</dt>
                    <dd>
                      <code>{detailsId}</code>
                    </dd>
                    <dt>{copy.updated}</dt>
                    <dd>{safeTime(detail.lastEventAt, locale)}</dd>
                    <dt>{copy.tools}</dt>
                    <dd>{activityLabel(detail, locale)}</dd>
                  </dl>
                  <h3>{copy.observedTask}</h3>
                  <p className="fo-muted">{copy.taskNote}</p>
                  <pre className="fo-message">{latestMessage(detail) ?? copy.noTask}</pre>
                  {detail.historyPartial && (
                    <p className="fo-muted">
                      {copy.partial} · {copy.partialNote}
                    </p>
                  )}
                  <button className="fo-primary" onClick={() => history(detail.id)}>
                    {copy.openEvents}
                    <Icon name="external" size={14} />
                  </button>
                </>
              ) : (
                <Empty icon="agents">{copy.previewNote}</Empty>
              )}
            </>
          )}
          {dialog?.kind === 'tasks' && (
            <div className="fo-task-list">
              <p className="fo-muted">{copy.taskNote}</p>
              {office.members.length ? (
                office.members.map((s) => (
                  <button key={s.id} onClick={() => setDialog({ kind: 'actor', sessionId: s.id })}>
                    <strong>
                      {memberName(s)}
                      <small>{stateLabel(s, stateProps)}</small>
                    </strong>
                    <p>{latestMessage(s)?.slice(0, 240) ?? copy.noTask}</p>
                  </button>
                ))
              ) : (
                <Empty icon="tasks">{copy.noSessions}</Empty>
              )}
            </div>
          )}
          {dialog?.kind === 'scope' && (
            <>
              <p>{copy.scopeNote}</p>
              <dl>
                {counters.map((c) => (
                  <div className="fo-scope-count" key={c.name}>
                    <dt>{c.name}</dt>
                    <dd>{snapshot ? c.value : '—'}</dd>
                  </div>
                ))}
              </dl>
              <p className="fo-muted">{copy.cameraNote}</p>
              <p>{copy.fileNote}</p>
              <dl>
                <dt>{copy.source}</dt>
                <dd>Codex Desktop + CLI</dd>
                <dt>{copy.checked}</dt>
                <dd>{safeTime(snapshot?.scan.checkedAt, locale)}</dd>
                <dt>{copy.record}</dt>
                <dd>{snapshot?.scan.files ?? '—'}</dd>
                <dt>{copy.status}</dt>
                <dd>{copy[connection]}</dd>
              </dl>
              <p className="fo-muted">
                {copy.readWindow} {copy.partialNote} {copy.discoveryNote}
              </p>
            </>
          )}
          {dialog?.kind === 'location' && (
            <LocationSetup
              key={location?.id ?? 'new'}
              locale={locale}
              location={location}
              firstRun={!setupDone}
              onSave={(city) => {
                saveLocation(city);
                setDialog(null);
              }}
              onCancel={closeDialog}
            />
          )}
          {dialog?.kind === 'settings' && (
            <>
              {office.root && (
                <button
                  className="fo-room-customize"
                  onClick={() => setDialog({ kind: 'identity' })}
                >
                  {locale === 'tr' ? 'Odayı kişiselleştir' : 'Personalize room'} ·{' '}
                  {office.root.project}
                </button>
              )}
              <h3>{copy.preferences}</h3>
              <label className="fo-setting">
                {copy.language}
                <select
                  value={language}
                  aria-describedby="office-language-help"
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="auto">{copy.automatic}</option>
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </select>
              </label>
              <p className="fo-muted" id="office-language-help">
                {copy.languageHelp}
              </p>
              <label className="fo-setting">
                {copy.appearance}
                <select
                  value={preference}
                  aria-label={copy.appearance}
                  aria-describedby="office-theme-help"
                  onChange={(e) => {
                    if (e.target.value === 'auto' && !location) setDialog({ kind: 'location' });
                    else setTheme(e.target.value);
                  }}
                >
                  <option value="auto">{copy.automatic}</option>
                  <option value="day">{copy.day}</option>
                  <option value="sunset">{copy.sunset}</option>
                  <option value="night">{copy.night}</option>
                </select>
              </label>
              <p className="fo-muted" id="office-theme-help">
                {copy.appearanceHelp}
              </p>
              <div className="fo-location-summary">
                <p>
                  {location ? (
                    <>
                      <strong>{location.name}</strong> ·{' '}
                      {new Intl.DateTimeFormat(locale, {
                        timeZone: location.timezone,
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(now)}{' '}
                      · {dawn ? copy.dawn : copy[theme]}
                    </>
                  ) : (
                    copy.noLocation
                  )}
                </p>
                <button onClick={() => setDialog({ kind: 'location' })}>
                  {location ? copy.changeLocation : copy.chooseLocation}
                </button>
              </div>
              <WeatherSettings weather={weather} locale={locale} location={location} />
              <label className="fo-setting">
                {copy.labels}
                <input
                  type="checkbox"
                  checked={labels}
                  onChange={(e) => setLabels(e.target.checked)}
                />
              </label>
              <label className="fo-setting">
                {copy.screens}
                <input
                  type="checkbox"
                  checked={screens}
                  onChange={(e) => setScreens(e.target.checked)}
                />
              </label>
              <details className="fo-advanced">
                <summary>{locale === 'tr' ? 'Gelişmiş seçenekler' : 'Advanced options'}</summary>
                <h3>{copy.layerTitle}</h3>
                <p className="fo-muted">{copy.layerNote}</p>
                <label className="fo-setting">
                  {copy.showCharacters}
                  <input
                    type="checkbox"
                    checked={showCharacters}
                    onChange={(e) => setShowCharacters(e.target.checked)}
                  />
                </label>
                <label className="fo-setting">
                  {locale === 'tr' ? 'Cheleby hareket önizlemesi' : 'Cheleby motion preview'}
                  <input
                    type="checkbox"
                    checked={motionPreview}
                    onChange={(e) => setMotionPreview(e.target.checked)}
                  />
                </label>
                <label className="fo-setting">
                  {locale === 'tr' ? 'Robot hareket önizlemesi' : 'Robot motion preview'}
                  <input
                    type="checkbox"
                    checked={robotMotionPreview}
                    onChange={(e) => setRobotMotionPreview(e.target.checked)}
                  />
                </label>
                <div className="fo-prototype-links">
                  <a href="/?view=legacy">
                    {copy.legacy}
                    <Icon name="external" size={12} />
                  </a>
                  <a href="/?view=blender">
                    {copy.blender}
                    <Icon name="external" size={12} />
                  </a>
                </div>
              </details>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}

function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="fo-panel-header">
      <h2>{title}</h2>
      {children}
    </header>
  );
}
function Empty({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="fo-empty">
      <Icon name={icon} size={24} />
      <p>{children}</p>
    </div>
  );
}
