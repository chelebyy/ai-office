import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordReducer } from '../src/observer/parser.ts';
import { toolActions, publicText, answeredQuestionIds, questionsFromCall } from '../src/observer/public-content.ts';
import { INITIAL_MOTION_POSE, liveMotion } from '../src/web/fixed-office/live-motion.ts';
import { freshness } from '../src/web/fixed-office/fixed-state.ts';
import { activityLabel, toolLabel } from '../src/web/fixed-office/activity-labels.ts';
import { event, metadata, NOW, row } from './helpers.ts';

function reducer() {
  const r = new RecordReducer();
  r.accept(metadata(), NOW);
  r.accept(event('task_started', { turn_id: 'turn-1' }), NOW);
  return r;
}

test('structured question replies accept the same qualified tool names as questions', () => {
  for (const name of ['functions.request_user_input_async', 'tools:ask_user', 'REQUEST_USER_INPUT']) {
    const questions = questionsFromCall(name, JSON.stringify({ questions: [{ title: 'Choose' }] }), 'q');
    assert.equal(questions.length, 1);
    const message = '<send_user_message_question_reply>' + JSON.stringify([{
      questionItemId: JSON.stringify([name, 'q', 0]), answer: 'A',
    }]) + '</send_user_message_question_reply>';
    assert.deepEqual([...answeredQuestionIds(message)], [questions[0].id]);
  }
  const invalid = '<send_user_message_question_reply>' + JSON.stringify([{
    questionItemId: JSON.stringify(['functions.unrelated_tool', 'q', 0]), answer: 'A',
  }]) + '</send_user_message_question_reply>';
  assert.equal(answeredQuestionIds(invalid).size, 0);
});
function ask(r: RecordReducer, name = 'request_user_input_async', callId = 'q1') {
  r.accept(
    row('response_item', {
      type: 'function_call',
      name,
      call_id: callId,
      arguments: JSON.stringify({
        questions: [
          { title: 'Hangi görünüm olsun?', options: ['Açık', 'Koyu'] },
          { question: 'Hangi renk?', options: [{ label: 'Mavi', description: 'Ayrıntı' }] },
        ],
      }),
    }),
    NOW,
  );
}
function answer(r: RecordReducer, index: number, callId = 'q1') {
  r.accept(
    row('response_item', {
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text:
            '<send_user_message_question_reply>\n' +
            JSON.stringify([
              {
                questionItemId: JSON.stringify(['request_user_input_async', callId, index]),
                answer: 'Açık',
              },
            ]) +
            '\n</send_user_message_question_reply>',
        },
      ],
    }),
    NOW,
  );
}

test('context envelopes alone retain questions but a following user answer retires async cards', () => {
  const r = reducer();
  ask(r);
  const context = '<environment_context><cwd>example</cwd></environment_context>\n<app-context>context</app-context>';
  r.accept(event('user_message', { message: context }), NOW);
  assert.equal(r.session!.pendingQuestions!.length, 2);
  r.accept(event('user_message', { message: context + '\nContinue with option A.' }), NOW);
  assert.equal(r.session!.pendingQuestions!.length, 0);
});

test('long assistant history retains complete newest messages within a text budget', () => {
  const r = reducer();
  for (let i = 0; i < 120; i++)
    r.accept(event('agent_message', { phase: 'commentary', message: String(i).padStart(3, '0') + 'x'.repeat(7900) }), NOW);
  const events = r.session!.events;
  assert.ok(events.reduce((sum, event) => sum + (event.text?.length ?? 0), 0) <= 16_000);
  assert.ok(events.at(-1)!.text!.startsWith('119'));
  assert.equal(events.at(-1)!.text!.length, 7903);
  assert.equal(r.session!.counts.messages, 120);
});

test('async question turns Cheleby toward viewer without falsifying background execution', () => {
  const r = reducer();
  ask(r);
  assert.equal(r.session!.status, 'working');
  assert.equal(r.session!.pendingQuestions!.length, 2);
  assert.equal(r.session!.events.at(-1)!.questions![1].options[0], 'Mavi');
  const motion = () =>
    liveMotion(INITIAL_MOTION_POSE, r.session!, 'connected', false, false, Date.parse(NOW));
  assert.equal(motion().mode, 'idle');
  assert.equal(motion().frozen, false);
  r.accept(
    row('response_item', {
      type: 'function_call_output',
      call_id: 'q1',
      output: '{"accepted":true}',
    }),
    NOW,
  );
  r.accept(event('task_complete', { turn_id: 'turn-1' }), NOW);
  assert.equal(r.session!.pendingQuestions!.length, 2);
  r.accept(event('task_started', { turn_id: 'turn-2' }), NOW);
  answer(r, 0, 'wrong-call');
  assert.equal(r.session!.pendingQuestions!.length, 2);
  answer(r, 0);
  assert.equal(r.session!.pendingQuestions!.length, 1);
  answer(r, 0);
  assert.equal(r.session!.pendingQuestions!.length, 1);
  answer(r, 1);
  assert.equal(r.session!.pendingQuestions!.length, 0);
  assert.equal(motion().mode, 'typing');
});

test('plain Desktop follow-up retires the async card only in its own session and preserves history', () => {
  const r = reducer();
  const other = reducer();
  ask(r);
  ask(other);
  r.accept(event('task_complete', { turn_id: 'turn-1' }), NOW);
  r.accept(event('task_started', { turn_id: 'turn-2' }), NOW);
  r.accept(
    row('response_item', {
      type: 'message',
      role: 'user',
      internal_chat_message_metadata_passthrough: {
        turn_id: 'turn-2',
        content_item_kinds: ['user.text'],
      },
      content: [
        {
          type: 'input_text',
          text: '<in-app-browser-context source="ambient-ui-state">Context</in-app-browser-context>\n\n## My request:\nlogin başarılı',
        },
      ],
    }),
    NOW,
  );
  assert.equal(r.session!.pendingQuestions!.length, 0);
  assert.equal(other.session!.pendingQuestions!.length, 2);
  assert.equal(r.session!.events.find((e) => e.callId === 'q1')!.questions!.length, 2);
  assert.equal(
    liveMotion(INITIAL_MOTION_POSE, r.session!, 'connected', false, false, Date.parse(NOW)).mode,
    'typing',
  );
});

test('plain CLI follow-up retires asynchronous questions while blocking questions await tool return', () => {
  const r = reducer();
  ask(r);
  ask(r, 'request_user_input', 'blocking');
  r.accept(event('user_message', { message: 'Tamam, devam edelim.' }), NOW);
  assert.deepEqual(
    r.session!.pendingQuestions!.map((q) => q.callId),
    ['blocking', 'blocking'],
  );
});

test('duplicate user records cannot retire questions asked after the original message', () => {
  const r = reducer();
  ask(r);
  const message = 'login başarılı';
  r.accept(event('user_message', { message }), NOW);
  assert.equal(r.session!.pendingQuestions!.length, 0);
  ask(r, 'request_user_input_async', 'q2');
  r.accept(
    row('response_item', {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: message }],
    }),
    NOW,
  );
  assert.deepEqual(
    r.session!.pendingQuestions!.map((q) => q.callId),
    ['q2', 'q2'],
  );
});

test('context-only records and malformed replies never retire a pending question', () => {
  const r = reducer();
  ask(r);
  for (const message of [
    '   ',
    '<in-app-browser-context source="ambient-ui-state">URL only</in-app-browser-context>',
    '<environment_context>cwd</environment_context>',
    '# Files mentioned by the user:\n\nexample.png',
    '<send_user_message_question_reply>invalid</send_user_message_question_reply>',
  ])
    r.accept(event('user_message', { message }), NOW);
  r.accept(
    row('response_item', {
      type: 'message',
      role: 'user',
      internal_chat_message_metadata_passthrough: { content_item_kinds: ['environment.context'] },
      content: [{ type: 'input_text', text: 'Context update' }],
    }),
    NOW,
  );
  assert.equal(r.session!.pendingQuestions!.length, 2);
});

test('an unanswered question survives a long human pause but never masks source loss', () => {
  const r = reducer();
  ask(r);
  const later = Date.parse(NOW) + 30 * 60 * 1000;
  assert.equal(freshness(r.session!, 'connected', false, later), 'current');
  assert.equal(
    liveMotion(INITIAL_MOTION_POSE, r.session!, 'connected', false, false, later).mode,
    'idle',
  );
  assert.equal(
    freshness(r.session!, 'connected', false, Date.parse(NOW) + 2 * 24 * 60 * 60 * 1000),
    'stale',
  );
  assert.equal(
    r.session!.pendingQuestions!.length,
    2,
    'Old questions are retained, not falsely marked answered',
  );
  assert.equal(freshness(r.session!, 'disconnected', false, later), 'offline');
  assert.equal(freshness(r.session!, 'connected', true, later), 'paused');
  r.session!.recordAvailable = false;
  assert.equal(freshness(r.session!, 'connected', false, later), 'unavailable');
});

test('blocking questions clear on return and duplicate question records remain idempotent', () => {
  const r = reducer();
  ask(r, 'request_user_input');
  ask(r, 'request_user_input');
  assert.equal(r.session!.status, 'waiting');
  assert.equal(r.session!.pendingQuestions!.length, 2);
  r.accept(
    row('response_item', { type: 'function_call_output', call_id: 'q1', output: 'PRIVATE_ANSWER' }),
    NOW,
  );
  assert.equal(r.session!.pendingQuestions!.length, 0);
  assert.equal(r.session!.status, 'working');
  assert.ok(!JSON.stringify(r.session).includes('PRIVATE_ANSWER'));
});

test('public actions extract bounded literals, omit replacement bodies and never execute code', () => {
  const script = `await tools.exec_command({cmd: "npm test --password='two secret words'"});
    const fake = 'tools.exec_command({cmd:"PRIVATE_FAKE"})';
    // tools.exec_command({cmd:"PRIVATE_COMMENT"})
    await tools.mcp__serena__replace_content({relative_path:'src/view.ts',needle:'PRIVATE_BEFORE',repl:'PRIVATE_AFTER'});
    if (false) await tools.exec_command({cmd:'PRIVATE_BRANCH'});
    const deferred = () => tools.exec_command({cmd:'PRIVATE_DEFERRED'});
    await tools.exec_command({cmd: unknownValue});
    throw new Error('NOT_EXECUTED');`;
  const actions = toolActions('exec', '', script);
  assert.equal(actions.length, 3);
  assert.equal(actions[0].detail, 'npm test --password=[redacted]');
  assert.deepEqual(actions[1], {
    kind: 'edit',
    toolName: 'mcp__serena__replace_content',
    detail: 'view.ts',
    nested: true,
  });
  assert.equal(actions[2].detail, undefined);
  assert.ok(!JSON.stringify(actions).includes('PRIVATE_'));
  const patch = toolActions(
    'apply_patch',
    '',
    '*** Begin Patch\n*** Add File: C:/work/file.ts\n+PRIVATE_BODY\n*** End Patch',
  );
  assert.equal(patch[0].detail, 'file.ts');
  assert.equal(patch[0].kind, 'create');
  assert.ok(!JSON.stringify(patch).includes('PRIVATE_BODY'));
  assert.deepEqual(toolActions('exec', '', 'x'.repeat(131073)), []);
  assert.deepEqual(toolActions('exec', '', 'not valid JS ???'), []);
  assert.equal(
    toolActions('exec', '', 'await tools.exec_command({cmd:"npm test"});'.repeat(40)).length,
    12,
  );
});

test('messages retain public commentary and final text with redaction and an explicit bound', () => {
  const r = reducer();
  r.accept(
    event('agent_message', { phase: 'commentary', message: 'Ara kontrol. '.repeat(500) }),
    NOW,
  );
  assert.ok(r.session!.events.at(-1)!.text!.length > 1200);
  r.accept(event('agent_message', { phase: 'analysis', message: 'PRIVATE_REASONING' }), NOW);
  assert.ok(!JSON.stringify(r.session).includes('PRIVATE_REASONING'));
  assert.equal(publicText('a'.repeat(9000), 8000).length, 8000);
  assert.ok(!publicText('password="two secret words"').includes('secret words'));
});

test('activity labels are Turkish and idle does not repeat a previous command', () => {
  const r = reducer();
  r.session!.status = 'idle';
  r.session!.currentTool = 'exec';
  assert.equal(activityLabel(r.session!, 'tr'), 'Kaytarıyor');
  for (const name of [
    'functions.exec',
    'exec_command',
    'wait',
    'functions.wait',
    'sleep',
    'request_user_input_async',
  ]) {
    assert.notEqual(toolLabel(name, 'tr'), name);
  }
  ask(r);
  assert.equal(activityLabel(r.session!, 'tr'), 'Yanıtını bekliyor');
});
