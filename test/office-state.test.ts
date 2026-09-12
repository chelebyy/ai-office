import test from 'node:test';
import assert from 'node:assert/strict';
import type { SessionView } from '../src/shared/contract.ts';
import { canAnimate, officeState } from '../src/web/office/office-state.ts';
import { NOW } from './helpers.ts';

const now = Date.parse(NOW);
function session(id: string, extra: Partial<SessionView> = {}): SessionView {
  return {
    id,
    parentId: null,
    rootId: id,
    parentResolved: true,
    source: 'desktop',
    agentKind: 'main',
    project: id,
    version: '0.153.4',
    status: 'working',
    locale: 'tr',
    localeEvidence: 'user_message',
    startedAt: NOW,
    lastEventAt: NOW,
    lastObservedAt: NOW,
    currentTool: null,
    lastTurnId: null,
    recordAvailable: true,
    historyPartial: false,
    events: [],
    counts: { turns: 0, toolStarts: 0, toolCompletions: 0, messages: 0 },
    ...extra,
  };
}

test('a child opens its actual main room without importing another team or helpers', () => {
  const root = session('root');
  const child = session('child', { agentKind: 'subagent', parentId: 'root', rootId: 'root' });
  const rows = [
    root,
    child,
    session('other'),
    session('other-child', { agentKind: 'subagent', rootId: 'other', parentId: 'other' }),
    session('helper', { agentKind: 'internal', rootId: 'root', parentId: 'root' }),
  ];
  const state = officeState(rows, 'child', true, now);
  assert.equal(state.root?.id, 'root');
  assert.deepEqual(
    state.team.map((agent) => agent.id),
    ['child'],
  );
});

test('an unresolved parent does not turn an orphan subagent into a main mascot', () => {
  const child = session('orphan', {
    agentKind: 'subagent',
    parentId: 'missing',
    rootId: 'missing',
    parentResolved: false,
  });
  const state = officeState([child, session('unrelated')], 'orphan', true, now);
  assert.equal(state.root, undefined);
  assert.deepEqual(state.team, []);
  assert.equal(state.available, false);
});

test('typing requires a fresh available working record and an active source connection', () => {
  const root = session('root');
  assert.equal(canAnimate(root, true, now), true);
  for (const candidate of [
    session('old', { lastEventAt: new Date(now - 120001).toISOString() }),
    session('missing', { recordAvailable: false }),
    session('idle', { status: 'idle' }),
    session('waiting', { status: 'waiting' }),
  ])
    assert.equal(canAnimate(candidate, true, now), false);
  assert.equal(canAnimate(root, false, now), false);
  assert.equal(canAnimate(undefined, true, now), false);
  const stale = officeState([root], 'root', true, now + 120001);
  assert.equal(stale.stale, true);
  assert.equal(stale.working, false);
});

test('wall display and activity derive only from the selected room retained events', () => {
  const event = (id: string, text: string) => ({
    id,
    sessionId: 'a',
    kind: 'assistant_message' as const,
    occurredAt: NOW,
    observedAt: NOW,
    text,
  });
  const root = session('a', { events: [event('1', 'First'), event('2', 'Latest')] });
  const other = session('b', { events: [{ ...event('3', 'Other room'), sessionId: 'b' }] });
  const state = officeState([root, other], 'a', true, now);
  assert.equal(state.message, 'Latest');
  assert.deepEqual(
    state.events.map((item) => item.text),
    ['Latest', 'First'],
  );
  assert.equal(officeState([root, other], undefined, true, now).root, undefined);
});
