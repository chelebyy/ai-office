import test from 'node:test';
import assert from 'node:assert/strict';
import type { SessionView } from '../src/shared/contract.ts';
import { INITIAL_MOTION_POSE, liveRobotMotion } from '../src/web/fixed-office/live-motion.ts';

const now = Date.parse('2026-09-13T10:00:00Z');
function robot(id: string, extra: Partial<SessionView> = {}): SessionView {
  return {
    id,
    parentId: 'root',
    rootId: 'root',
    parentResolved: true,
    agentKind: 'subagent',
    source: 'cli',
    project: id,
    version: 'test',
    status: 'working',
    locale: 'tr',
    localeEvidence: 'none',
    startedAt: new Date(now).toISOString(),
    lastEventAt: new Date(now).toISOString(),
    lastObservedAt: new Date(now).toISOString(),
    currentTool: null,
    lastTurnId: null,
    recordAvailable: true,
    historyPartial: false,
    events: [],
    counts: { turns: 0, toolStarts: 0, toolCompletions: 0, messages: 0 },
    ...extra,
  };
}
const motion = (session?: SessionView) =>
  liveRobotMotion(INITIAL_MOTION_POSE, session, 'root', 'connected', false, false, now);

test('each robot follows only its own working or waiting state', () => {
  const actors = [robot('a'), robot('b', { status: 'waiting' }), robot('c', { status: 'idle' })];
  assert.deepEqual(
    actors.map((s) => motion(s).mode),
    ['typing', 'idle', 'idle'],
  );
  actors[1].status = 'working';
  assert.deepEqual(
    actors.map((s) => motion(s).mode),
    ['typing', 'typing', 'idle'],
  );
});

test('unassigned, unresolved, foreign-room and helper records cannot animate robots', () => {
  for (const invalid of [
    undefined,
    robot('a', { agentKind: 'main' }),
    robot('a', { agentKind: 'internal' }),
    robot('a', { parentResolved: false }),
    robot('a', { rootId: 'other' }),
  ]) {
    assert.deepEqual(motion(invalid), { sessionId: null, mode: 'idle', frozen: true });
  }
  assert.equal(
    liveRobotMotion(INITIAL_MOTION_POSE, robot('a'), undefined, 'connected', false, false, now)
      .frozen,
    true,
  );
});

test('robot completion, interruption and the next turn select truthful poses', () => {
  let pose = motion(robot('a'));
  for (const status of ['idle', 'waiting', 'interrupted'] as const) {
    pose = liveRobotMotion(pose, robot('a', { status }), 'root', 'connected', false, false, now);
    assert.equal(pose.mode, 'idle');
    pose = liveRobotMotion(pose, robot('a'), 'root', 'connected', false, false, now);
    assert.equal(pose.mode, 'typing');
  }
});

test('uncertain robot data freezes the current pose without losing its identity', () => {
  const pose = motion(robot('a'));
  for (const invalid of [
    undefined,
    robot('a', { recordAvailable: false }),
    robot('a', { status: 'unknown' }),
    robot('a', { lastEventAt: 'invalid' }),
  ]) {
    assert.deepEqual(liveRobotMotion(pose, invalid, 'root', 'connected', false, false, now), {
      ...pose,
      frozen: true,
    });
  }
  for (const [connection, paused, hidden] of [
    ['connecting', false, false],
    ['disconnected', false, false],
    ['connected', true, false],
    ['connected', false, true],
  ] as const) {
    assert.deepEqual(liveRobotMotion(pose, robot('a'), 'root', connection, paused, hidden, now), {
      ...pose,
      frozen: true,
    });
  }
});

test('robot freshness uses the same 120-second event boundary as Cheleby', () => {
  const pose = motion(robot('a'));
  assert.equal(
    liveRobotMotion(pose, robot('a'), 'root', 'connected', false, false, now + 120000).frozen,
    false,
  );
  assert.equal(
    liveRobotMotion(pose, robot('a'), 'root', 'connected', false, false, now + 120001).frozen,
    true,
  );
});

test('a new assigned agent cannot inherit an old agent working pose', () => {
  const pose = motion(robot('a'));
  const next = liveRobotMotion(
    pose,
    robot('b', { status: 'unknown' }),
    'root',
    'connected',
    false,
    false,
    now,
  );
  assert.deepEqual(next, { sessionId: 'b', mode: 'idle', frozen: true });
});
