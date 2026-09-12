import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import WebSocket from 'ws';
import { CodexObserver } from '../src/observer/reader.ts';
import { createObserverServer } from '../src/observer/server.ts';
import { jsonl, metadata, NOW, temporarySource } from './helpers.ts';

async function fixture(t: TestContext) {
  const source = await temporarySource();
  await source.record('test', jsonl(metadata('safe-session', { base_instructions: 'NEVER_PUBLIC' })));
  await writeFile(path.join(source.root,'index.html'), '<!doctype html><title>Cheleby test</title>');
  const observer = new CodexObserver({ codexHome: source.root, now: () => new Date(NOW) });
  await observer.scanOnce();
  const app = createObserverServer({ observer, webRoot: source.root });
  const url = await app.listen(0);
  t.after(async () => { await observer.stop(); await app.close(); await source.cleanup(); });
  const response = await fetch(url);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  return { url, cookie, observer };
}

test('local page bootstraps a cookie; only authenticated readers see the snapshot', async t => {
  const { url, cookie } = await fixture(t);
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
  assert.equal((await fetch(`${url}/api/snapshot`)).status, 401);
  const response = await fetch(`${url}/api/snapshot`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const data = await response.text(); assert.ok(data.includes('safe-session')); assert.ok(!data.includes('NEVER_PUBLIC'));
});
test('foreign origins, cross-site fetches and mutations are rejected', async t => {
  const { url, cookie } = await fixture(t);
  assert.equal((await fetch(`${url}/api/snapshot`, { headers: { cookie, origin: 'https://example.invalid' } })).status, 403);
  assert.equal((await fetch(url, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await fetch(`${url}/api/snapshot`, { method: 'POST', headers: { cookie } })).status, 405);
});
test('malformed cookies return unauthorized without crashing the server', async t => {
  const { url } = await fixture(t);
  assert.equal((await fetch(`${url}/api/snapshot`, { headers: { cookie: `cheleby_session=${'é'.repeat(64)}` } })).status, 401);
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
});
test('websocket delivers initial and subsequent snapshots from the same source', async t => {
  const { url, cookie, observer } = await fixture(t);
  const socket = new WebSocket(`${url.replace('http:','ws:')}/live`, { origin: url, headers: { cookie } });
  socket.on('error', () => {});
  const first = await new Promise<{ revision: number }>((resolve, reject) => {
    socket.once('message', data => resolve(JSON.parse(data.toString()))); socket.once('error', reject);
  });
  const next = new Promise<{ revision: number }>(resolve => socket.once('message', data => resolve(JSON.parse(data.toString()))));
  await observer.scanOnce(); assert.equal((await next).revision, first.revision + 1);
  socket.close();
});
test('websocket refuses foreign origin even with a valid local cookie', async t => {
  const { url, cookie } = await fixture(t);
  const status = await new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(`${url.replace('http:','ws:')}/live`, { origin: 'https://example.invalid', headers: { cookie } });
    socket.on('error', () => {});
    socket.once('unexpected-response', (_req, response) => { response.resume(); socket.terminate(); resolve(response.statusCode ?? 0); });
    socket.once('open', () => { socket.close(); reject(new Error('Unexpected connection')); });
  });
  assert.equal(status, 403);
});
