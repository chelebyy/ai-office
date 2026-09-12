import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFrameScheduler,
  framePolicy,
  type FrameHost,
} from '../src/web/office/frame-scheduler.ts';

function display(hz = 180) {
  let now = 0;
  let nextId = 0;
  const work = new Map<number, { at: number; callback: () => void }>();
  const enqueue = (callback: () => void, at: number) => {
    const id = ++nextId;
    work.set(id, { at, callback });
    return id;
  };
  const host: FrameHost = {
    now: () => now,
    requestFrame: (callback) =>
      enqueue(callback, (Math.floor((now + 0.00001) / (1000 / hz)) + 1) * (1000 / hz)),
    cancelFrame: (id) => {
      work.delete(id);
    },
  };
  return {
    host,
    pending: () => work.size,
    run(ms: number) {
      const end = now + ms;
      let turns = 0;
      while (work.size) {
        const [id, next] = [...work].sort((a, b) => a[1].at - b[1].at)[0];
        if (next.at > end) break;
        if (++turns > 10000) throw new Error('Scheduler failed to settle');
        now = next.at;
        work.delete(id);
        next.callback();
      }
      now = end;
    },
  };
}

test('high-refresh displays cannot advance animation or WebGL above the selected frame budget', () => {
  for (const hz of [60, 144, 180, 240]) {
    for (const limit of [30, 60] as const) {
      const screen = display(hz);
      const frames: number[] = [];
      const scheduler = createFrameScheduler(screen.host, (time) => frames.push(time));
      scheduler.configure({ limit, continuous: true, hidden: false });
      screen.run(1000);
      assert.ok(frames.length <= limit + 1, `${hz} Hz / ${limit}: ${frames.length} frames`);
      assert.ok(frames.length >= limit - 2, `${hz} Hz / ${limit}: ${frames.length} frames`);
      assert.ok(frames.at(-1)! < 1.1, 'Manual animation time is seconds, not milliseconds');
      scheduler.dispose();
    }
  }
});

test('idle scenes coalesce change requests and stop scheduling until another change', () => {
  const screen = display();
  let count = 0;
  const scheduler = createFrameScheduler(screen.host, () => count++);
  scheduler.configure(framePolicy('balanced', true, false, false));
  for (let i = 0; i < 100; i++) scheduler.request();
  screen.run(1000);
  assert.equal(count, 1);
  assert.equal(screen.pending(), 0);
  scheduler.request();
  screen.run(1000);
  assert.equal(count, 2);
  assert.equal(screen.pending(), 0);
});

test('camera transitions may request subsequent capped frames and settle back to no scheduled work', () => {
  const screen = display();
  let count = 0;
  const scheduler = createFrameScheduler(screen.host, () => {
    if (++count < 10) scheduler.request();
  });
  scheduler.configure(framePolicy('eco', false, false, false));
  scheduler.request();
  screen.run(1000);
  assert.equal(count, 10);
  assert.equal(screen.pending(), 0);
});

test('hiding cancels frames; hidden updates render once on return without a clock jump', () => {
  const screen = display();
  const frames: number[] = [];
  const scheduler = createFrameScheduler(screen.host, (time) => frames.push(time));
  scheduler.configure(framePolicy('balanced', true, true, false));
  screen.run(100);
  scheduler.configure(framePolicy('balanced', true, true, true));
  assert.equal(screen.pending(), 0);
  const before = frames.length;
  scheduler.request();
  screen.run(60000);
  assert.equal(frames.length, before);
  assert.equal(screen.pending(), 0);
  scheduler.configure(framePolicy('balanced', false, false, false));
  screen.run(1000);
  assert.equal(frames.length, before + 1);
  assert.ok(frames.at(-1)! - frames.at(-2)! <= 0.1);
  assert.equal(screen.pending(), 0);
});

test('changing to eco replaces queued work and disposal prevents all later wakeups', () => {
  const screen = display();
  let count = 0;
  const scheduler = createFrameScheduler(screen.host, () => count++);
  scheduler.configure(framePolicy('balanced', true, true, false));
  screen.run(500);
  const before = count;
  scheduler.configure(framePolicy('eco', true, true, false));
  screen.run(1000);
  assert.ok(count - before <= 31);
  assert.ok(count - before >= 28);
  scheduler.dispose();
  const disposedAt = count;
  scheduler.request();
  scheduler.configure(framePolicy('balanced', true, true, false));
  screen.run(1000);
  assert.equal(count, disposedAt);
  assert.equal(screen.pending(), 0);
});
