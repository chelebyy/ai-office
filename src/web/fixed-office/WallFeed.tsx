import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { Locale, SessionView } from '../../shared/contract.ts';
import { safeTime } from './fixed-state.ts';
import { actionLabel, toolLabel } from './activity-labels.ts';
import { ProjectName } from './RoomIdentity.tsx';
import { sessionTitle } from './office-rooms.ts';
import { roomFeed } from './room-feed.ts';
import './wall-feed.css';

function Message({ text }: { text: string }) {
  return (
    <>
      {text.split(/(```[\s\S]*?```)/g).map((part, index) =>
        part.startsWith('```') ? (
          <pre key={index}>
            <code>{part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')}</code>
          </pre>
        ) : (
          <Fragment key={index}>
            {part
              .split(/(\*\*[^*]+\*\*)/g)
              .map((chunk, i) =>
                chunk.startsWith('**') ? <strong key={i}>{chunk.slice(2, -2)}</strong> : chunk,
              )}
          </Fragment>
        ),
      )}
    </>
  );
}

export function WallFeed({
  session,
  members,
  locale,
  state,
  expanded = false,
  onCustomize,
}: {
  session?: SessionView;
  members?: SessionView[];
  locale: Locale;
  state: string;
  expanded?: boolean;
  onCustomize?: () => void;
}) {
  const tr = locale === 'tr';
  const viewport = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const autoScrollTop = useRef<number | null>(null);
  const [following, setFollowing] = useState(true);
  const allEvents = roomFeed(session, members);
  const lastMessage = allEvents.findLastIndex((e) => e.kind === 'assistant_message');
  const events = expanded
    ? allEvents
    : allEvents.filter((_, index) => index === lastMessage || index === allEvents.length - 1);
  const revision = allEvents.at(-1)?.key;
  const author = (source: SessionView) => source.agentKind === 'main'
    ? (tr ? 'Ana oturum' : 'Main session')
    : source.agentName || source.agentTask || (tr ? 'Ajan' : 'Agent');
  useLayoutEffect(() => {
    follow.current = true;
    setFollowing(true);
  }, [session?.id]);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el || !follow.current) return;
    const latest = events.at(-1);
    const showMessageStart =
      !expanded &&
      (latest?.kind === 'assistant_message' ||
        latest?.kind === 'turn_completed' ||
        latest?.kind === 'turn_aborted');
    const messages = el.querySelectorAll<HTMLElement>('[data-feed-kind="assistant_message"]');
    const message = showMessageStart ? messages.item(messages.length - 1) : null;
    // The room screen shows the start of a new response. Expanded history follows
    // the latest activity; manually scrolling either view keeps the user's place.
    el.scrollTop = message ? Math.max(0, message.offsetTop - 12) : el.scrollHeight;
    autoScrollTop.current = el.scrollTop;
  }, [revision, session?.id, expanded]);
  return (
    <div
      className={`fo-wall-feed${expanded ? ' fo-wall-expanded' : ''}`}
      data-testid={expanded ? 'expanded-feed' : 'wall-feed'}
    >
      <header className="fo-feed-heading">
        <div>
          <span className="fo-feed-eyebrow">AI OFFICE / {tr ? 'CANLI AKIŞ' : 'LIVE FEED'}</span>
          {onCustomize ? (
            <button
              className="fo-feed-project-button"
              onClick={onCustomize}
              // The decorative SVG shortcut duplicates the accessible Settings action.
              tabIndex={expanded ? 0 : -1}
              title={tr ? 'Odanın rengini değiştir' : 'Change room color'}
              aria-label={tr ? 'Odayı kişiselleştir' : 'Personalize room'}
            >
              <ProjectName project={session} fallback={tr ? 'Ofis' : 'Office'} />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" />
              </svg>
            </button>
          ) : (
            <ProjectName project={session} fallback={tr ? 'Ofis' : 'Office'} />
          )}
        </div>
        <span className="fo-feed-state">{state}</span>
      </header>
      <div
        className="fo-feed-scroll"
        ref={viewport}
        onScroll={() => {
          const el = viewport.current!;
          if (autoScrollTop.current !== null) {
            const automatic = Math.abs(el.scrollTop - autoScrollTop.current) < 1;
            autoScrollTop.current = null;
            if (automatic) return;
          }
          const nearEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          follow.current = nearEnd;
          setFollowing(nearEnd);
        }}
        tabIndex={expanded ? 0 : undefined}
        aria-label={tr ? 'Konuşma ve işlemler' : 'Conversation and actions'}
      >
        {!events.length && (
          <p className="fo-feed-empty">
            {tr
              ? 'Bu odadaki konuşma ve işlemler burada görünecek.'
              : 'Conversation and actions from this room appear here.'}
          </p>
        )}
        {events.map((e) => (
          <article key={e.key} className={`fo-feed-entry fo-feed-${e.kind}`} data-feed-kind={e.kind}>
            {e.kind === 'assistant_message' ? (
              <>
                <div className="fo-feed-meta">
                  <b>{author(e.session)}</b>
                  <time>{safeTime(e.occurredAt, locale)}</time>
                </div>
                <div className="fo-feed-message">
                  <Message
                    text={
                      !expanded && (e.text?.length ?? 0) > 600
                        ? `${e.text!.slice(0, 600)}…`
                        : (e.text ?? '')
                    }
                  />
                </div>
              </>
            ) : e.kind === 'turn_completed' || e.kind === 'turn_aborted' ? (
              <div className="fo-feed-end">
                <span>{e.kind === 'turn_completed' ? '✓' : '■'}</span>
                {author(e.session)} ·{' '}
                {e.kind === 'turn_completed'
                  ? tr
                    ? 'Yanıt tamamlandı'
                    : 'Response complete'
                  : tr
                    ? 'Çalışma durduruldu'
                    : 'Work interrupted'}
                <time>{safeTime(e.occurredAt, locale)}</time>
              </div>
            ) : (
              <>
                <div className="fo-feed-operation">
                  <span className="fo-feed-operation-icon">{e.questions?.length ? '?' : '›_'}</span>
                  <b>{author(e.session)} · {toolLabel(e.toolName, locale)}</b>
                  <span className="fo-feed-receipt">
                    {e.returned
                      ? tr
                        ? 'Yanıt alındı'
                        : 'Returned'
                      : tr
                        ? 'Çağrı'
                        : 'Call'}
                  </span>
                  <time>{safeTime(e.occurredAt, locale)}</time>
                </div>
                {expanded && !!e.actions?.length && (
                  <details className="fo-feed-action-details">
                    <summary>
                      {tr ? 'İşlem ayrıntıları' : 'Action details'} · {e.actions.length}
                    </summary>
                    <ul className="fo-feed-actions">
                      {e.actions.map((a, i) => (
                        <li key={i} data-action={a.kind}>
                          <span>{actionLabel(a, locale)}</span>
                          {a.detail && <code>{a.detail}</code>}
                          {a.nested && expanded && (
                            <small>{tr ? 'İşlem betiğinde' : 'In the script'}</small>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {e.questions?.map((q) => (
                  <div className="fo-feed-question" key={q.id}>
                    <b>
                      {e.pending.has(q.id)
                        ? tr
                          ? 'Yanıtını bekliyor'
                          : 'Awaiting your answer'
                        : tr
                          ? 'Sorulan soru'
                          : 'Question'}
                    </b>
                    <p>{q.title}</p>
                  </div>
                ))}
              </>
            )}
          </article>
        ))}
      </div>
      <div className="fo-feed-footer">
        <span>{tr ? 'Mesajlar · Komutlar · Dosyalar' : 'Messages · Commands · Files'}</span>
        {expanded && !following ? (
          <button
            onClick={() => {
              follow.current = true;
              setFollowing(true);
              if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
            }}
          >
            {tr ? 'Son etkinliğe dön ↓' : 'Latest activity ↓'}
          </button>
        ) : (
          <span>{tr ? 'Seçili oda' : 'Selected room'}</span>
        )}
      </div>
    </div>
  );
}

export function QuestionCard({
  session,
  locale,
  current,
}: {
  session?: SessionView;
  locale: Locale;
  current: boolean;
}) {
  const questions = session?.pendingQuestions ?? [];
  const tr = locale === 'tr';
  const room = session?.project || (tr ? 'Ofis' : 'Office');
  const title = session ? sessionTitle(session, tr ? 'Oturum' : 'Session') : '';
  return (
    <>
      <span className="fo-reorder-a11y" role="status" aria-atomic="true">
        {current && questions.length > 0
          ? `${room}. ${title}. ${tr ? 'Bir sorum var.' : 'A question for you.'} ${questions.map((q) => q.title).join(' ')} ${tr ? 'Yanıtını Codex’te ver.' : 'Answer in Codex.'}`
          : ''}
      </span>
      {questions.length > 0 && (
        <aside
          className="fo-question-card"
          aria-label={tr ? `${title}: soru` : `${title}: question`}
          data-testid="question-card"
        >
          <div className="fo-question-heading">
            <span>?</span>
            <div>
              <strong>{tr ? 'Bir sorum var' : 'A question for you'}</strong>
              <small>
                {current
                  ? tr
                    ? 'Yanıtını bekliyorum'
                    : 'Waiting for your answer'
                  : tr
                    ? 'Son görülen soru'
                    : 'Last observed question'}
              </small>
            </div>
          </div>
          <div className="fo-question-source" data-testid="question-source">
            <span>{tr ? 'Oda' : 'Room'}</span>
            <ProjectName project={session} fallback={room} />
            <span>{tr ? 'Oturum' : 'Session'}</span>
            <span className="fo-question-session">{title}</span>
          </div>
          <div
            className="fo-question-body"
            role="region"
            aria-label={tr ? 'Soru ve seçenekler' : 'Question and options'}
            tabIndex={0}
          >
            {questions.map((q) => (
              <section key={q.id}>
                <p>{q.title}</p>
                {!!q.options.length && (
                  <ol>
                    {q.options.map((option, index) => (
                      <li key={index}>{option}</li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
          <div className="fo-question-footer">
            <strong>
              {tr ? 'Yanıtını bu Codex oturumunda ver' : 'Answer in this Codex session'}
            </strong>
            <span>
              {tr
                ? 'Seçeneklerden yanıtlayabilir veya normal mesaj yazabilirsin.'
                : 'Choose an answer or write a regular message.'}
            </span>
            {current && session?.status === 'working' && (
              <span>
                {tr ? 'Arka planda çalışmaya devam ediyorum' : 'Still working in the background'}
              </span>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
