import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordReducer, detectLocale, publicText } from '../src/observer/parser.ts';
import { event, metadata, NOW, row } from './helpers.ts';

test('desktop and CLI provenance come from metadata; unknown remains unknown', () => {
  for (const [source, originator, expected] of [['vscode','Codex Desktop','desktop'],['cli','codex_cli_rs','cli'],['exec','codex_exec','cli'],['other','other','unknown']]) {
    const reducer = new RecordReducer(); reducer.accept(metadata('main-1', { source, originator }), NOW);
    assert.equal(reducer.session?.source, expected);
  }
});
test('only explicit subagent source forms a team; a fork remains an independent main session', () => {
  const child = new RecordReducer();
  child.accept(metadata('child', { source: { subagent: { thread_spawn: { parent_thread_id: 'parent' } } } }), NOW);
  assert.equal(child.session?.agentKind, 'subagent'); assert.equal(child.session?.parentId, 'parent');
  const fork = new RecordReducer(); fork.accept(metadata('fork', { parent_thread_id: 'parent' }), NOW);
  assert.equal(fork.session?.agentKind, 'main'); assert.equal(fork.session?.parentId, null);
});
test('internal helper messages never enter the public model', () => {
  const reducer = new RecordReducer();
  reducer.accept(metadata('guardian', { source: { subagent: { other: 'guardian' } }, parent_thread_id: 'parent' }), NOW);
  reducer.accept(event('agent_message', { phase: 'final', message: 'PRIVATE_INTERNAL_CONTENT' }), NOW);
  assert.equal(reducer.session?.agentKind, 'internal');
  assert.ok(!JSON.stringify(reducer.session).includes('PRIVATE_INTERNAL_CONTENT'));
});
test('repeated tool records are idempotent and result success is not invented', () => {
  const reducer = new RecordReducer(); reducer.accept(metadata(), NOW);
  const call = row('response_item', { type: 'function_call', name: 'exec_command', call_id: 'call-1', arguments: 'SECRET_COMMAND' });
  reducer.accept(call, NOW); reducer.accept(call, NOW);
  reducer.accept(row('response_item', { type: 'function_call_output', call_id: 'call-1', output: 'SECRET_OUTPUT' }), NOW);
  assert.equal(reducer.session?.counts.toolStarts, 1); assert.equal(reducer.session?.counts.toolCompletions, 1);
  assert.equal(reducer.session?.events.at(-1)?.outcome, 'unknown');
  assert.ok(!JSON.stringify(reducer.session).includes('SECRET_'));
});
test('turn completion keeps a reusable session and the next turn resumes it', () => {
  const reducer = new RecordReducer(); reducer.accept(metadata(), NOW);
  reducer.accept(event('task_started', { turn_id: 'turn-1' }), NOW);
  reducer.accept(event('task_complete', { turn_id: 'turn-1' }), NOW);
  assert.equal(reducer.session?.status, 'idle');
  reducer.accept(event('task_started', { turn_id: 'turn-2' }), NOW);
  assert.equal(reducer.session?.status, 'working'); assert.equal(reducer.session?.counts.turns, 2);
  reducer.accept(event('turn_aborted', { turn_id: 'turn-2' }), NOW);
  assert.equal(reducer.session?.status, 'interrupted');
});
test('user-input tool is waiting, and raw user contents are not projected', () => {
  const reducer = new RecordReducer(); reducer.accept(metadata(), NOW);
  reducer.accept(row('response_item', { type: 'function_call', name: 'request_user_input', call_id: 'ask-1', arguments: 'PRIVATE' }), NOW);
  assert.equal(reducer.session?.status, 'waiting');
  reducer.accept(event('user_message', { message: 'Şimdi bu özelliği ekleyelim PRIVATE_USER' }), NOW);
  assert.equal(reducer.session?.locale, 'tr'); assert.ok(!JSON.stringify(reducer.session).includes('PRIVATE'));
});
test('analysis, instructions, reasoning and unknown message phases cannot leak', () => {
  const reducer = new RecordReducer(); reducer.accept(metadata('x', { base_instructions: 'PRIVATE_BASE' }), NOW);
  reducer.accept(row('response_item', { type: 'reasoning', summary: 'PRIVATE_REASONING' }), NOW);
  reducer.accept(event('agent_reasoning', { text: 'PRIVATE_REASONING' }), NOW);
  reducer.accept(event('agent_message', { phase: 'analysis', message: 'PRIVATE_ANALYSIS' }), NOW);
  reducer.accept(event('agent_message', { message: 'PRIVATE_UNCLASSIFIED' }), NOW);
  reducer.accept(row('compacted', { message: 'PRIVATE_COMPACTION' }), NOW);
  reducer.accept(event('agent_message', { phase: 'commentary', message: 'Public progress.' }), NOW);
  const visible = JSON.stringify(reducer.session);
  assert.ok(!visible.includes('PRIVATE')); assert.ok(visible.includes('Public progress.'));
});
test('language selection ignores code blocks and short ambiguous messages', () => {
  assert.equal(detectLocale('Şimdi bu özelliği benim için yap.'), 'tr');
  assert.equal(detectLocale('Please implement this feature for the project.'), 'en');
  assert.equal(detectLocale('ok', 'tr'), 'tr');
  assert.equal(detectLocale('```\nplease implement this with the new test\n```', 'tr'), 'tr');
  assert.equal(detectLocale('console.log("x")', 'tr'), 'tr');
});
test('current Desktop message records use only public phases and user.text language', () => {
  const reducer = new RecordReducer(); reducer.accept(metadata(), NOW);
  reducer.accept(event('task_started', { turn_id: 't1' }), NOW);
  const message = (role: string, text: string, phase?: string) => row('response_item', {
    type: 'message', role, phase, content: [{ type: 'output_text', text }],
    internal_chat_message_metadata_passthrough: { turn_id: 't1', content_item_kinds: [role === 'user' ? 'user.text' : 'unknown'] },
  });
  reducer.accept(message('user', 'Şimdi bu özelliği benim için yap.'), NOW);
  reducer.accept(message('assistant', 'Visible final.', 'final_answer'), NOW);
  reducer.accept(event('agent_message', { phase: 'final', message: 'Visible final.', turn_id: 't1' }), NOW);
  reducer.accept(message('assistant', 'PRIVATE_ANALYSIS', 'analysis'), NOW);
  reducer.accept(message('developer', 'PRIVATE_INSTRUCTIONS'), NOW);
  assert.equal(reducer.session?.locale, 'tr');
  assert.equal(reducer.session?.counts.messages, 2);
  assert.ok(!JSON.stringify(reducer.session).includes('PRIVATE'));
});
test('public text strips credential patterns and keeps a bounded message', () => {
  assert.equal(publicText('api_key=PRIVATE_VALUE'), 'api_key=[redacted]');
  assert.ok(!publicText('Bearer abcdefghijklmnopqrstuv').includes('abcdefghijkl'));
  assert.equal(publicText('x'.repeat(2000)).length, 1200);
});
test('unknown records are counted without projecting their contents', () => {
  const reducer = new RecordReducer(); reducer.accept(metadata(), NOW);
  reducer.accept(row('future_schema', { hidden: 'PRIVATE_FUTURE' }), NOW);
  assert.equal(reducer.unsupportedRecords, 1); assert.ok(!JSON.stringify(reducer.session).includes('PRIVATE'));
});
