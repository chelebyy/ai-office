import test from 'node:test';
import assert from 'node:assert/strict';
import type { ObserverSnapshot, SessionView } from '../src/shared/contract.ts';
import { fixedOfficeState } from '../src/web/fixed-office/fixed-state.ts';
import {
  INITIAL_MOTION_POSE,
  liveMotion,
  type MotionPose,
} from '../src/web/fixed-office/live-motion.ts';

const now = Date.parse('2026-09-13T10:00:00Z');
function session(id = 'main', extra: Partial<SessionView> = {}): SessionView {
  return {
    id,
    rootId: id,
    parentId: null,
    parentResolved: true,
    agentKind: 'main',
    source: 'desktop',
    project: id,
    version: 'test',
    status: 'working',
    locale: 'tr',
    localeEvidence: 'user_message',
    recordAvailable: true,
    historyPartial: false,
    startedAt: new Date(now).toISOString(),
    lastEventAt: new Date(now).toISOString(),
    lastObservedAt: new Date(now).toISOString(),
    currentTool: null,
    lastTurnId: null,
    events: [],
    counts: { turns: 0, toolStarts: 0, toolCompletions: 0, messages: 0 },
    ...extra,
  };
}
const resolve = (s?: SessionView, previous: MotionPose = INITIAL_MOTION_POSE) =>
  liveMotion(previous, s, 'connected', false, false, now);

test('live Cheleby follows working, completed turn, next turn, waiting and interruption', () => {
  let pose = resolve(session());
  assert.deepEqual(pose, { sessionId: 'main', mode: 'typing', frozen: false });
  for (const status of ['idle', 'waiting', 'interrupted'] as const) {
    pose = resolve(session('main', { status }), pose);
    assert.equal(pose.mode, 'idle');
    assert.equal(pose.frozen, false);
    pose = resolve(session(), pose);
    assert.equal(pose.mode, 'typing');
    assert.equal(pose.frozen, false);
  }
});

test('uncertain data freezes the last pose and recovers without pose oscillation', () => {
  let pose = resolve(session());
  for (let i = 0; i < 5; i++) {
    for (const uncertain of [
      undefined,
      session('main', { recordAvailable: false }),
      session('main', { status: 'unknown' }),
      session('main', { lastEventAt: 'invalid' }),
    ]) {
      pose = resolve(uncertain, pose);
      assert.equal(pose.mode, 'typing');
      assert.equal(pose.frozen, true);
    }
    pose = resolve(session(), pose);
    assert.equal(pose.mode, 'typing');
    assert.equal(pose.frozen, false);
  }
  assert.deepEqual(resolve(undefined), { sessionId: null, mode: 'idle', frozen: true });
});

test('pause, hidden tab and connection loss stop motion even with recent working data', () => {
  const pose = resolve(session());
  for (const connection of ['disconnected', 'connecting'] as const) {
    assert.deepEqual(liveMotion(pose, session(), connection, false, false, now), {
      ...pose,
      frozen: true,
    });
  }
  assert.deepEqual(liveMotion(pose, session(), 'connected', true, false, now), {
    ...pose,
    frozen: true,
  });
  assert.deepEqual(liveMotion(pose, session(), 'connected', false, true, now), {
    ...pose,
    frozen: true,
  });
  const resumed = resolve(session('main', { status: 'waiting' }), pose);
  assert.equal(resumed.mode, 'idle');
  assert.equal(resumed.frozen, false);
});

test('event age expires independently of fresh observation timestamps', () => {
  const pose = resolve(session());
  const s = session('main', { lastObservedAt: new Date(now + 120001).toISOString() });
  assert.equal(liveMotion(pose, s, 'connected', false, false, now + 120000).frozen, false);
  assert.equal(liveMotion(pose, s, 'connected', false, false, now + 120001).frozen, true);
});

test('switching rooms never inherits the previous room working pose', () => {
  const pose = resolve(session());
  for (const extra of [
    { status: 'idle' as const },
    { recordAvailable: false },
    { status: 'unknown' as const },
  ]) {
    const other = resolve(session('other', extra), pose);
    assert.equal(other.sessionId, 'other');
    assert.equal(other.mode, 'idle');
  }
});

test('selected robot and unrelated rooms cannot drive the main character', () => {
  const main = session('main', { status: 'idle' });
  const robot = session('robot', { agentKind: 'subagent', parentId: 'main', rootId: 'main' });
  const snapshot = { sessions: [session('other'), main, robot] } as ObserverSnapshot;
  const office = fixedOfficeState(snapshot, 'robot');
  assert.equal(office.root?.id, 'main');
  assert.equal(resolve(office.actors.main).mode, 'idle');
  assert.equal(resolve(robot).frozen, true);
  assert.equal(resolve(session('helper', { agentKind: 'internal' })).frozen, true);
});

test('missing selected sessions do not silently fall back to another live room', () => {
  const snapshot = { sessions: [session('other')] } as ObserverSnapshot;
  assert.equal(fixedOfficeState(snapshot, 'missing').root, undefined);
  assert.equal(fixedOfficeState(snapshot, '').root?.id, 'other');
  const pose = resolve(session());
  assert.deepEqual(resolve(fixedOfficeState(snapshot, 'main').root, pose), {
    ...pose,
    frozen: true,
  });
});
