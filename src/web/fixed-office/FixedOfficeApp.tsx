import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Locale, SessionView, Source } from '../../shared/contract.ts';
import { useObserver } from '../use-observer.ts';
import { browserLocale, eventLabels } from '../i18n.ts';
import OfficeArtwork, { actorName, stateLabel } from './OfficeArtwork.tsx';
import { characters, CLEAN_PLATE, type CharacterId } from './scene-layout.ts';
import {
  fixedOfficeState,
  freshness,
  lastTool,
  latestMessage,
  remember,
  safeTime,
  sessionName,
  stored,
  toolEvents,
} from './fixed-state.ts';
import { fixedCopy } from './copy.ts';
import { Icon, type IconName } from './Icon.tsx';
import './fixed-office.css';

type Dialog = {
  kind: 'sessions' | 'actor' | 'tasks' | 'settings' | 'scope';
  actor?: CharacterId;
  sessionId?: string;
} | null;

export default function FixedOfficeApp() {
  const [paused, setPaused] = useState(false);
  const { snapshot, connection } = useObserver(paused);
  const [selectedId, setSelectedId] = useState(() => stored('cheleby.selected', ''));
  const [language, setLanguage] = useState(() => stored('cheleby.office.language', 'auto'));
  const [dialog, setDialog] = useState<Dialog>(null);
  const [labels, setLabels] = useState(true);
  const [screens, setScreens] = useState(true);
  const [showCharacters, setShowCharacters] = useState(true);
  const [motionPreview, setMotionPreview] = useState(
    () => new URLSearchParams(window.location.search).get('motion') === 'preview',
  );
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<Source | 'all'>('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [now, setNow] = useState(() => Date.now());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const consoleRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLElement>(null);
  const office = fixedOfficeState(snapshot, selectedId);
  const locale: Locale =
    language === 'tr' || language === 'en' ? language : (office.root?.locale ?? browserLocale());
  const copy = fixedCopy[locale];
  const selected = office.members.find((s) => s.id === selectedId) ?? office.root;
  const stateProps = { copy, connection, paused, now };
  const actor = dialog?.actor;
  const detail = dialog?.sessionId
    ? office.members.find((s) => s.id === dialog.sessionId)
    : actor
      ? office.actors[actor]
      : selected;
  const detailName = actor
    ? actorName(actor, copy, detail)
    : sessionName(detail, copy.subagent);
  const detailsId = detail?.id ?? '';
  const activity = office.events
    .filter(({ session }) => activityFilter === 'all' || session.id === activityFilter)
    .slice(0, 10);
  const candidates = office.mains.filter(
    (s) =>
      (source === 'all' || s.source === source) &&
      `${s.project} ${s.id}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)),
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = 'Cheleby · Codex AI Office';
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
    setActivityFilter('all');
  }, [office.root?.id]);

  function chooseSession(s: SessionView) {
    setSelectedId(s.id);
    remember('cheleby.selected', s.id);
    setDialog(null);
  }
  function chooseActor(id: CharacterId) {
    const s = office.actors[id];
    if (s) {
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
  function eventText(e: SessionView['events'][number]) {
    return `${eventLabels[locale][e.kind]}${e.toolName ? ` · ${e.toolName}` : ''}${e.outcome === 'error' ? ' · error' : ''}`;
  }
  const nav: { key: string; label: string; icon: IconName; action?: () => void }[] = [
    { key: 'live', label: copy.office, icon: 'live', action: () => setDialog(null) },
    {
      key: 'agents',
      label: copy.agents,
      icon: 'agents',
      action: () => setDialog({ kind: 'sessions' }),
    },
    { key: 'tasks', label: copy.tasks, icon: 'tasks', action: () => setDialog({ kind: 'tasks' }) },
    {
      key: 'terminal',
      label: copy.terminal,
      icon: 'terminal',
      action: () => focusPanel(consoleRef),
    },
    { key: 'files', label: copy.files, icon: 'files', action: () => setDialog({ kind: 'scope' }) },
    { key: 'git', label: copy.git, icon: 'git', action: () => setDialog({ kind: 'scope' }) },
    { key: 'deploy', label: copy.deploy, icon: 'deploy' },
    {
      key: 'analytics',
      label: copy.analytics,
      icon: 'analytics',
      action: () => focusPanel(statsRef),
    },
    { key: 'replay', label: copy.replay, icon: 'replay' },
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
      <a className="fo-skip" href="#office-console">
        {copy.terminal}
      </a>
      <aside className="fo-sidebar" aria-label="Codex">
        <div className="fo-brand">
          CODEX<span>AI OFFICE</span>
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
            {paused ? copy.paused : copy[connection]}
          </p>
          <p>
            <Icon name="agents" size={13} />
            {office.members.length} {copy.team.toLocaleLowerCase(locale)}
          </p>
          <button className="fo-text-button" onClick={() => setPaused((p) => !p)}>
            <Icon name={paused ? 'play' : 'pause'} size={13} />
            {paused ? copy.resume : copy.pause}
          </button>
        </div>
      </aside>
      <main className="fo-workspace" aria-label={copy.office}>
        <OfficeArtwork
          actors={office.actors}
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
          onCloseMotion={() => setMotionPreview(false)}
          onSelect={chooseActor}
        />
        {(snapshot?.scan.status === 'source_missing' || snapshot?.scan.status === 'error') && (
          <div className="fo-source-banner" role="alert">
            {snapshot.scan.status === 'error' ? copy.scanError : copy.sourceMissing}
          </div>
        )}
        <div className="fo-bottom-grid">
          <section
            className="fo-panel fo-console"
            id="office-console"
            ref={consoleRef}
            tabIndex={-1}
            aria-label={copy.terminal}
          >
            <PanelHeader
              title={`${copy.terminal} (${selected ? memberName(selected) : copy.main})`}
            >
              <button onClick={() => history(selected?.id)} aria-label={copy.openEvents}>
                <Icon name="external" size={13} />
              </button>
            </PanelHeader>
            <div className="fo-console-lines">
              {selected && toolEvents(selected.events).length ? (
                toolEvents(selected.events).map((e) => (
                  <p
                    key={e.id}
                    className={
                      e.outcome === 'error'
                        ? 'fo-error'
                        : e.outcome === 'success'
                          ? 'fo-success'
                          : ''
                    }
                  >
                    <time>{safeTime(e.occurredAt, locale)}</time>
                    <span>
                      {e.kind === 'tool_completed' ? '←' : '›'} {eventText(e)}
                    </span>
                  </p>
                ))
              ) : (
                <Empty icon="terminal">{copy.emptyConsole}</Empty>
              )}
            </div>
            <footer>{selected ? stateLabel(selected, stateProps) : copy.noLive}</footer>
          </section>
          <section className="fo-panel fo-team" aria-label={copy.agents}>
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
                      <small>{stateLabel(s, stateProps)}</small>
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
          <section className="fo-panel fo-files" aria-label={copy.files}>
            <PanelHeader title={copy.files}>
              <button onClick={() => setDialog({ kind: 'scope' })} aria-label={copy.scope}>
                <Icon name="external" size={13} />
              </button>
            </PanelHeader>
            <div className="fo-file-columns">
              <span>{copy.record}</span>
              <span>{copy.status}</span>
            </div>
            <Empty icon="files">{copy.fileNote}</Empty>
            <button className="fo-panel-link" onClick={() => setDialog({ kind: 'scope' })}>
              {copy.scope} →
            </button>
          </section>
        </div>
      </main>
      <aside className="fo-right" aria-label={copy.activity}>
        <section className="fo-panel fo-activity">
          <PanelHeader title={copy.activity}>
            <select
              aria-label={copy.allAgents}
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
            >
              <option value="all">{copy.allAgents}</option>
              {office.members.map((s) => (
                <option key={s.id} value={s.id}>
                  {memberName(s)}
                </option>
              ))}
            </select>
          </PanelHeader>
          <div className="fo-activity-list">
            {activity.length ? (
              activity.map(({ session, event }) => (
                <button
                  key={`${session.id}-${event.id}`}
                  onClick={() => setDialog({ kind: 'actor', sessionId: session.id })}
                >
                  <i className={`fo-event-dot fo-event-${event.kind}`} />
                  <time>{safeTime(event.occurredAt, locale).slice(0, 5)}</time>
                  <span>
                    <b>{memberName(session)}</b>
                    <span title={eventText(event)}>{eventText(event)}</span>
                  </span>
                </button>
              ))
            ) : (
              <Empty icon="clock">{copy.noEvents}</Empty>
            )}
          </div>
        </section>
        <section className="fo-panel fo-stats" ref={statsRef} tabIndex={-1} aria-label={copy.stats}>
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
        <section className="fo-panel fo-camera">
          <PanelHeader title={copy.staticView} />
          <div className="fo-camera-preview">
            <svg viewBox="150 0 1135 757" aria-hidden="true">
              <image href={CLEAN_PLATE} width="1536" height="1024" />
            </svg>
            <div />
          </div>
          <p>{copy.cameraNote}</p>
        </section>
      </aside>
      <dialog
        ref={dialogRef}
        className="fo-dialog"
        onCancel={() => setDialog(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDialog(null);
        }}
        aria-labelledby="fo-dialog-title"
      >
        <div className="fo-dialog-content">
          <header>
            <span className="fo-eyebrow">CODEX / AI OFFICE</span>
            <button onClick={() => setDialog(null)} aria-label={copy.close}>
              <Icon name="close" />
            </button>
            <h2 id="fo-dialog-title">
              {dialog?.kind === 'sessions'
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
          {dialog?.kind === 'sessions' && (
            <>
              <div className="fo-session-filters">
                <label>
                  <Icon name="search" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={copy.search}
                    aria-label={copy.search}
                  />
                </label>
                <select
                  aria-label={copy.source}
                  value={source}
                  onChange={(e) => setSource(e.target.value as Source | 'all')}
                >
                  <option value="all">{copy.allSources}</option>
                  {(['desktop', 'cli', 'unknown'] as const).map((s) => (
                    <option key={s} value={s}>
                      {sourceName(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fo-session-list">
                {candidates.length ? (
                  candidates.map((s) => (
                    <button key={s.id} onClick={() => chooseSession(s)}>
                      <strong>{s.project}</strong>
                      <small>
                        {sourceName(s.source)} · {safeTime(s.lastEventAt, locale)} ·{' '}
                        {stateLabel(s, stateProps)}
                      </small>
                      <code>{s.id}</code>
                    </button>
                  ))
                ) : (
                  <Empty icon="agents">
                    {office.mains.length ? copy.noMatch : copy.noSessions}
                  </Empty>
                )}
              </div>
            </>
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
                    <dd>{lastTool(detail) ?? copy.noTool}</dd>
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
                {copy.readWindow} {copy.partialNote}
              </p>
            </>
          )}
          {dialog?.kind === 'settings' && (
            <>
              <h3>{copy.preferences}</h3>
              <label className="fo-setting">
                {copy.language}
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    remember('cheleby.office.language', e.target.value);
                  }}
                >
                  <option value="auto">{copy.automatic}</option>
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </select>
              </label>
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
