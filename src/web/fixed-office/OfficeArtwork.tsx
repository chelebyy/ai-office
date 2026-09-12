import { useEffect, useId, useState, type CSSProperties } from 'react';
import type { SessionView, Locale } from '../../shared/contract.ts';
import { eventLabels } from '../i18n.ts';
import {
  ART,
  SOURCE,
  CLEAN_PLATE,
  characters,
  monitors,
  screenMatrix,
  foreground,
  type CharacterId,
} from './scene-layout.ts';
import { freshness, latestMessage, lastTool, safeTime, type Connection } from './fixed-state.ts';
import type { OfficeCopy } from './copy.ts';

export type ArtworkProps = {
  actors: Record<CharacterId, SessionView | undefined>;
  activeId?: string;
  locale: Locale;
  copy: OfficeCopy;
  connection: Connection;
  paused: boolean;
  now: number;
  labels: boolean;
  screens: boolean;
  showCharacters: boolean;
  onSelect: (id: CharacterId) => void;
};

export function actorName(id: CharacterId, copy: OfficeCopy) {
  return id === 'main'
    ? 'Cheleby'
    : `${copy.subagent} #${['blue', 'green', 'purple'].indexOf(id) + 1}`;
}
export function stateLabel(
  session: SessionView | undefined,
  props: Pick<ArtworkProps, 'copy' | 'connection' | 'paused' | 'now'>,
) {
  const state = freshness(session, props.connection, props.paused, props.now);
  return state === 'current' && session
    ? props.copy[session.status === 'unknown' ? 'unknownState' : session.status]
    : props.copy[state];
}

function MonitorContent({
  session,
  wall,
  copy,
  locale,
  state,
}: {
  session?: SessionView;
  wall: boolean;
  copy: OfficeCopy;
  locale: Locale;
  state: string;
}) {
  const events = session?.events.slice(-5) ?? [];
  return (
    <div className={`fo-monitor ${wall ? 'fo-monitor-wall' : ''}`}>
      <header>
        <span className="fo-dot" />
        {wall ? copy.wallTitle : copy.monitorTitle}
        <small>{state}</small>
      </header>
      <div className="fo-monitor-columns">
        <section>
          <h4>{session?.project ?? copy.unlinked}</h4>
          <pre>
            {latestMessage(session)?.slice(-1700) ?? (session ? copy.noTask : copy.previewNote)}
          </pre>
        </section>
        {wall && (
          <section>
            <h4>{copy.activity}</h4>
            {events.length ? (
              events.map((e) => (
                <p key={e.id}>
                  <time>{safeTime(e.occurredAt, locale)}</time> {eventLabels[locale][e.kind]}
                  <br />
                  <span>{e.toolName}</span>
                </p>
              ))
            ) : (
              <p>{copy.noEvents}</p>
            )}
            <footer>{copy.readOnly}</footer>
          </section>
        )}
      </div>
    </div>
  );
}

export default function OfficeArtwork(props: ArtworkProps) {
  const id = useId().replaceAll(':', '');
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const assets = [SOURCE, CLEAN_PLATE].map((src) => {
      const img = new Image();
      img.onerror = () => setFailed(true);
      img.src = src;
      return img;
    });
    return () => {
      for (const img of assets) img.onerror = null;
    };
  }, [retry]);
  const { actors, copy, locale, labels, screens, showCharacters } = props;
  const position = (x: number, y: number, w: number, h?: number): CSSProperties => ({
    left: `${((x - ART.x) / ART.widthOfRoom) * 100}%`,
    top: `${(y / ART.heightOfRoom) * 100}%`,
    width: `${(w / ART.widthOfRoom) * 100}%`,
    ...(h ? { height: `${(h / ART.heightOfRoom) * 100}%` } : {}),
  });
  return (
    <div className="fo-artwork" data-testid="office-artwork">
      <svg
        viewBox={`${ART.x} 0 ${ART.widthOfRoom} ${ART.heightOfRoom}`}
        aria-hidden="true"
        className="fo-scene"
        key={retry}
      >
        <defs>
          <mask
            id={`${id}-decor`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1536"
            height="1024"
          >
            <rect width="1536" height="1024" fill="white" />
            {characters.map((c) => (
              <g key={c.id} fill="black">
                <path d={c.path} />
                <rect x={c.label[0] - 5} y={c.label[1] - 5} width="140" height="78" rx="5" />
              </g>
            ))}
          </mask>
          {characters.map((c) => (
            <clipPath key={c.id} id={`${id}-${c.id}`}>
              <path d={c.path} />
            </clipPath>
          ))}
          <clipPath id={`${id}-foreground`}>
            <path d={foreground} />
          </clipPath>
          {monitors.map((m) => (
            <clipPath key={m.id} id={`${id}-screen-${m.id}`}>
              <polygon points={m.quad.map((p) => p.join(',')).join(' ')} />
            </clipPath>
          ))}
        </defs>
        <image
          href={CLEAN_PLATE}
          width="1536"
          height="1024"
          onError={() => setFailed(true)}
          data-layer="clean-plate"
        />
        <image
          href={SOURCE}
          width="1536"
          height="1024"
          mask={`url(#${id}-decor)`}
          onError={() => setFailed(true)}
          data-layer="decor"
        />
        <g data-layer="screens">
          {monitors.map((m) => (
            <g key={m.id} clipPath={`url(#${id}-screen-${m.id})`}>
              <polygon points={m.quad.map((p) => p.join(',')).join(' ')} fill="#05101a" />
              {screens && (
                <foreignObject x="0" y="0" width="1536" height="1024">
                  <div style={{ position: 'relative', width: 1536, height: 1024 }}>
                    <div
                      style={{
                        width: m.wall ? 1000 : 420,
                        height: m.wall ? 390 : 260,
                        transformOrigin: '0 0',
                        transform: `matrix3d(${screenMatrix(m.quad, m.wall ? 1000 : 420, m.wall ? 390 : 260).join(',')})`,
                      }}
                    >
                      <MonitorContent
                        session={actors[m.actor]}
                        wall={!!m.wall}
                        copy={copy}
                        locale={locale}
                        state={stateLabel(actors[m.actor], props)}
                      />
                    </div>
                  </div>
                </foreignObject>
              )}
            </g>
          ))}
        </g>
        {showCharacters && (
          <g data-layer="characters">
            {characters.map((c) => (
              <image
                key={c.id}
                href={SOURCE}
                width="1536"
                height="1024"
                clipPath={`url(#${id}-${c.id})`}
              />
            ))}
          </g>
        )}
        <image
          href={SOURCE}
          width="1536"
          height="1024"
          clipPath={`url(#${id}-foreground)`}
          data-layer="foreground"
        />
      </svg>
      {characters.map((c) => {
        const session = actors[c.id];
        const state = freshness(session, props.connection, props.paused, props.now);
        const name = actorName(c.id, copy);
        return (
          <div
            key={c.id}
            className="fo-actor"
            style={{ '--actor-color': c.color } as CSSProperties}
          >
            {showCharacters && (
              <button
                className="fo-character-hit"
                style={position(c.bounds[0], c.bounds[1], c.bounds[2], c.bounds[3])}
                onClick={() => props.onSelect(c.id)}
                aria-label={`${name} — ${copy.detail}`}
                aria-pressed={!!session && session.id === props.activeId}
                data-character={c.id}
              />
            )}
            {labels && (
              <button
                className={`fo-badge fo-fresh-${state}`}
                style={position(c.label[0], c.label[1], 130)}
                onClick={() => props.onSelect(c.id)}
                aria-label={`${name} — ${stateLabel(session, props)}`}
                tabIndex={showCharacters ? -1 : 0}
              >
                <strong>
                  <span className="fo-dot" />
                  {name}
                </strong>
                <span>{stateLabel(session, props)}</span>
                <small title={lastTool(session)}>
                  {lastTool(session) ?? (session ? copy.noTool : copy.unlinked)}
                </small>
              </button>
            )}
          </div>
        );
      })}
      {failed && (
        <div className="fo-asset-error" role="alert">
          <p>{copy.assetError}</p>
          <button
            onClick={() => {
              setFailed(false);
              setRetry((r) => r + 1);
            }}
          >
            {copy.retry}
          </button>
        </div>
      )}
    </div>
  );
}
