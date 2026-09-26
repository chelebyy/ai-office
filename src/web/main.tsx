import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { dictionaries, eventLabels, statusLabels } from './i18n.ts';
import { useLanguage } from './use-language.ts';
import { remember, stored } from './fixed-office/fixed-state.ts';
import { useObserver } from './use-observer.ts';
import type { SessionView, Source } from '../shared/contract.ts';
import { OfficeView } from './office/OfficeView.tsx';
import { officeText } from './office/office-state.ts';
import './styles.css';

const BlenderPilot = lazy(() => import('./office/BlenderPilot.tsx'));
const FixedOfficeApp = lazy(() => import('./fixed-office/FixedOfficeApp.tsx'));
const requestedView = new URLSearchParams(window.location.search).get('view');

function App() {
  const [view, setView] = useState<'office' | 'events'>(
    requestedView === 'events' ? 'events' : 'office',
  );
  const [paused, setPaused] = useState(false);
  const { snapshot, connection } = useObserver(paused);
  const [selectedId, setSelectedId] = useState<string | null>(() => stored('cheleby.selected', ''));
  const [source, setSource] = useState<Source | 'all'>('all');
  const [showInternal, setShowInternal] = useState(false);
  const [tab, setTab] = useState<'events' | 'coverage'>('events');
  const sessions = snapshot?.sessions ?? [];
  const visible = sessions.filter(
    (s) =>
      (showInternal || s.agentKind !== 'internal') && (source === 'all' || s.source === source),
  );
  const selected =
    visible.find((s) => s.id === selectedId) ??
    visible.find((s) => s.agentKind === 'main') ??
    visible[0];
  const { locale, source: localeSource } = useLanguage(selected?.locale);
  useEffect(() => {
    if (selected?.id) {
      setSelectedId(selected.id);
      remember('cheleby.selected', selected.id);
    }
  }, [selected?.id, selected?.locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `AI Office · ${view === 'office' ? officeText[locale].office : dictionaries[locale].studio}`;
  }, [locale, view]);
  const t = dictionaries[locale];
  const time = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date(value))
      : '—';
  const relative = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  const isStale = selected && Date.now() - Date.parse(selected.lastEventAt) > 120000;
  const mains = sessions.filter((s) => s.agentKind === 'main');
  const subagents = sessions.filter((s) => s.agentKind === 'subagent');
  const selectSession = (session: SessionView) => {
    setSelectedId(session.id);
    setTab('events');
  };

  return (
    <div className={`app-shell ${view === 'office' ? 'office-mode' : ''}`}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="AI Office">
          <span className="brand-mark" aria-hidden="true">
            ⌂
          </span>
          <span>
            AI<span className="brand-light"> Office</span>
            <small>{view === 'office' ? officeText[locale].identity : t.studio}</small>
          </span>
        </a>
        <div className="app-view-switch" role="group" aria-label={officeText[locale].settings}>
          <button
            aria-pressed={view === 'office'}
            onClick={() => {
              setPaused(false);
              setView('office');
            }}
          >
            {officeText[locale].office}
          </button>
          <button aria-pressed={view === 'events'} onClick={() => setView('events')}>
            {officeText[locale].events}
          </button>
        </div>
        <a href="/?view=blender" className="local-tag">
          {t.blenderPreview}
        </a>
        <div className="connection">
          <span className={`dot ${connection}`} aria-hidden="true" />
          <span role="status">{t[connection]}</span>
          <span className="local-tag">127.0.0.1</span>
        </div>
      </header>
      <main>
        {view === 'office' ? (
          <OfficeView
            snapshot={snapshot}
            selected={selected}
            locale={locale}
            connection={connection}
            onSelect={selectSession}
            onEvents={() => setView('events')}
          />
        ) : (
          <div>
            <section className="intro">
              <div>
                <p className="eyebrow">{t.phase}</p>
                <h1>{t.intro}</h1>
                <p className="intro-copy">{t.introBody}</p>
              </div>
              <div className="intro-note">
                <span className="outline-house" aria-hidden="true">
                  ⌂
                </span>
                <p>{t.support}</p>
              </div>
            </section>
            <section className="metrics" aria-label={t.local}>
              <div>
                <span className="metric-index">01</span>
                <strong>{snapshot ? mains.length : '—'}</strong>
                <span>{t.mainSessions}</span>
              </div>
              <div>
                <span className="metric-index">02</span>
                <strong>{snapshot ? subagents.length : '—'}</strong>
                <span>{t.subagents}</span>
              </div>
              <div>
                <span className="metric-index">03</span>
                <strong>
                  {snapshot ? `${snapshot.scan.files} / ${snapshot.scan.candidateFiles}` : '—'}
                </strong>
                <span>{t.records}</span>
              </div>
              <div className="metric-check">
                <span className="metric-index">04</span>
                <strong>{time(snapshot?.scan.checkedAt ?? null)}</strong>
                <span>{t.scan}</span>
              </div>
            </section>
            {snapshot?.scan.status === 'source_missing' && (
              <p className="notice" role="status">
                {t.missing}
              </p>
            )}
            {snapshot?.scan.status === 'error' && (
              <p className="notice" role="alert">
                {t.scanError}
              </p>
            )}
            <div className="workspace">
              <aside className="sessions-panel" aria-label={t.sessions}>
                <div className="panel-title">
                  <h2>{t.sessions}</h2>
                  <span className="count">{visible.length}</span>
                </div>
                <div className="source-filter" role="group" aria-label={t.source}>
                  {(['all', 'desktop', 'cli'] as const).map((item) => (
                    <button
                      key={item}
                      aria-pressed={source === item}
                      onClick={() => setSource(item)}
                    >
                      {t[item]}
                    </button>
                  ))}
                </div>
                <div className="session-list">
                  {!visible.length && (
                    <div className="empty-state compact">
                      <span aria-hidden="true">◎</span>
                      <h3>{t.noSessions}</h3>
                      <p>{t.noSessionsBody}</p>
                    </div>
                  )}
                  {visible.map((session) => (
                    <button
                      className={`session-row ${selected?.id === session.id ? 'selected' : ''}`}
                      key={session.id}
                      onClick={() => selectSession(session)}
                      aria-pressed={selected?.id === session.id}
                    >
                      <span className={`session-icon ${session.agentKind}`} aria-hidden="true">
                        {session.agentKind === 'main'
                          ? '⌂'
                          : session.agentKind === 'subagent'
                            ? '↳'
                            : '◇'}
                      </span>
                      <span className="session-info">
                        <strong>{session.project}</strong>
                        <span>
                          {t[session.source]} · {session.id.slice(0, 8)}
                        </span>
                        <small>{relative(session.lastEventAt)}</small>
                      </span>
                      <span
                        className={`state-mark ${session.status}`}
                        title={statusLabels[locale][session.status]}
                        aria-label={statusLabels[locale][session.status]}
                      />
                    </button>
                  ))}
                </div>
                <label className="helper-toggle">
                  <input
                    type="checkbox"
                    checked={showInternal}
                    onChange={(event) => setShowInternal(event.target.checked)}
                  />
                  {t.helperToggle}
                </label>
                <p className="scope-note">
                  {snapshot?.scan.recentDays ?? 7} {t.recentDays}
                </p>
              </aside>
              <section className="detail-panel" aria-label={selected?.project ?? t.events}>
                {selected ? (
                  <>
                    <div className="detail-heading">
                      <div>
                        <p className="eyebrow">
                          {selected.agentKind === 'main'
                            ? t.root
                            : selected.agentKind === 'subagent'
                              ? t.child
                              : t.internal}
                        </p>
                        <h2>{selected.project}</h2>
                      </div>
                      <span className={`status-badge ${selected.status}`}>
                        {statusLabels[locale][selected.status]}
                      </span>
                    </div>
                    <div className="metadata">
                      <span>
                        {t.source}
                        <strong>{t[selected.source]}</strong>
                      </span>
                      <span>
                        {t.version}
                        <strong>{selected.version}</strong>
                      </span>
                      <span>
                        {t.lastEvent}
                        <strong>{time(selected.lastEventAt)}</strong>
                      </span>
                      <span>
                        {t.locale}
                        <strong>
                          {locale.toUpperCase()} ·{' '}
                          {localeSource === 'preference'
                            ? t.localePreference
                            : localeSource === 'session'
                              ? t.localeSession
                              : t.localeBrowser}
                        </strong>
                      </span>
                    </div>
                    {!selected.recordAvailable && <p className="notice inline">{t.unavailable}</p>}
                    {selected.recordAvailable && isStale && (
                      <p className="notice inline subtle">{t.stale}</p>
                    )}
                    {selected.parentId && !selected.parentResolved && (
                      <p className="notice inline">{t.unresolved}</p>
                    )}
                    <div className="stream-toolbar">
                      <div className="tabs" role="group" aria-label={t.observed}>
                        <button aria-pressed={tab === 'events'} onClick={() => setTab('events')}>
                          {t.events}
                        </button>
                        <button
                          aria-pressed={tab === 'coverage'}
                          onClick={() => setTab('coverage')}
                        >
                          {t.coverage}
                        </button>
                      </div>
                      <button
                        className={`pause-button ${paused ? 'is-paused' : ''}`}
                        aria-label={paused ? t.resume : t.pause}
                        onClick={() => setPaused((value) => !value)}
                      >
                        {paused ? '▶' : 'Ⅱ'} <span>{paused ? t.resume : t.pause}</span>
                      </button>
                    </div>
                    {tab === 'events' ? (
                      <>
                        <div className="stream-summary">
                          <span>
                            <i className={`dot ${paused ? '' : connection}`} aria-hidden="true" />
                            {paused
                              ? t.paused
                              : connection === 'connected'
                                ? t.live
                                : t[connection]}
                          </span>
                          <span>
                            {selected.events.length} {t.retained.toLocaleLowerCase(locale)}
                          </span>
                        </div>
                        {selected.historyPartial && (
                          <details className="history-note">
                            <summary>{t.partial}</summary>
                            <p>{t.partialBody}</p>
                          </details>
                        )}
                        <ol className="event-stream">
                          {selected.events.length === 0 && (
                            <li className="empty-state">{t.emptyEvents}</li>
                          )}
                          {[...selected.events].reverse().map((event) => (
                            <li key={event.id} className={`event event-${event.kind}`}>
                              <time dateTime={event.occurredAt}>{time(event.occurredAt)}</time>
                              <span className="event-node" aria-hidden="true" />
                              <div className="event-content">
                                <div className="event-title">
                                  <strong>{eventLabels[locale][event.kind]}</strong>
                                  {event.toolName && <code>{event.toolName}</code>}
                                </div>
                                {event.text && <p className="message-text">{event.text}</p>}
                                {event.outcome === 'unknown' && <small>{t.resultUnknown}</small>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </>
                    ) : (
                      <div className="coverage-view">
                        <dl className="coverage-table">
                          {(
                            [
                              'Identity',
                              'Relation',
                              'State',
                              'Messages',
                              'Results',
                              'Tokens',
                              'Live',
                            ] as const
                          ).map((key) => (
                            <div key={key}>
                              <dt>{t[`rule${key}`]}</dt>
                              <dd>{t[`rule${key}Value`]}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="scope-note">{t.toolsOpaque}</p>
                        <div className="count-strip">
                          <span>
                            {t.countTurns}
                            <strong>{selected.counts.turns}</strong>
                          </span>
                          <span>
                            {t.countTools}
                            <strong>{selected.counts.toolStarts}</strong>
                          </span>
                          <span>
                            {t.countResults}
                            <strong>{selected.counts.toolCompletions}</strong>
                          </span>
                        </div>
                        <dl className="ids">
                          <dt>{t.sessionId}</dt>
                          <dd>{selected.id}</dd>
                          <dt>{t.parentId}</dt>
                          <dd>{selected.parentId ?? t.noParent}</dd>
                        </dl>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-state large">
                    <span aria-hidden="true">⌂</span>
                    <h2>{t.select}</h2>
                  </div>
                )}
              </section>
            </div>
            <details className="diagnostics">
              <summary>
                {t.diagnostics}
                <span>{snapshot?.scan.lastReadDurationMs ?? '—'} ms</span>
              </summary>
              <dl>
                {(['malformed', 'oversized', 'resets', 'errors', 'unsupported'] as const).map(
                  (key, index) => (
                    <div key={key}>
                      <dt>{t[key]}</dt>
                      <dd>
                        {snapshot
                          ? [
                              snapshot.scan.malformedLines,
                              snapshot.scan.oversizedLines,
                              snapshot.scan.resets,
                              snapshot.scan.readErrors,
                              snapshot.scan.unsupportedRecords,
                            ][index]
                          : '—'}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
              <p>{t.fallback}</p>
            </details>
          </div>
        )}
      </main>
      <footer>
        <span>{t.privacy}</span>
        <span>
          AI OFFICE <span className="footer-version">v0.2</span>
        </span>
      </footer>
    </div>
  );
}
function OfficeLoading() {
  const { locale } = useLanguage();
  return (
    <div role="status" style={{ padding: 32 }}>
      {dictionaries[locale].loading}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<OfficeLoading />}>
      {requestedView === 'blender' ? (
        <BlenderPilot />
      ) : requestedView === 'legacy' || requestedView === 'events' ? (
        <App />
      ) : (
        <FixedOfficeApp />
      )}
    </Suspense>
  </StrictMode>,
);
