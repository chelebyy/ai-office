import { useEffect, useId, useState, type CSSProperties } from 'react';
import type { SessionView, Locale } from '../../shared/contract.ts';
import { WallFeed, QuestionCard } from './WallFeed.tsx';
import { roomQuestionSession } from './room-feed.ts';
import { OfficeWindow, useOfficeWindow } from './NightWindow.tsx';
import type { OfficeTheme } from './office-theme.ts';
import type { OfficeLocation } from './office-environment.ts';
import type { WeatherView } from './office-weather.ts';
import { WindowWeather, WeatherBadge } from './OfficeWeather.tsx';
import './office-theme.css';
import {
  ART,
  SOURCE,
  CLEAN_PLATE,
  characters,
  monitors,
  screenMatrix,
  screenOutline,
  foreground,
  type CharacterId,
} from './scene-layout.ts';
import { freshness, sessionName, type Connection } from './fixed-state.ts';
import type { OfficeCopy } from './copy.ts';
import { LaptopScreen } from './LaptopScreen.tsx';
import { DecorativeScreen, screenIsWorking, useScreenEnvironment } from './DecorativeScreen.tsx';
import { RobotMotionSprite, RobotMotionControls } from './RobotMotion.tsx';
import type { MotionMode } from './live-motion.ts';
import { robotRigs } from './robot-rigs.ts';
import {
  useChelebyMotion,
  ChelebyMotionSprite,
  ChelebyMotionControls,
  ChelebyMotionFallback,
  MOTION_CUTOUT,
  MOTION_BACKGROUND,
} from './ChelebyMotion.tsx';

// Static patches remove the animals and dog bed baked into the source artwork.
const EMPTY_RESTING_AREAS = '/office/empty-resting-areas-v2.png';

export type ArtworkProps = {
  weather: WeatherView;
  location: OfficeLocation | null;
  onOpenWeather: () => void;
  theme: OfficeTheme;
  actors: Record<CharacterId, SessionView | undefined>;
  members: SessionView[];
  activeId?: string;
  locale: Locale;
  copy: OfficeCopy;
  connection: Connection;
  paused: boolean;
  now: number;
  labels: boolean;
  screens: boolean;
  showCharacters: boolean;
  motionPreview: boolean;
  robotMotionPreview: boolean;
  onCloseRobotMotion: () => void;
  onCloseMotion: () => void;
  onSelect: (id: CharacterId) => void;
  onCustomize: () => void;
};

export function actorName(id: CharacterId, copy: OfficeCopy, session?: SessionView) {
  if (id === 'main') return 'Cheleby';
  return sessionName(
    session,
    session ? `${copy.subagent} · ${session.id.slice(-6)}` : copy.preview,
  );
}
export function stateLabel(
  session: SessionView | undefined,
  props: Pick<ArtworkProps, 'copy' | 'connection' | 'paused' | 'now'>,
) {
  const state = freshness(session, props.connection, props.paused, props.now);
  return state === 'current' && session
    ? session.pendingQuestions?.length
      ? props.copy.waiting
      : props.copy[session.status === 'unknown' ? 'unknownState' : session.status]
    : props.copy[state];
}

export default function OfficeArtwork(props: ArtworkProps) {
  const id = useId().replaceAll(':', '');
  const windowView = useOfficeWindow(props.theme);
  const theme = windowView.status === 'ready' ? props.theme : 'sunset';
  const [failed, setFailed] = useState(false);
  const [artworkReady, setArtworkReady] = useState(false);
  const [robotPreviewMode, setRobotPreviewMode] = useState<MotionMode>('idle');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setArtworkReady(false);
    const assets = [SOURCE, CLEAN_PLATE, EMPTY_RESTING_AREAS].map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
    // Reveal the artwork atomically so the original baked-in pets never flash
    // while the empty sofa/floor patches load. No pet rig or pose atlas is loaded.
    void Promise.all(assets.map((img) => img.decode()))
      .then(() => {
        if (alive) setArtworkReady(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  const { actors, copy, locale, labels, screens, showCharacters } = props;
  const questionSession = roomQuestionSession(actors.main, props.members, props.activeId);
  const screenEnvironment = useScreenEnvironment(Object.values(actors), props.now);
  const screensFrozen =
    props.paused ||
    screenEnvironment.hidden ||
    screenEnvironment.reduced ||
    props.connection !== 'connected';
  const screenWorking = (actor: CharacterId) =>
    screenIsWorking(
      actors[actor],
      actors.main?.id,
      props.connection,
      props.paused,
      screenEnvironment.hidden,
      screenEnvironment.now,
    );
  const motion = useChelebyMotion({
    enabled: showCharacters,
    preview: props.motionPreview,
    session: actors.main,
    connection: props.connection,
    viewPaused: props.paused,
    now: props.now,
  });
  const position = (x: number, y: number, w: number, h?: number): CSSProperties => ({
    left: `${((x - ART.x) / ART.widthOfRoom) * 100}%`,
    top: `${(y / ART.heightOfRoom) * 100}%`,
    width: `${(w / ART.widthOfRoom) * 100}%`,
    ...(h ? { height: `${(h / ART.heightOfRoom) * 100}%` } : {}),
  });
  return (
    <div
      className="fo-artwork"
      data-testid="office-artwork"
      data-theme={theme}
      data-requested-theme={props.theme}
    >
      <svg
        viewBox={`${ART.x} 0 ${ART.widthOfRoom} ${ART.heightOfRoom}`}
        aria-hidden="true"
        className="fo-scene"
        style={{ visibility: artworkReady ? 'visible' : 'hidden' }}
        key={retry}
      >
        <defs>
          <clipPath id={`${id}-resting-areas`}>
            <rect x="169" y="410" width="88" height="59" rx="10" />
            <rect x="1062" y="582" width="211" height="166" rx="14" />
          </clipPath>
          <clipPath id={`${id}-blue-neck-backdrop`}>
            <path d="M 543 332 H 611 V 355 H 543 Z" />
          </clipPath>
          <filter id={`${id}-motion-edge`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <filter id={`${id}-monitor-patch-edge`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
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
                {(c.id === 'blue' || c.id === 'green') && (
                  <path d={robotRigs[c.id].head.path} stroke="black" strokeWidth="2" />
                )}
                {c.id === 'main' && motion.ready && (
                  <path d={MOTION_CUTOUT} filter={`url(#${id}-motion-edge)`} />
                )}
                {c.id !== 'purple' && (
                  <rect x={c.label[0] - 5} y={c.label[1] - 5} width="140" height="78" rx="5" />
                )}
              </g>
            ))}
            {/* Use one coherent set of bezels from the clean plate. The old label
                crossed these monitors; mixing source and clean frames split them. */}
            <g fill="black" filter={`url(#${id}-monitor-patch-edge)`}>
              <rect x="1117" y="336" width="140" height="78" rx="5" />
              <path d="M 1001 358 L 1068 355 L 1070 353 L 1171 373 L 1228 395 L 1221 458 L 1156 437 L 1067 418 L 997 421 Z" />
              {monitors
                .filter((m) => !m.id.startsWith('purple-'))
                .map((m) => (
                  <polygon
                    key={m.id}
                    points={screenOutline(m.quad, m.curve)
                      .map((p) => p.join(','))
                      .join(' ')}
                    stroke="black"
                    strokeWidth="10"
                    strokeLinejoin="round"
                  />
                ))}
            </g>
          </mask>
          <mask
            id={`${id}-motion-clear`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1536"
            height="1024"
          >
            <path d={characters[0].path} fill="white" />
            <path d={MOTION_CUTOUT} fill="white" filter={`url(#${id}-motion-edge)`} />
          </mask>
          <mask
            id={`${id}-motion-foreground`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1536"
            height="1024"
          >
            <rect width="1536" height="1024" fill="white" />
            <path d={characters[0].path} fill="black" />
            <path d={MOTION_CUTOUT} fill="black" filter={`url(#${id}-motion-edge)`} />
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
              <polygon
                points={screenOutline(m.quad, m.curve)
                  .map((p) => p.join(','))
                  .join(' ')}
              />
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
        {showCharacters && (
          <image
            href={CLEAN_PLATE}
            y="8"
            width="1536"
            height="1024"
            clipPath={`url(#${id}-blue-neck-backdrop)`}
            data-layer="blue-neck-backdrop"
          />
        )}
        {motion.ready && (
          <image
            href={MOTION_BACKGROUND}
            x="560"
            y="460"
            width="310"
            height="310"
            mask={`url(#${id}-motion-clear)`}
            data-layer="motion-background"
          />
        )}
        <image
          href={SOURCE}
          width="1536"
          height="1024"
          mask={`url(#${id}-decor)`}
          onError={() => setFailed(true)}
          data-layer="decor"
        />
        <OfficeWindow
          id={id}
          theme={theme}
          loaded={windowView.loaded}
          onError={windowView.failed}
        />
        <g data-layer="screens">
          {monitors.map((m) => (
            <g key={m.id} data-monitor={m.id} clipPath={`url(#${id}-screen-${m.id})`}>
              <polygon
                points={screenOutline(m.quad, m.curve)
                  .map((p) => p.join(','))
                  .join(' ')}
                fill="#05101a"
              />
              {screens && m.curve ? (
                <DecorativeScreen
                  key={actors[m.actor]?.id ?? 'unassigned'}
                  id={m.id}
                  working={screenWorking(m.actor)}
                  frozen={screensFrozen}
                  surface={{ quad: m.quad, curve: m.curve }}
                />
              ) : (
                screens && (
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
                        {m.wall ? (
                          <WallFeed
                            session={actors.main}
                            members={props.members}
                            locale={locale}
                            state={stateLabel(actors.main, props)}
                            onCustomize={actors.main ? props.onCustomize : undefined}
                          />
                        ) : (
                          <DecorativeScreen
                            key={actors[m.actor]?.id ?? 'unassigned'}
                            id={m.id}
                            working={screenWorking(m.actor)}
                            frozen={screensFrozen}
                          />
                        )}
                      </div>
                    </div>
                  </foreignObject>
                )
              )}
            </g>
          ))}
        </g>
        {showCharacters && (
          <g data-layer="characters">
            <g data-layer="character-art">
              {characters
                .filter((c) => c.id !== 'main' || !motion.ready)
                .map((c) =>
                  c.id === 'main' ? (
                    <image
                      key={c.id}
                      href={SOURCE}
                      width="1536"
                      height="1024"
                      clipPath={`url(#${id}-${c.id})`}
                    />
                  ) : (
                    <RobotMotionSprite
                      key={c.id}
                      id={c.id}
                      session={actors[c.id]}
                      rootId={actors.main?.id}
                      connection={props.connection}
                      paused={props.paused}
                      hidden={motion.hidden}
                      reduced={motion.reduced}
                      now={props.now}
                      previewMode={props.robotMotionPreview ? robotPreviewMode : undefined}
                    />
                  ),
                )}
              {motion.ready && <ChelebyMotionSprite motion={motion} />}
            </g>
            {motion.ready && screens && (
              <LaptopScreen
                mode={motion.mode}
                sessionId={actors.main?.id}
                working={screenWorking('main')}
                frozen={screensFrozen}
              />
            )}
          </g>
        )}
        <image
          href={SOURCE}
          width="1536"
          height="1024"
          clipPath={`url(#${id}-foreground)`}
          mask={motion.ready ? `url(#${id}-motion-foreground)` : undefined}
          data-layer="foreground"
        />
        <image
          href={EMPTY_RESTING_AREAS}
          width="1536"
          height="1024"
          clipPath={`url(#${id}-resting-areas)`}
          data-layer="resting-areas"
        />
      </svg>
      <WindowWeather
        id={id}
        kind={props.weather.snowing ? 'snow' : props.weather.raining ? 'rain' : null}
        frozen={props.paused || screenEnvironment.hidden || screenEnvironment.reduced}
      />
      <WeatherBadge
        weather={props.weather}
        locale={locale}
        location={props.location}
        onOpen={props.onOpenWeather}
      />
      {props.theme !== 'sunset' && windowView.status !== 'ready' && (
        <div className="fo-theme-status" role="status">
          {windowView.status === 'error' ? copy.sceneError : copy.sceneLoading}
          {windowView.status === 'error' && (
            <button onClick={windowView.retry}>{copy.retry}</button>
          )}
        </div>
      )}
      <QuestionCard
        session={questionSession}
        locale={locale}
        current={freshness(questionSession, props.connection, props.paused, props.now) === 'current'}
      />
      {characters.map((c) => {
        const session = actors[c.id];
        const name = actorName(c.id, copy, session);
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
                title={
                  labels
                    ? session
                      ? `${name} · ${stateLabel(session, props)}`
                      : copy.previewNote
                    : undefined
                }
                aria-pressed={!!session && session.id === props.activeId}
                data-character={c.id}
              />
            )}
          </div>
        );
      })}
      {props.motionPreview && showCharacters && (
        <ChelebyMotionControls motion={motion} locale={locale} onClose={props.onCloseMotion} />
      )}
      {!props.motionPreview && showCharacters && (
        <ChelebyMotionFallback motion={motion} locale={locale} />
      )}
      {props.robotMotionPreview && showCharacters && (
        <RobotMotionControls
          locale={locale}
          mode={robotPreviewMode}
          onMode={setRobotPreviewMode}
          onClose={props.onCloseRobotMotion}
          frozen={props.paused || motion.hidden || motion.reduced}
        />
      )}
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
