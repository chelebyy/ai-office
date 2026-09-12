import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { createFrameScheduler, type FrameHost, type FrameLimit } from './frame-scheduler.ts';

export interface SceneMetrics {
  fps: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  totalFrames: number;
}

const RenderRequest = createContext<() => void>(() => {});
export const useRenderRequest = () => useContext(RenderRequest);

const browserHost: FrameHost = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

export function SceneFrameLoop({
  limit,
  continuous,
  hidden,
  revision,
  metricsEnabled,
  onMetrics,
  onLost,
  children,
}: {
  limit: FrameLimit;
  continuous: boolean;
  hidden: boolean;
  revision: string;
  metricsEnabled: boolean;
  onMetrics: (metrics: SceneMetrics) => void;
  onLost: () => void;
  children: ReactNode;
}) {
  const { advance, gl, size } = useThree();
  const driver = useRef<ReturnType<typeof createFrameScheduler> | null>(null);
  const frames = useRef(0);
  const latest = useRef({ limit, continuous, hidden, onLost });
  latest.current = { limit, continuous, hidden, onLost };
  const request = useCallback(() => driver.current?.request(), []);

  useEffect(() => {
    const scheduler = createFrameScheduler(browserHost, (seconds) => {
      // R3F's manual clock uses seconds. A single advance updates controls,
      // character animation, HTML labels, and the WebGL draw together.
      advance(seconds, false);
      frames.current++;
    });
    driver.current = scheduler;
    scheduler.configure(latest.current);
    scheduler.request();
    const lost = (event: Event) => {
      event.preventDefault();
      scheduler.dispose();
      latest.current.onLost();
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      scheduler.dispose();
      driver.current = null;
      gl.domElement.removeEventListener('webglcontextlost', lost);
    };
  }, [advance, gl]);

  useEffect(() => {
    driver.current?.configure({ limit, continuous, hidden });
    request();
  }, [limit, continuous, hidden, request]);

  useEffect(() => {
    request();
  }, [revision, size.width, size.height, request]);

  useEffect(() => {
    if (!metricsEnabled || hidden) return;
    let since = performance.now();
    let count = frames.current;
    const timer = window.setInterval(() => {
      const now = performance.now();
      onMetrics({
        fps: Math.round(((frames.current - count) * 1000) / (now - since)),
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        totalFrames: frames.current,
      });
      since = now;
      count = frames.current;
    }, 1800);
    return () => clearInterval(timer);
  }, [gl, metricsEnabled, hidden, onMetrics]);

  return <RenderRequest.Provider value={request}>{children}</RenderRequest.Provider>;
}
