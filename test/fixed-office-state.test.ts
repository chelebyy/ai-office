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
import {
  officeCards,
  projectGroups,
  liveProjectGroups,
  sessionTitle,
} from '../src/web/fixed-office/office-rooms.ts';
import {
  monitors,
  screenMatrix,
  screenEdge,
  screenOutline,
  screenSlices,
} from '../src/web/fixed-office/scene-layout.ts';
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
test('project navigation groups all main sessions by identity and includes only resolved team activity', () => {
  const mains = Array.from({ length: 7 }, (_, i) =>
    session('main-' + i, {
      project: 'Shared',
      projectKey: 'one',
      title: 'Task ' + i,
      status: 'idle',
    }),
  );
  const child = session('child', { agentKind: 'subagent', parentId: 'main-6', rootId: 'main-6' });
  const other = session('other', { project: 'Shared', projectKey: 'two', status: 'waiting' });
  const groups = projectGroups(snapshot([...mains, child, other]), 'connected', false, now);
  assert.equal(groups.length, 2);
  const project = groups.find((p) => p.key === 'cwd:one')!;
  assert.equal(project.rooms.length, 7);
  assert.equal(project.working, 1);
  assert.equal(project.rooms.find((r) => r.session.id === 'main-6')?.state, 'working');
  assert.ok(project.rooms.every((r) => r.session.id !== 'child'));
  assert.equal(groups.find((p) => p.key === 'cwd:two')?.waiting, 1);
  assert.ok(
    projectGroups(snapshot([...mains, child, other]), 'disconnected', false, now).every(
      (p) => p.working === 0 && p.waiting === 0,
    ),
  );
  assert.ok(
    projectGroups(snapshot([...mains, child, other]), 'connected', true, now).every(
      (p) => p.working === 0 && p.waiting === 0,
    ),
  );
});

test('live rooms keep working and waiting sessions plus the selected inactive room', () => {
  const rooms = [
    session('selected', { status: 'idle' }),
    session('done', { status: 'idle' }),
    session('busy'),
    session('waiting', { status: 'waiting' }),
    session('old', { lastEventAt: new Date(now - 121000).toISOString() }),
  ];
  const ids = (connection: 'connected' | 'disconnected' = 'connected', paused = false) =>
    liveProjectGroups(snapshot(rooms), 'selected', connection, paused, now)
      .flatMap((p) => p.rooms.map((r) => r.session.id))
      .sort();
  assert.deepEqual(ids(), ['busy', 'selected', 'waiting']);
  assert.deepEqual(ids('disconnected'), ['selected']);
  assert.deepEqual(ids('connected', true), ['selected']);
  rooms[2].status = 'idle';
  rooms[3].status = 'idle';
  assert.deepEqual(ids(), ['selected']);
  assert.equal(liveProjectGroups(snapshot(rooms), undefined, 'connected', false, now).length, 0);
});

test('navigation uses explicit titles with an ID fallback, and supports older snapshots', () => {
  const first = session('abcdefgh12345678', { project: 'Legacy', title: ' Named task ' });
  const second = session('ijklmnop87654321', { project: 'Legacy' });
  assert.equal(sessionTitle(first, 'Oturum'), 'Named task');
  assert.equal(sessionTitle(second, 'Oturum'), 'Oturum · 87654321');
  assert.equal(projectGroups(snapshot([first, second]), 'connected', false, now).length, 1);
});

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
test('perspective screen content lands on all four configured corners', () => {
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

test('curved screen keeps its corners and follows the measured upper and lower bow', () => {
  const quad = [
    [0, 5],
    [100, 0],
    [100, 80],
    [0, 85],
  ] as const;
  const curve = { top: -4, bottom: -3 };
  assert.deepEqual(screenEdge(quad, 0, false, curve), quad[0]);
  assert.deepEqual(screenEdge(quad, 1, false, curve), quad[1]);
  assert.deepEqual(screenEdge(quad, 0, true, curve), quad[3]);
  assert.deepEqual(screenEdge(quad, 1, true, curve), quad[2]);
  assert.deepEqual(screenEdge(quad, 0.5, false, curve), [50, -1.5]);
  assert.deepEqual(screenEdge(quad, 0.5, true, curve), [50, 79.5]);
  assert.deepEqual(screenOutline(quad), [...quad]);
  assert.equal(screenOutline(quad, curve).length, 26);
});

test('curved screen sections cover the full surface without gaps or invalid projections', () => {
  const screen = monitors.find((m) => m.id === 'main-center')!;
  const slices = screenSlices(screen.quad, screen.curve!);
  assert.equal(slices[0].from, 0);
  assert.equal(slices.at(-1)!.to, 1);
  slices.forEach((slice, i) => {
    assert.ok(slice.from < slice.to);
    if (i) {
      assert.ok(slices[i - 1].to >= slice.from);
      assert.ok(slices[i - 1].to - slice.from < 0.001);
    }
    const width = (slice.to - slice.from) * 420;
    const matrix = screenMatrix(slice.quad, width, 260);
    assert.ok(matrix.every(Number.isFinite));
    for (const [x, y, corner] of [
      [0, 0, 0],
      [width, 0, 1],
      [width, 260, 2],
      [0, 260, 3],
    ]) {
      const w = matrix[3] * x + matrix[7] * y + 1;
      assert.ok(
        Math.abs((matrix[0] * x + matrix[4] * y + matrix[12]) / w - slice.quad[corner][0]) < 0.001,
      );
      assert.ok(
        Math.abs((matrix[1] * x + matrix[5] * y + matrix[13]) / w - slice.quad[corner][1]) < 0.001,
      );
    }
  });
});

test('office cards keep the selected room visible and retain separate same-project sessions', () => {
  const mains = Array.from({ length: 6 }, (_, i) =>
    session('main-' + i, { project: 'Shared project' }),
  );
  const cards = officeCards(snapshot(mains.toReversed()), 'main-5', 'connected', false, now);
  assert.equal(cards.length, 5);
  assert.equal(cards[0].session.id, 'main-5');
  assert.equal(new Set(cards.map((c) => c.session.id)).size, 5);
  const selected = fixedOfficeState(snapshot(mains), 'main-5').root?.id;
  mains[0].lastEventAt = new Date(now + 1000).toISOString();
  assert.equal(fixedOfficeState(snapshot(mains.toReversed()), selected!).root?.id, selected);
});

test('office activity includes its resolved team but never helpers or another room', () => {
  const mains = [session('a', { status: 'idle' }), session('b', { status: 'idle' })];
  const child = session('child', { agentKind: 'subagent', parentId: 'a', rootId: 'a' });
  const helper = session('helper', { agentKind: 'internal', parentId: 'b', rootId: 'b' });
  const orphan = session('orphan', {
    agentKind: 'subagent',
    parentId: 'b',
    rootId: 'b',
    parentResolved: false,
  });
  let cards = officeCards(
    snapshot([...mains, child, helper, orphan]),
    'b',
    'connected',
    false,
    now,
  );
  assert.deepEqual(
    cards.map((c) => [c.session.id, c.state]),
    [
      ['b', 'idle'],
      ['a', 'working'],
    ],
  );
  child.status = 'waiting';
  cards = officeCards(snapshot([...mains, child]), 'b', 'connected', false, now);
  assert.equal(cards.find((c) => c.session.id === 'a')?.state, 'waiting');
});

test('office activity does not call stale, missing, disconnected or paused work active', () => {
  const main = session('a', { lastEventAt: new Date(now - 121000).toISOString() });
  const read = (connection: 'connected' | 'disconnected' = 'connected', paused = false) =>
    officeCards(snapshot([main]), 'a', connection, paused, now)[0].state;
  assert.equal(read(), 'stale');
  main.lastEventAt = new Date(now).toISOString();
  main.recordAvailable = false;
  assert.equal(read(), 'unavailable');
  main.recordAvailable = true;
  assert.equal(read('disconnected'), 'offline');
  assert.equal(read('connected', true), 'paused');
});
