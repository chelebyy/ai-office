import { useEffect, useRef, useState } from 'react';
import type { ObserverSnapshot, OfficeRuntimeState } from '../shared/contract.ts';
import { observerTransportIsLive } from './observer-health.ts';

export function useObserver(paused: boolean) {
  const [snapshot, setSnapshot] = useState<ObserverSnapshot | null>(null);
  const [connection, setConnection] = useState<'connected' | 'connecting' | 'disconnected'>(
    'connecting',
  );
  // Transport timestamps live in latest; the UI only needs control-state changes.
  const [runtime, setRuntime] = useState<
    Pick<OfficeRuntimeState, 'state' | 'failed'> | undefined
  >();
  const latest = useRef<ObserverSnapshot | null>(null);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
    if (!paused && !document.hidden && latest.current) setSnapshot(latest.current);
  }, [paused]);
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let socketDeadline: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | null = null;
    let generation = 0;
    let failures = 0;
    let receivedAt = 0;
    const visible = () => {
      if (!document.hidden && !pausedRef.current && latest.current) setSnapshot(latest.current);
    };
    document.addEventListener('visibilitychange', visible);
    const apply = (data: unknown) => {
      const candidate = data as ObserverSnapshot;
      if (candidate?.schemaVersion !== 1 || !Array.isArray(candidate.sessions)) return false;
      // A stopped replacement host intentionally has not read any records yet.
      // Retain the room artwork until tracking resumes; runtime state keeps it frozen.
      const display =
        candidate.runtime &&
        candidate.runtime.state !== 'running' &&
        !candidate.scan.checkedAt &&
        latest.current
          ? { ...candidate, sessions: latest.current.sessions }
          : candidate;
      latest.current = display;
      const nextRuntime = candidate.runtime;
      setRuntime((current) =>
        current?.state === nextRuntime?.state && current?.failed === nextRuntime?.failed
          ? current
          : nextRuntime && { state: nextRuntime.state, failed: nextRuntime.failed },
      );
      receivedAt = Date.now();
      if (!pausedRef.current && !document.hidden) setSnapshot(display);
      const live = observerTransportIsLive(candidate, receivedAt, receivedAt);
      if (live) failures = 0;
      setConnection(live ? 'connected' : candidate.scan?.checkedAt ? 'disconnected' : 'connecting');
      return live;
    };
    const retire = () => {
      clearTimeout(socketDeadline);
      request?.abort();
      request = null;
      if (socket) {
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
        socket = null;
      }
    };
    const connect = async () => {
      if (disposed) return;
      clearTimeout(retry);
      retire();
      const attempt = ++generation;
      const current = () => !disposed && generation === attempt;
      const controller = new AbortController();
      request = controller;
      const fetchDeadline = setTimeout(() => controller.abort(), 5000);
      try {
        try {
          const options = { cache: 'no-store' as const, signal: controller.signal };
          const response = await fetch('/api/snapshot', options);
          if (response.status === 401) await fetch('/', options);
          else if (response.ok) {
            const data: unknown = await response.json();
            if (current()) apply(data);
          }
        } finally {
          clearTimeout(fetchDeadline);
        }
        if (!current()) return;
        const opened = new WebSocket(
          `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/live`,
        );
        socket = opened;
        // Both an unfinished handshake and an open socket with no fresh initial
        // snapshot must expire, including the very first page load.
        socketDeadline = setTimeout(() => {
          if (current()) schedule();
        }, 5000);
        opened.onmessage = (event) => {
          if (!current()) return;
          try {
            if (apply(JSON.parse(event.data))) clearTimeout(socketDeadline);
          } catch {
            /* retain valid state */
          }
        };
        opened.onerror = () => {
          if (current()) schedule();
        };
        opened.onclose = () => {
          if (current()) schedule();
        };
      } catch {
        if (current()) schedule();
      }
    };
    function schedule() {
      if (disposed) return;
      generation++;
      retire();
      setConnection('disconnected');
      clearTimeout(retry);
      retry = setTimeout(
        () => {
          void connect();
        },
        Math.min(1000 * 2 ** failures++, 10000),
      );
    }
    // Expire scanner silence independently from network connection health.
    const heartbeat = window.setInterval(() => {
      if (disposed || observerTransportIsLive(latest.current, receivedAt, Date.now())) return;
      if (!latest.current?.scan.checkedAt && !latest.current?.runtime) return;
      setConnection('disconnected');
      if (socket?.readyState === WebSocket.OPEN) schedule();
    }, 1000);
    void connect();
    return () => {
      disposed = true;
      generation++;
      document.removeEventListener('visibilitychange', visible);
      clearTimeout(retry);
      window.clearInterval(heartbeat);
      retire();
    };
  }, []);
  return {
    snapshot,
    runtime,
    transportConnection: connection,
    connection: runtime && runtime.state !== 'running' ? ('disconnected' as const) : connection,
  };
}
