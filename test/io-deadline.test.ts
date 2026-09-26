import test from 'node:test';
import assert from 'node:assert/strict';
import { ioDeadline } from '../src/observer/io-deadline.ts';

test('a blocked source open times out, other I/O completes, and a late handle is disposed', async () => {
  let finish!: (value: { close: () => void }) => void;
  let closed = false;
  const blocked = new Promise<{ close: () => void }>(resolve => { finish = resolve; });
  const result = ioDeadline(blocked, 20, handle => handle.close());
  assert.equal(await ioDeadline(Promise.resolve('another source'), 1000), 'another source');
  await assert.rejects(result, { code: 'ETIMEDOUT' });
  finish({ close: () => { closed = true; } });
  await Promise.resolve();
  assert.equal(closed, true);
});

test('source failures keep their original error instead of becoming false timeouts', async () => {
  const error = Object.assign(new Error('unavailable'), { code: 'EACCES' });
  await assert.rejects(ioDeadline(Promise.reject(error)), actual => actual === error);
});
