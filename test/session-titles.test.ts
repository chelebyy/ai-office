import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { SessionTitles } from '../src/observer/session-titles.ts';

test(
  'optional title open/stat/read/close cannot indefinitely block observation',
  { timeout: 5000 },
  async () => {
    const original = fs.promises.open;
    try {
      for (const phase of ['open', 'stat', 'read', 'close']) {
        let closed = 0;
        let finish!: (value: unknown) => void;
        const blocked = new Promise<unknown>((resolve) => {
          finish = resolve;
        });
        const handle = {
          stat: () =>
            phase === 'stat' ? blocked : Promise.resolve({ ino: 1, size: 1, mtimeMs: 1 }),
          read: (buffer: Buffer) => {
            buffer[0] = 10;
            return phase === 'read' ? blocked : Promise.resolve({ bytesRead: 1, buffer });
          },
          close: () => {
            closed++;
            return phase === 'close' ? blocked : Promise.resolve();
          },
        };
        fs.promises.open = (() =>
          phase === 'open' ? blocked : Promise.resolve(handle)) as typeof fs.promises.open;
        syncBuiltinESMExports();
        const titles = new SessionTitles('/profiles/synthetic', 20);
        const started = performance.now();
        await titles.refresh();
        assert.ok(performance.now() - started < 1000, phase);
        assert.equal(titles.get('unseen'), null);
        if (phase === 'open') {
          finish(handle);
          await new Promise((resolve) => setImmediate(resolve));
          assert.equal(closed, 1, 'a handle arriving after timeout must close');
        } else {
          assert.equal(closed, 1, 'stat/read failures still close the handle');
          finish(phase === 'read' ? { bytesRead: 0 } : undefined);
        }
      }
    } finally {
      fs.promises.open = original;
      syncBuiltinESMExports();
    }
  },
);
