import { useEffect, useId, useState, type CSSProperties } from 'react';
import type { Locale, SessionView } from '../../shared/contract.ts';
import { STALE_AFTER_MS } from '../office/office-state.ts';
import { type Connection } from './fixed-state.ts';
import { INITIAL_MOTION_POSE, liveRobotMotion, type MotionMode } from './live-motion.ts';
import { characters, SOURCE } from './scene-layout.ts';
import { partMask, robotRigs, type RobotId } from './robot-rigs.ts';
import './robot-motion.css';

const masks = Object.fromEntries(
  Object.keys(robotRigs).map((id) => [
    id,
    {
      head: partMask(id as RobotId, 'head'),
      hand: partMask(id as RobotId, 'hand'),
    },
  ]),
) as Record<RobotId, { head: string; hand: string }>;

export function RobotMotionSprite({
  id,
  session,
  rootId,
  connection,
  paused,
  hidden,
  reduced,
  now,
  previewMode,
}: {
  id: RobotId;
  session?: SessionView;
  rootId?: string;
  connection: Connection;
  paused: boolean;
  hidden: boolean;
  reduced: boolean;
  now: number;
  previewMode?: MotionMode;
}) {
  const maskId = useId().replaceAll(':', '');
  const [pose, setPose] = useState(INITIAL_MOTION_POSE);
  const [, refreshClock] = useState(0);
  const rig = robotRigs[id];
  const directHead = id === 'blue' || id === 'green';
  const [headReady, setHeadReady] = useState(false);
  const headAsset = rig.head.asset;
  useEffect(() => {
    if (!headAsset) return;
    let active = true;
    const image = new Image();
    image.src = headAsset.src;
    image
      .decode()
      .then(() => {
        if (active) setHeadReady(true);
      })
      .catch(() => {
        if (active) setHeadReady(false);
      });
    return () => {
      active = false;
    };
  }, [headAsset]);
  const character = characters.find((c) => c.id === id)!;
  const live = liveRobotMotion(
    pose,
    session,
    rootId,
    connection,
    paused,
    hidden,
    Math.max(now, Date.now()),
  );
  if (live.sessionId !== pose.sessionId || live.mode !== pose.mode) {
    setPose({ sessionId: live.sessionId, mode: live.mode });
  }
  useEffect(() => {
    if (previewMode || paused || hidden || connection !== 'connected') return;
    const remaining = Date.parse(session?.lastEventAt ?? '') + STALE_AFTER_MS - Date.now() + 1;
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = window.setTimeout(() => refreshClock((tick) => tick + 1), remaining);
    return () => window.clearTimeout(timer);
  }, [previewMode, paused, hidden, connection, session?.lastEventAt]);
  const mode = previewMode ?? live.mode;
  const frozen = paused || hidden || reduced || (!previewMode && live.frozen);
  return (
    <g
      data-robot={id}
      data-session-id={session?.id ?? ''}
      data-motion={mode}
      data-frozen={frozen}
      data-motion-source={previewMode ? 'preview' : 'live'}
    >
      <defs>
        {directHead && (
          <clipPath id={`${maskId}-head`} clipPathUnits="userSpaceOnUse">
            <path d={rig.head.path} />
          </clipPath>
        )}
        <mask
          id={`${maskId}-body`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1536"
          height="1024"
        >
          <path d={character.path} fill="white" />
          <path d={rig.head.clearPath ?? rig.head.path} fill="black" />
          {directHead && <path d={rig.head.path} fill="black" stroke="black" strokeWidth="2" />}
          {rig.neckPath && <path d={rig.neckPath} fill="white" />}
          <path d={rig.hand.path} fill="black" />
          {/* Broad chair patches must not restore status cards baked into SOURCE. */}
          {characters.map((actor) => (
            <rect
              key={actor.id}
              x={actor.label[0] - 5}
              y={actor.label[1] - 5}
              width="140"
              height="78"
              rx="5"
              fill="black"
            />
          ))}
        </mask>
      </defs>
      <image
        href={SOURCE}
        width="1536"
        height="1024"
        mask={`url(#${maskId}-body)`}
        data-robot-part="body"
      />
      {directHead && (
        <g
          data-robot-part="head"
          className={`fo-robot-direct-head fo-robot-${id}-head`}
          data-head-asset={headReady ? 'r11' : 'source'}
          style={
            {
              '--robot-play': frozen ? 'paused' : 'running',
              transformOrigin: `${rig.head.pivot[0]}px ${rig.head.pivot[1]}px`,
              transformBox: 'view-box',
            } as CSSProperties
          }
        >
          {headReady && headAsset ? (
            <image
              href={headAsset.src}
              x={headAsset.x}
              y={headAsset.y}
              width={headAsset.width}
              height={headAsset.height}
              preserveAspectRatio="xMidYMax meet"
              onError={() => setHeadReady(false)}
            />
          ) : (
            <image href={SOURCE} width="1536" height="1024" clipPath={`url(#${maskId}-head)`} />
          )}
        </g>
      )}
      <foreignObject {...rig.box} className="fo-robot-motion">
        <div
          className="fo-robot-rig"
          style={{ '--robot-play': frozen ? 'paused' : 'running' } as CSSProperties}
        >
          {(directHead ? (['hand'] as const) : (['head', 'hand'] as const)).map((part) => (
            <div
              key={part}
              data-robot-part={part}
              className={`fo-robot-part fo-robot-${id}-${part}`}
              style={{
                backgroundImage: `url(${SOURCE})`,
                backgroundPosition: `-${rig.box.x}px -${rig.box.y}px`,
                maskImage: masks[id][part],
                transformOrigin: `${rig[part].pivot[0] - rig.box.x}px ${rig[part].pivot[1] - rig.box.y}px`,
              }}
            />
          ))}
        </div>
      </foreignObject>
    </g>
  );
}

export function RobotMotionControls({
  locale,
  mode,
  onMode,
  onClose,
  frozen,
}: {
  locale: Locale;
  mode: MotionMode;
  onMode: (mode: MotionMode) => void;
  onClose: () => void;
  frozen: boolean;
}) {
  const tr = locale === 'tr';
  const title = tr ? 'Robotlar · Hareket önizlemesi' : 'Robots · Motion preview';
  return (
    <section className="fo-motion-controls fo-robot-controls" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <button
          onClick={onClose}
          aria-label={tr ? 'Canlı robot hareketlerine dön' : 'Return to live robot motion'}
        >
          ×
        </button>
      </header>
      <div role="group" aria-label={title}>
        <button aria-pressed={mode === 'idle'} onClick={() => onMode('idle')}>
          {tr ? 'Bekleme' : 'Idle'}
        </button>
        <button aria-pressed={mode === 'typing'} onClick={() => onMode('typing')}>
          {tr ? 'Yazma' : 'Typing'}
        </button>
      </div>
      <small role="status">
        {frozen
          ? tr
            ? 'Robot hareketleri duraklatıldı.'
            : 'Robot motion is paused.'
          : tr
            ? 'Üç robot için görsel deneme; canlı oturum durumu değişmez.'
            : 'Visual preview for three robots; live session state is unchanged.'}
      </small>
    </section>
  );
}
