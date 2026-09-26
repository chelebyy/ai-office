import type { ObserverSnapshot } from '../shared/contract.ts';

export function observerSilenceLimit(snapshot: ObserverSnapshot | null) {
  const interval = snapshot?.scan.pollIntervalMs;
  return Math.max(
    15_000,
    typeof interval === 'number' && Number.isFinite(interval)
      ? Math.min(30_000, Math.max(500, interval)) * 4
      : 0,
  );
}

/** A fresh HTTP response/socket is not proof that the file scanner is still running. */
export function observerIsLive(snapshot: ObserverSnapshot | null, receivedAt: number, now: number) {
  if (snapshot?.runtime && snapshot.runtime.state !== 'running') return false;
  const checkedAt = Date.parse(snapshot?.scan.checkedAt ?? '');
  const limit = observerSilenceLimit(snapshot);
  return (
    Number.isFinite(checkedAt) &&
    receivedAt > 0 &&
    now - receivedAt <= limit &&
    now - checkedAt <= limit
  );
}

/** A deliberately stopped scanner can still have a healthy control connection. */
export function observerTransportIsLive(
  snapshot: ObserverSnapshot | null,
  receivedAt: number,
  now: number,
) {
  if (!snapshot?.runtime || snapshot.runtime.state === 'running')
    return observerIsLive(snapshot, receivedAt, now);
  const updatedAt = Date.parse(snapshot.runtime.updatedAt);
  return (
    Number.isFinite(updatedAt) &&
    receivedAt > 0 &&
    now - receivedAt <= 15000 &&
    now - updatedAt <= 15000
  );
}
