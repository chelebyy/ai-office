import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, rename, unlink, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CodexObserver } from '../src/observer/reader.ts';
import { event, jsonl, metadata, NOW, row, temporarySource } from './helpers.ts';

test('incremental reader waits for a complete UTF-8 JSON line and does not replay it', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const filename = await source.record('one', jsonl(metadata()));
  const observer = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) });
  await observer.scanOnce();
  const message = Buffer.from(jsonl(event('agent_message', { phase: 'final', message: 'Güzel bir özellik.' })));
  const split = message.indexOf(Buffer.from('ü')) + 1;
  await appendFile(filename, message.subarray(0,split)); await observer.scanOnce();
  assert.equal(observer.snapshot().sessions[0].counts.messages, 0);
  await appendFile(filename, message.subarray(split)); await observer.scanOnce();
  assert.equal(observer.snapshot().sessions[0].events.at(-1)?.text, 'Güzel bir özellik.');
  const count = observer.snapshot().sessions[0].events.length;
  await observer.scanOnce(); assert.equal(observer.snapshot().sessions[0].events.length, count);
  assert.equal(observer.snapshot().scan.malformedLines, 0);
});
test('bad and oversized lines are skipped while later events still work', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  await source.record('bad', jsonl(metadata()) + '{broken}\n' + 'x'.repeat(700) + '\n' + jsonl(event('task_started', { turn_id: 't1' })));
  const observer = new CodexObserver({ codexHome: source.root, maxLineBytes: 400, now: () => new Date(NOW) });
  await observer.scanOnce();
  assert.equal(observer.snapshot().scan.malformedLines, 1); assert.equal(observer.snapshot().scan.oversizedLines, 1);
  assert.equal(observer.snapshot().sessions[0].status, 'working');
});
test('truncate, same-size replacement and restart reconstruct observed state', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const filename = await source.record('reset', jsonl(metadata(), event('task_started', { turn_id: 't1' }), event('task_complete', { turn_id: 't1' })));
  const observer = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) });
  await observer.scanOnce(); assert.equal(observer.snapshot().sessions[0].status, 'idle');
  await writeFile(filename, jsonl(metadata(), event('task_started', { turn_id: 't2' })));
  await observer.scanOnce(); assert.equal(observer.snapshot().sessions[0].status, 'working'); assert.equal(observer.snapshot().scan.resets, 1);
  await writeFile(filename, jsonl(metadata(), event('task_started', { turn_id: 't3' })));
  await utimes(filename, new Date(), new Date(Date.now() + 10000));
  await observer.scanOnce(); assert.equal(observer.snapshot().scan.resets, 2);
  assert.equal(observer.snapshot().sessions[0].lastTurnId, 't3');
  const restarted = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) }); await restarted.scanOnce();
  assert.deepEqual(restarted.snapshot().sessions, observer.snapshot().sessions);
});
test('missing records retain unavailable state and moved records are not duplicate sessions', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const filename = await source.record('move', jsonl(metadata(), event('task_started', { turn_id: 't1' })));
  const observer = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) }); await observer.scanOnce();
  const moved = path.join(source.day, 'rollout-moved.jsonl'); await rename(filename, moved); await observer.scanOnce();
  assert.equal(observer.snapshot().sessions.length, 1); assert.equal(observer.snapshot().sessions[0].recordAvailable, true);
  await unlink(moved); await observer.scanOnce();
  assert.equal(observer.snapshot().sessions[0].recordAvailable, false); assert.equal(observer.snapshot().sessions[0].status, 'working');
});
test('bounded history keeps metadata, labels partial coverage and reads the tail', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  await source.record('large', jsonl(metadata(), row('world_state', { padding: 'x'.repeat(5000) }), event('task_complete', { turn_id: 'tail-turn' })));
  const observer = new CodexObserver({ codexHome: source.root, historyBytes: 512, maxLineBytes: 1024, now: () => new Date(NOW) });
  await observer.scanOnce();
  assert.equal(observer.snapshot().sessions[0].id, 'main-1'); assert.equal(observer.snapshot().sessions[0].historyPartial, true);
  assert.equal(observer.snapshot().sessions[0].status, 'idle'); assert.equal(observer.snapshot().scan.malformedLines, 0);
});
test('relations resolve transitively while a missing parent remains explicit', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  await source.record('root', jsonl(metadata('root')));
  await source.record('child', jsonl(metadata('child', { source: { subagent: { thread_spawn: { parent_thread_id: 'root' } } } })));
  await source.record('nested', jsonl(metadata('nested', { source: { subagent: { thread_spawn: { parent_thread_id: 'child' } } } })));
  await source.record('orphan', jsonl(metadata('orphan', { source: { subagent: { thread_spawn: { parent_thread_id: 'unseen' } } } })));
  const observer = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) }); await observer.scanOnce();
  assert.equal(observer.snapshot().sessions.find(s => s.id === 'nested')?.rootId, 'root');
  assert.equal(observer.snapshot().sessions.find(s => s.id === 'orphan')?.parentResolved, false);
  assert.equal(observer.snapshot().sessions.length, 4);
});
test('source missing is visible and independent scans coalesce', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const observer = new CodexObserver({ codexHome: path.join(source.root,'missing'), now: () => new Date(NOW) });
  await Promise.all([observer.scanOnce(), observer.scanOnce()]);
  assert.equal(observer.snapshot().scan.status, 'source_missing'); assert.equal(observer.snapshot().revision, 1);
});
