import test from 'node:test';
import assert from 'node:assert/strict';
import { observerIsLive, observerSilenceLimit } from '../src/web/observer-health.ts';
import type { ObserverSnapshot } from '../src/shared/contract.ts';

const now = Date.parse('2026-09-13T19:00:00Z');
const snapshot = (checkedAt: string | null, pollIntervalMs = 1500) =>
  ({
    schemaVersion: 1,
    revision: 10,
    generatedAt: new Date(now).toISOString(),
    sessions: [],
    scan: {
      checkedAt,
      pollIntervalMs,
      status: 'ready',
      files: 1,
      candidateFiles: 1,
      bytesRead: 0,
      malformedLines: 0,
      oversizedLines: 0,
      resets: 0,
      readErrors: 0,
      unsupportedRecords: 0,
      lastReadDurationMs: 10,
      recentDays: 7,
      maxFiles: 60,
    },
  }) as ObserverSnapshot;

test('a fresh response cannot hide an old or missing scanner heartbeat', () => {
  assert.equal(observerIsLive(snapshot(new Date(now).toISOString()), now, now), true);
  for (const checkedAt of [null, 'invalid', new Date(now - 16_000).toISOString()]) {
    assert.equal(observerIsLive(snapshot(checkedAt), now, now), false);
  }
  assert.equal(observerIsLive(null, now, now), false);
});

test('a silent socket expires even while the retained session claims working', () => {
  const data = snapshot(new Date(now).toISOString());
  assert.equal(observerIsLive(data, now, now + 15_000), true);
  assert.equal(observerIsLive(data, now, now + 15_001), false);
  // A reconnect returning that same old snapshot must stay disconnected.
  assert.equal(observerIsLive(data, now + 20_000, now + 20_000), false);
  assert.equal(
    observerIsLive(snapshot(new Date(now + 20_000).toISOString()), now + 20_000, now + 20_000),
    true,
  );
});

test('heartbeat tolerance follows configured polling and bounds malformed intervals', () => {
  assert.equal(observerSilenceLimit(snapshot(null, 30_000)), 120_000);
  for (const interval of [NaN, Infinity, -100])
    assert.equal(observerSilenceLimit(snapshot(null, interval)), 15_000);
  assert.equal(observerSilenceLimit(snapshot(null, 1e12)), 120_000);
});
