import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CodexObserver } from '../src/observer/reader.ts';
import { OfficeRuntime } from '../src/observer/office-runtime.ts';
import { createObserverServer } from '../src/observer/server.ts';
import { observerIsLive, observerTransportIsLive } from '../src/web/observer-health.ts';
import { jsonl, metadata, temporarySource } from './helpers.ts';

test('browser stop halts record scanning; start/restart reconstruct current data without closing the page', async (t) => {
  const source = await temporarySource();
  await source.record('one', jsonl(metadata('room-one')));
  await writeFile(path.join(source.root, 'index.html'), '<title>Office controls</title>');
  const desired: boolean[] = [];
  const runtime = new OfficeRuntime(
    () => new CodexObserver({ codexHome: source.root, pollIntervalMs: 20 }),
    async (enabled) => {
      desired.push(enabled);
    },
  );
  const app = createObserverServer({ observer: runtime, runtime, webRoot: source.root });
  const url = await app.listen(0);
  t.after(async () => {
    await runtime.close();
    await app.close();
    await source.cleanup();
  });
  await runtime.initialize(true);
  const page = await fetch(url);
  const cookie = page.headers.get('set-cookie')!.split(';')[0];
  const control = await fetch(url + '/api/runtime', { headers: { cookie } }).then((r) => r.json());
  const headers = { cookie, origin: url, 'X-Cheleby-Control': control.controlToken };
  const command = (action: string) =>
    fetch(url + '/api/runtime/' + action, { method: 'POST', headers });
  assert.equal(control.state, 'running');
  assert.equal((await command('stop')).status, 202);
  await runtime.settled();
  const stopped = runtime.snapshot();
  assert.equal(stopped.runtime?.state, 'stopped');
  assert.equal((await fetch(url)).status, 200);
  await source.record('two', jsonl(metadata('room-two')));
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(runtime.snapshot().revision, stopped.revision);
  assert.equal(
    runtime.snapshot().sessions.some((s) => s.id === 'room-two'),
    false,
  );
  const now = Date.now();
  assert.equal(observerIsLive(stopped, now, now), false);
  assert.equal(observerTransportIsLive(stopped, now, now), true);
  assert.equal(observerTransportIsLive(stopped, now, now + 16000), false);
  assert.equal((await command('start')).status, 202);
  await runtime.settled();
  assert.equal(runtime.status().state, 'running');
  assert.ok(runtime.snapshot().sessions.some((s) => s.id === 'room-two'));
  assert.equal((await command('restart')).status, 202);
  await runtime.settled();
  assert.equal(runtime.status().state, 'running');
  assert.ok(runtime.snapshot().sessions.some((s) => s.id === 'room-one'));
  assert.deepEqual(desired, [false, true, true]);
  assert.ok(!JSON.stringify(runtime.snapshot()).includes(control.controlToken));
});

test('office commands require the local origin, session cookie, control token and empty POST body', async (t) => {
  const source = await temporarySource();
  await writeFile(path.join(source.root, 'index.html'), '<title>Office</title>');
  const runtime = new OfficeRuntime(() => new CodexObserver({ codexHome: source.root }));
  const app = createObserverServer({ observer: runtime, runtime, webRoot: source.root });
  const url = await app.listen(0);
  t.after(async () => {
    await runtime.close();
    await app.close();
    await source.cleanup();
  });
  const cookie = (await fetch(url)).headers.get('set-cookie')!.split(';')[0];
  assert.equal((await fetch(url + '/api/runtime')).status, 401);
  const token = (await fetch(url + '/api/runtime', { headers: { cookie } }).then((r) => r.json()))
    .controlToken;
  const valid = { cookie, origin: url, 'X-Cheleby-Control': token };
  const forbiddenHeaders: Record<string, string>[] = [
    { origin: url },
    { cookie, origin: url },
    { ...valid, origin: 'https://foreign.invalid' },
    { ...valid, 'X-Cheleby-Control': 'bad' },
    { ...valid, 'sec-fetch-site': 'cross-site' },
  ];
  for (const headers of forbiddenHeaders) {
    const response = await fetch(url + '/api/runtime/start', { method: 'POST', headers });
    assert.ok([401, 403].includes(response.status));
  }
  assert.equal(
    (
      await fetch(url + '/api/runtime/start', {
        method: 'POST',
        headers: { cookie, 'X-Cheleby-Control': token },
      })
    ).status,
    403,
  );
  assert.equal((await fetch(url + '/api/runtime/start', { headers: valid })).status, 405);
  assert.equal(
    (
      await fetch(url + '/api/runtime/start', {
        method: 'POST',
        headers: valid,
        body: 'arbitrary command',
      })
    ).status,
    400,
  );
  assert.equal(
    (await fetch(url + '/api/runtime/execute', { method: 'POST', headers: valid })).status,
    404,
  );
  assert.equal(
    (await fetch(url + '/api/snapshot', { method: 'POST', headers: valid })).status,
    405,
  );
  assert.equal(runtime.status().state, 'stopped');
});

test('conflicting commands are rejected while transitioning; failed starts stay inactive and can recover', async (t) => {
  const source = await temporarySource();
  let release!: () => void;
  let fail = true;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const runtime = new OfficeRuntime(
    () => new CodexObserver({ codexHome: source.root }),
    async () => {
      await gate;
      if (fail) throw new Error('Supervisor unavailable');
    },
  );
  t.after(async () => {
    release();
    await runtime.close();
    await source.cleanup();
  });
  runtime.command('start');
  assert.equal(runtime.status().state, 'starting');
  assert.throws(() => runtime.command('stop'), /busy/);
  release();
  await runtime.settled();
  assert.equal(runtime.status().state, 'error');
  assert.equal(observerIsLive(runtime.snapshot(), Date.now(), Date.now()), false);
  fail = false;
  runtime.command('start');
  await runtime.settled();
  assert.equal(runtime.status().state, 'running');
  await runtime.close();
  assert.throws(() => runtime.command('start'), /busy/);
});

test('a supervisor-restored stopped office does not scan until explicitly started', async (t) => {
  const source = await temporarySource();
  await source.record('one', jsonl(metadata('only-after-start')));
  const runtime = new OfficeRuntime(
    () => new CodexObserver({ codexHome: source.root, pollIntervalMs: 20 }),
  );
  t.after(async () => {
    await runtime.close();
    await source.cleanup();
  });
  await runtime.initialize(false);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(runtime.snapshot().sessions, []);
  assert.equal(runtime.snapshot().scan.checkedAt, null);
  runtime.command('start');
  await runtime.settled();
  assert.equal(runtime.snapshot().sessions[0]?.id, 'only-after-start');
});
