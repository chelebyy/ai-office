export type FrameLimit = 30 | 60;
export type PowerMode = 'balanced' | 'eco';

export interface FrameHost {
  now: () => number;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
}

interface FramePolicy {
  limit: FrameLimit;
  continuous: boolean;
  hidden: boolean;
}

export function framePolicy(
  power: PowerMode,
  motion: boolean,
  active: boolean,
  hidden: boolean,
): FramePolicy {
  return { limit: power === 'eco' ? 30 : 60, continuous: motion && active, hidden };
}

/** Owns both animation and drawing; idle/hidden scenes keep no scheduled work. */
export function createFrameScheduler(host: FrameHost, render: (elapsedSeconds: number) => void) {
  let policy: FramePolicy = { limit: 60, continuous: false, hidden: true };
  let frame: number | undefined;
  let dirty = false;
  let disposed = false;
  let lastFrame: number | undefined;
  let nextFrameAt: number | undefined;
  let elapsedSeconds = 0;

  const cancel = () => {
    if (frame !== undefined) host.cancelFrame(frame);
    frame = undefined;
  };

  const schedule = () => {
    if (disposed || policy.hidden || (!dirty && !policy.continuous) || frame !== undefined) return;
    frame = host.requestFrame(tick);
  };

  const tick = () => {
    frame = undefined;
    if (disposed || policy.hidden || (!dirty && !policy.continuous)) return;
    const now = host.now();
    // Preserve phase on displays such as 144 Hz, where 60 FPS spans uneven refresh intervals.
    // Skipped callbacks only check the clock; animation and drawing run below the gate.
    if (nextFrameAt !== undefined && now + 0.25 < nextFrameAt) {
      schedule();
      return;
    }
    elapsedSeconds += lastFrame === undefined ? 0 : Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    const interval = 1000 / policy.limit;
    nextFrameAt =
      nextFrameAt === undefined || now - nextFrameAt > interval
        ? now + interval
        : nextFrameAt + interval;
    dirty = false;
    render(elapsedSeconds);
    schedule();
  };

  return {
    configure(next: FramePolicy) {
      if (disposed) return;
      const resuming = policy.hidden && !next.hidden;
      const changedLimit = policy.limit !== next.limit;
      cancel();
      policy = next;
      if (resuming) lastFrame = nextFrameAt = undefined;
      else if (changedLimit && lastFrame !== undefined) nextFrameAt = lastFrame + 1000 / next.limit;
      schedule();
    },
    request() {
      if (disposed) return;
      dirty = true;
      schedule();
    },
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
