import { useId } from 'react';
import type { SessionView, Locale } from '../../shared/contract.ts';
import { eventLabels } from '../i18n.ts';
import type { OfficeCopy } from './copy.ts';
import { latestMessage, safeTime } from './fixed-state.ts';
import { screenMatrix, type Quad } from './scene-layout.ts';
import { MOTION_PLACEMENT, type MotionMode } from './ChelebyMotion.tsx';
import './laptop-screen.css';

// Inset from the physical bezel in each registered 384 × 416 pose cell.
const screenCorners: Record<MotionMode, Quad> = {
  idle: [[274, 148], [320, 158], [307, 198], [259, 188]],
  typing: [[273, 148], [320, 158], [307, 197], [260, 187]],
};

export function LaptopScreen({ mode, session, locale, copy, state }: {
  mode: MotionMode;
  session?: SessionView;
  locale: Locale;
  copy: OfficeCopy;
  state: string;
}) {
  const id = useId().replaceAll(':', '');
  const quad = screenCorners[mode].map(([x, y]) => [
    MOTION_PLACEMENT.x + x * MOTION_PLACEMENT.width / 384,
    MOTION_PLACEMENT.y + y * MOTION_PLACEMENT.height / 416,
  ]) as unknown as Quad;
  const events = session?.events.filter(e => e.toolName).slice(-3) ?? [];
  const message = latestMessage(session);
  return (
    <g data-layer="laptop-screen" data-session-id={session?.id ?? ''}>
      <defs>
        <clipPath id={`${id}-laptop`}>
          <polygon points={quad.map(p => p.join(',')).join(' ')} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-laptop)`}>
        <foreignObject width="1536" height="1024">
          <div style={{ position: 'relative', width: 1536, height: 1024 }}>
            <div className="fo-laptop-screen" style={{
              width: 240,
              height: 180,
              transformOrigin: '0 0',
              transform: `matrix3d(${screenMatrix(quad, 240, 180).join(',')})`,
            }}>
              <header><i />CHELEBY <span>{state}</span></header>
              <h4>{session?.project ?? copy.unlinked}</h4>
              <div className="fo-laptop-log">
                {events.length ? events.map(event => (
                  <p key={event.id} title={eventLabels[locale][event.kind]}>
                    <time>{safeTime(event.occurredAt, locale)}</time>
                    <span>{event.kind === 'tool_started' ? '> ' : '‹ '}{event.toolName}</span>
                  </p>
                )) : <p>{message ?? (session ? copy.noEvents : copy.unlinked)}</p>}
              </div>
              <footer>{message ?? copy.readOnly}</footer>
            </div>
          </div>
        </foreignObject>
      </g>
    </g>
  );
}
