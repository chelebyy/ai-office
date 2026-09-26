import { useId } from 'react';
import { screenMatrix, type Quad } from './scene-layout.ts';
import { MOTION_PLACEMENT, type MotionMode } from './ChelebyMotion.tsx';
import { DecorativeScreen } from './DecorativeScreen.tsx';
import './laptop-screen.css';

// Inset from the physical bezel in each registered 384 × 416 pose cell.
const screenCorners: Record<MotionMode, Quad> = {
  idle: [
    [273, 144],
    [322, 155.5],
    [307.5, 202],
    [256, 189],
  ],
  typing: [
    [272, 144],
    [322, 155.5],
    [307.5, 201.5],
    [256.5, 188.5],
  ],
};

export function LaptopScreen({
  mode,
  sessionId,
  working,
  frozen,
}: {
  mode: MotionMode;
  sessionId?: string;
  working: boolean;
  frozen: boolean;
}) {
  const id = useId().replaceAll(':', '');
  const quad = screenCorners[mode].map(([x, y]) => [
    MOTION_PLACEMENT.x + (x * MOTION_PLACEMENT.width) / 384,
    MOTION_PLACEMENT.y + (y * MOTION_PLACEMENT.height) / 416,
  ]) as unknown as Quad;
  return (
    <g data-layer="laptop-screen" data-session-id={sessionId ?? ''}>
      <defs>
        <clipPath id={`${id}-laptop`}>
          <polygon points={quad.map((p) => p.join(',')).join(' ')} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-laptop)`}>
        <foreignObject width="1536" height="1024">
          <div style={{ position: 'relative', width: 1536, height: 1024 }}>
            <div
              className="fo-laptop-screen"
              style={{
                width: 240,
                height: 180,
                transformOrigin: '0 0',
                transform: `matrix3d(${screenMatrix(quad, 240, 180).join(',')})`,
              }}
            >
              <DecorativeScreen
                key={sessionId ?? 'unassigned'}
                id="main-laptop"
                working={working}
                frozen={frozen}
                compact
              />
            </div>
          </div>
        </foreignObject>
      </g>
    </g>
  );
}
