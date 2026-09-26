import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordReducer } from '../src/observer/parser.ts';
import { sessionName } from '../src/web/fixed-office/fixed-state.ts';
import { metadata, NOW } from './helpers.ts';

test('subagent identity comes from explicit metadata and the same name reaches the view', () => {
  const reducer = new RecordReducer();
  reducer.accept(metadata('child', {
    source: { subagent: { thread_spawn: { parent_thread_id: 'parent' } } },
    agent_nickname: 'Curie', agent_path: '/root/cheleby_idle_row',
  }), NOW);
  assert.equal(reducer.session?.agentName, 'Curie');
  assert.equal(reducer.session?.agentTask, 'cheleby_idle_row');
  assert.equal(sessionName(reducer.session!, 'Fallback'), 'Curie');
});

test('old nameless records use explicit task identity or a caller-supplied fallback', () => {
  const reducer = new RecordReducer();
  reducer.accept(metadata('child', {
    source: { subagent: { thread_spawn: { parent_thread_id: 'parent' } } },
    agent_path: '/root/review_ui',
  }), NOW);
  assert.equal(sessionName(reducer.session!, 'Fallback'), 'review_ui');
  assert.equal(sessionName({ ...reducer.session!, agentTask: null }, 'Fallback'), 'Fallback');
  assert.equal(sessionName(undefined, 'Empty desk'), 'Empty desk');
});

test('identity stays bounded and sanitized without turning unrelated metadata into an agent', () => {
  const reducer = new RecordReducer();
  reducer.accept(metadata('child', {
    source: { subagent: { thread_spawn: { parent_thread_id: 'parent' } } },
    agent_nickname: 'api_key=PRIVATE_VALUE', agent_path: '/root/' + 'x'.repeat(200),
  }), NOW);
  assert.equal(reducer.session?.agentName, 'api_key=[redacted]');
  assert.equal(reducer.session?.agentTask?.length, 100);
  const main = new RecordReducer();
  main.accept(metadata('main', { agent_nickname: 'Other', agent_path: '/root/not-a-child' }), NOW);
  assert.equal(main.session?.agentName, null);
  assert.equal(sessionName(main.session!, 'Fallback'), 'Cheleby');
});
