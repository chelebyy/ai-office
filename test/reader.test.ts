import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdir, rename, unlink, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { discoverRollouts } from '../src/observer/rollout-discovery.ts';
import { CodexObserver } from '../src/observer/reader.ts';
import { event, jsonl, metadata, NOW, row, temporarySource } from './helpers.ts';

test('archive metadata overlaps across date folders while keeping the global I/O cap', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const root = path.join(source.root, 'sessions');
  for (let day = 1; day <= 24; day++) {
    const directory = path.join(root, '2026', '08', String(day).padStart(2, '0'));
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, `rollout-archive-${day}.jsonl`), '');
  }
  const original = fs.promises.stat;
  let active = 0, peak = 0, checked = 0;
  fs.promises.stat = (async (...args: Parameters<typeof fs.promises.stat>) => {
    if (!String(args[0]).startsWith(root + path.sep)) return Reflect.apply(original, fs.promises, args);
    active++; peak = Math.max(peak, active); checked++;
    try {
      await new Promise(resolve => setTimeout(resolve, 5));
      return await Reflect.apply(original, fs.promises, args);
    } finally { active--; }
  }) as typeof fs.promises.stat;
  syncBuiltinESMExports();
  try {
    const result = await discoverRollouts(root, new Set(), new Set(), Date.now());
    assert.equal(result.catalog.length, 24);
    assert.equal(checked, 24);
    assert.equal(result.errors, 0);
    assert.ok(peak > 1, 'One-file archive folders must not serialize all metadata checks');
    assert.ok(peak <= 16, 'Directory count must not multiply the filesystem concurrency cap');
  } finally {
    fs.promises.stat = original; syncBuiltinESMExports();
  }
});

test('snapshots stay coherent while a scan is reading other records', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const a = await source.record('atomic-a', jsonl(metadata('a'), event('task_complete')));
  const b = await source.record('atomic-b', jsonl(metadata('b'), event('task_complete')));
  let observing = false, capturing = false;
  const during: ReturnType<CodexObserver['snapshot']>[] = [];
  const observer = new CodexObserver({ codexHome: source.root, now: () => {
    if (observing && !capturing) { capturing = true; during.push(observer.snapshot()); capturing = false; }
    return new Date(NOW);
  } });
  await observer.scanOnce();
  const before = observer.snapshot();
  await appendFile(a, jsonl(event('task_started', { turn_id: 'new-a' })));
  await appendFile(b, jsonl(event('task_started', { turn_id: 'new-b' })));
  observing = true;
  await observer.scanOnce();
  observing = false;
  assert.ok(during.length > 1);
  for (const snapshot of during) assert.deepEqual(snapshot, before, 'Only the previously completed scan is public during I/O');
  const after = observer.snapshot();
  assert.equal(after.revision, before.revision + 1);
  assert.ok(after.sessions.every(s => s.recordAvailable && s.status === 'working'));
  after.sessions[0].status = 'unknown';
  assert.ok(observer.snapshot().sessions.every(s => s.status === 'working'), 'Callers cannot mutate the published snapshot');
});

test('known internal helpers are not reopened when only their private body grows', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const file = await source.record('helper', jsonl(metadata('helper', { source: { subagent: { other: 'guardian' } } })));
  await utimes(file, new Date(NOW), new Date(NOW));
  const observer = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) });
  await observer.scanOnce();
  const before = observer.snapshot().scan.bytesRead;
  await appendFile(file, jsonl(event('agent_message', { phase: 'final', message: 'PRIVATE_HELPER_BODY'.repeat(30000) })));
  await utimes(file, new Date(NOW), new Date(NOW));
  await observer.scanOnce();
  const after = observer.snapshot();
  assert.equal(after.scan.bytesRead, before);
  assert.equal(after.sessions[0].recordAvailable, true);
  assert.ok(!JSON.stringify(after).includes('PRIVATE_HELPER_BODY'));
});

test('old resumed files are discovered while dormant archive contents stay unread', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const oldDay = path.join(source.root, 'sessions', '2025', '12', '01');
  await mkdir(oldDay, { recursive: true });
  const old = path.join(oldDay, 'rollout-old-main.jsonl');
  const untouched = path.join(oldDay, 'rollout-dormant.jsonl');
  const oldTime = new Date('2025-12-01T10:00:00Z');
  await writeFile(old, jsonl(metadata('old-main', { timestamp: oldTime.toISOString() })));
  await writeFile(untouched, 'not-json\n'.repeat(100_000));
  await utimes(old, oldTime, oldTime); await utimes(untouched, oldTime, oldTime);
  const observer = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) });
  await observer.scanOnce();
  assert.equal(observer.snapshot().sessions.length, 0);
  assert.equal(observer.snapshot().scan.bytesRead, 0);
  assert.equal(observer.snapshot().scan.discoveryFiles, 2);
  await appendFile(old, jsonl(event('task_started', { turn_id: 'resumed' })));
  await utimes(old, new Date(NOW), new Date(NOW));
  await observer.scanOnce();
  const live = observer.snapshot();
  assert.equal(live.sessions.length, 1);
  assert.equal(live.sessions[0].id, 'old-main');
  assert.equal(live.sessions[0].status, 'working');
  assert.equal(live.scan.reactivatedFiles, 1);
  assert.equal(live.scan.malformedLines, 0);
  assert.ok(live.scan.bytesRead < 2000);
  await observer.scanOnce();
  assert.equal(observer.snapshot().scan.bytesRead, live.scan.bytesRead);
  await appendFile(old, jsonl(event('task_complete', { turn_id: 'resumed' })));
  await observer.scanOnce();
  assert.equal(observer.snapshot().sessions[0].status, 'idle');
  const restarted = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) });
  await restarted.scanOnce();
  assert.equal(restarted.snapshot().sessions[0].status, 'idle');
  assert.equal(restarted.snapshot().scan.malformedLines, 0);
});

test('fresh old children recover explicit dormant parents within the read budget', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const oldDay = path.join(source.root, 'sessions', '2025', '12', '01');
  await mkdir(oldDay, { recursive: true });
  const parent = path.join(oldDay, 'rollout-parent.jsonl');
  const child = path.join(oldDay, 'rollout-child.jsonl');
  const oldTime = new Date('2025-12-01T10:00:00Z');
  await writeFile(parent, jsonl(metadata('parent', { timestamp: oldTime.toISOString() })));
  await writeFile(child, jsonl(metadata('child', {
    source: { subagent: { thread_spawn: { parent_thread_id: 'parent' } } },
  }), event('task_started', { turn_id: 'child-work' })));
  await source.record('unrelated', jsonl(metadata('unrelated')));
  await utimes(parent, oldTime, oldTime);
  await utimes(child, new Date(Date.parse(NOW) + 1000), new Date(Date.parse(NOW) + 1000));
  const unrelatedPath = path.join(source.day, 'rollout-unrelated.jsonl');
  await utimes(unrelatedPath, new Date(NOW), new Date(NOW));
  const observer = new CodexObserver({ codexHome: source.root, maxFiles: 2, now: () => new Date(NOW) });
  await observer.scanOnce();
  const snap = observer.snapshot();
  assert.deepEqual(snap.sessions.map(s => s.id).sort(), ['child', 'parent']);
  assert.equal(snap.sessions.find(s => s.id === 'child')?.rootId, 'parent');
  assert.equal(snap.sessions.find(s => s.id === 'child')?.parentResolved, true);
  assert.equal(snap.scan.files, 2);
});

test('a family discovered at the budget boundary is promoted next scan without extra reads', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const oldDay = path.join(source.root, 'sessions', '2025', '12', '01');
  await mkdir(oldDay, { recursive: true });
  const parent = path.join(oldDay, 'rollout-parent.jsonl');
  const child = path.join(oldDay, 'rollout-child.jsonl');
  const oldTime = new Date('2025-12-01T10:00:00Z');
  await writeFile(parent, jsonl(metadata('parent')));
  await writeFile(child, jsonl(metadata('child', {
    source: { subagent: { thread_spawn: { parent_thread_id: 'parent' } } },
  })));
  const unrelated = await source.record('unrelated', jsonl(metadata('unrelated')));
  await utimes(parent, oldTime, oldTime);
  await utimes(child, new Date(NOW), new Date(NOW));
  const newer = new Date(Date.parse(NOW) + 1000);
  await utimes(unrelated, newer, newer);
  const observer = new CodexObserver({ codexHome: source.root, maxFiles: 2, now: () => new Date(NOW) });
  await observer.scanOnce();
  assert.equal(observer.snapshot().scan.files, 2);
  assert.equal(observer.snapshot().sessions.find(s => s.id === 'child')?.parentResolved, false);
  await observer.scanOnce();
  const next = observer.snapshot();
  assert.equal(next.scan.files, 2);
  assert.equal(next.sessions.find(s => s.id === 'child')?.parentResolved, true);
  assert.equal(next.sessions.find(s => s.id === 'parent')?.recordAvailable, true);
  assert.equal(next.sessions.find(s => s.id === 'child')?.recordAvailable, true);
});

test('file modification time discovers candidates but never fabricates working status', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  const oldDay = path.join(source.root, 'sessions', '2025', '12', '01');
  await mkdir(oldDay, { recursive: true });
  await writeFile(path.join(oldDay, 'rollout-ended.jsonl'), jsonl(metadata('ended'),
    event('task_complete', { turn_id: 'done' })));
  const observer = new CodexObserver({ codexHome: source.root, maxFiles: 1, now: () => new Date(NOW) });
  await observer.scanOnce();
  assert.equal(observer.snapshot().sessions[0].status, 'idle');
  assert.equal(observer.snapshot().scan.files, 1);
});

test('public titles join observed IDs and renames never change execution state', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  await source.record('named', jsonl(metadata('named'), event('task_complete', { turn_id: 'done' })));
  const index = path.join(source.root, 'session_index.jsonl');
  const title = (id: string, thread_name: string, updated_at = NOW) => JSON.stringify({ id, thread_name, updated_at }) + '\n';
  await writeFile(index, title('named', 'Oda tasarımını oluştur') + title('unobserved', 'Never create this session'));
  const observer = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) });
  await observer.scanOnce();
  const before = observer.snapshot().sessions;
  assert.equal(before.length, 1);
  assert.equal(before[0].title, 'Oda tasarımını oluştur');
  await appendFile(index, title('named', 'Yeni başlık', '2026-09-12T18:00:00Z') + title('named', 'Older title'));
  await observer.scanOnce();
  const after = observer.snapshot().sessions[0];
  assert.equal(after.title, 'Yeni başlık');
  assert.equal(after.status, before[0].status);
  assert.equal(after.lastEventAt, before[0].lastEventAt);
  assert.equal(after.lastObservedAt, before[0].lastObservedAt);
  assert.deepEqual(after.counts, before[0].counts);
  assert.deepEqual(after.events, before[0].events);
  await unlink(index); await observer.scanOnce();
  assert.equal(observer.snapshot().sessions[0].title, null);
  assert.equal(observer.snapshot().scan.status, 'ready');
});

test('optional title index skips damaged rows and waits for a complete appended line', async t => {
  const source = await temporarySource(); t.after(() => source.cleanup());
  await source.record('named', jsonl(metadata('named')));
  const index = path.join(source.root, 'session_index.jsonl');
  const valid = JSON.stringify({ id: 'named', thread_name: 'Türkçe başlık', updated_at: NOW });
  await writeFile(index, 'broken\n' + JSON.stringify({ id: 'named', thread_name: 'Invalid time', updated_at: 'bad' }) + '\n' + valid);
  const observer = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) });
  await observer.scanOnce();
  assert.equal(observer.snapshot().sessions[0].title, null);
  await appendFile(index, '\n'); await observer.scanOnce();
  assert.equal(observer.snapshot().sessions[0].title, 'Türkçe başlık');
  assert.equal(observer.snapshot().scan.malformedLines, 0);
});

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
for (const boundedHistory of [false, true]) {
  test(`observation timestamps follow the byte read when the clock advances during a scan (bounded history: ${boundedHistory})`, async t => {
    const source = await temporarySource(); t.after(() => source.cleanup());
    const occurredAt = new Date(Date.parse(NOW) + 500).toISOString();
    const readAt = new Date(Date.parse(NOW) + 1000).toISOString();
    await source.record('timing', jsonl(
      metadata(),
      ...(boundedHistory ? [row('world_state', { padding: 'x'.repeat(5000) })] : []),
      event('task_started', { turn_id: 'during-scan' }, occurredAt),
    ));
    let clockReads = 0;
    const observer = new CodexObserver({
      codexHome: source.root,
      ...(boundedHistory ? { historyBytes: 512, maxLineBytes: 1024 } : {}),
      now: () => new Date(clockReads++ === 0 ? NOW : readAt),
    });
    await observer.scanOnce();
    const snapshot = observer.snapshot();
    assert.equal(snapshot.scan.checkedAt, NOW);
    const session = snapshot.sessions[0];
    assert.equal(session.events.at(-1)?.occurredAt, occurredAt);
    assert.equal(session.lastObservedAt, readAt);
    assert.ok(session.events.every(value => value.observedAt === readAt));
  });
}

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
