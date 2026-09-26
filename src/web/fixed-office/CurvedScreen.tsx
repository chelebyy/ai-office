import type { ReactNode } from 'react';
import { screenMatrix, screenSlices, type Quad, type ScreenCurve } from './scene-layout.ts';

// Project a single rendered content frame onto short sections of the curved panel.
// DecorativeScreen owns the only timer; all sections receive the same React output.
export function CurvedScreen({
  quad,
  curve,
  children,
}: {
  quad: Quad;
  curve: ScreenCurve;
  children: ReactNode;
}) {
  return (
    <g data-screen-surface="curved">
      {screenSlices(quad, curve).map(({ from, to, quad: section }, index) => {
        const width = (to - from) * 420;
        return (
          <foreignObject key={index} width="1536" height="1024">
            <div style={{ position: 'relative', width: 1536, height: 1024 }}>
              <div
                style={{
                  width,
                  height: 260,
                  overflow: 'hidden',
                  position: 'relative',
                  transformOrigin: '0 0',
                  transform: `matrix3d(${screenMatrix(section, width, 260).join(',')})`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -from * 420,
                    top: 0,
                    width: 420,
                    height: 260,
                  }}
                >
                  {children}
                </div>
              </div>
            </div>
          </foreignObject>
        );
      })}
    </g>
  );
}
