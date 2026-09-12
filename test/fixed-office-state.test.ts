import test from 'node:test';
import assert from 'node:assert/strict';
import type { ObserverSnapshot, SessionView } from '../src/shared/contract.ts';
import {
  fixedOfficeState,
  freshness,
  latestMessage,
  toolEvents,
  safeTime,
} from '../src/web/fixed-office/fixed-state.ts';
import { monitors, screenMatrix } from '../src/web/fixed-office/scene-layout.ts';
const now = Date.parse('2026-09-12T15:00:00Z');
function session(id: string, extra: Partial<SessionView> = {}): SessionView {
  return {
    id,
    parentId: null,
    rootId: id,
    parentResolved: true,
    source: 'desktop',
    agentKind: 'main',
    project: id,
    version: 'test',
    status: 'working',
    locale: 'tr',
    localeEvidence: 'user_message',
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
const snapshot = (sessions: SessionView[]) => ({ sessions }) as ObserverSnapshot;
test('room selection uses explicit parent metadata and retains overflow agents', () => {
  const root = session('room');
  const team = ['a', 'b', 'c', 'd'].map((id) =>
    session(id, { agentKind: 'subagent', parentId: 'room', rootId: 'room' }),
  );
  const state = fixedOfficeState(
    snapshot([
      root,
      session('other'),
      ...team.toReversed(),
      session('helper', { agentKind: 'internal', rootId: 'room' }),
      session('orphan', { agentKind: 'subagent', rootId: 'room', parentResolved: false }),
      session('foreign-child', { agentKind: 'subagent', rootId: 'other' }),
    ]),
    'c',
  );
  assert.equal(state.root?.id, 'room');
  assert.deepEqual(
    state.team.map((s) => s.id),
    ['a', 'b', 'c', 'd'],
  );
  assert.deepEqual(
    Object.values(state.actors).map((s) => s?.id),
    ['room', 'a', 'b', 'c'],
  );
  assert.equal(state.members.length, 5);
});
test('orphan and internal selections never silently open an unrelated main room', () => {
  for (const agentKind of ['subagent', 'internal'] as const) {
    const state = fixedOfficeState(
      snapshot([
        session('other'),
        session('orphan', { agentKind, parentResolved: false, rootId: 'missing' }),
      ]),
      'orphan',
    );
    assert.equal(state.root, undefined);
    assert.deepEqual(state.members, []);
  }
  assert.equal(fixedOfficeState(null, null).root, undefined);
});
test('paused, unavailable, disconnected and stale records cannot claim current activity', () => {
  const s = session('r');
  assert.equal(freshness(s, 'connected', false, now), 'current');
  assert.equal(freshness(s, 'connected', false, now + 120001), 'stale');
  assert.equal(freshness(s, 'disconnected', false, now), 'offline');
  assert.equal(freshness({ ...s, recordAvailable: false }, 'connected', false, now), 'unavailable');
  assert.equal(freshness(s, 'connected', true, now), 'paused');
  assert.equal(freshness(undefined, 'connected', false, now), 'preview');
  assert.equal(freshness({ ...s, lastEventAt: 'invalid' }, 'connected', false, now), 'stale');
});
test('public messages and observed tool events remain separate', () => {
  const base = {
    sessionId: 'r',
    occurredAt: new Date(now).toISOString(),
    observedAt: new Date(now).toISOString(),
  };
  const s = session('r', {
    events: [
      { ...base, id: '1', kind: 'assistant_message', text: 'Public progress' },
      { ...base, id: '2', kind: 'tool_started', toolName: 'functions.exec' },
      { ...base, id: '3', kind: 'tool_completed', outcome: 'unknown' },
    ],
  });
  assert.equal(latestMessage(s), 'Public progress');
  assert.deepEqual(
    toolEvents(s.events).map((e) => e.id),
    ['2', '3'],
  );
  assert.equal(safeTime('invalid', 'tr'), '—');
});
test('perspective screen content lands on all four physical monitor corners', () => {
  for (const { quad } of monitors) {
    const m = screenMatrix(quad, 1000, 390);
    [
      [0, 0],
      [1000, 0],
      [1000, 390],
      [0, 390],
    ].forEach(([x, y], i) => {
      const z = m[3] * x + m[7] * y + m[15];
      assert.ok(Math.abs((m[0] * x + m[4] * y + m[12]) / z - quad[i][0]) < 0.001);
      assert.ok(Math.abs((m[1] * x + m[5] * y + m[13]) / z - quad[i][1]) < 0.001);
    });
  }
});
