import { useEffect, useRef, useState } from 'react';
import type { ObserverSnapshot } from '../shared/contract.ts';

export function useObserver(paused: boolean) {
  const [snapshot, setSnapshot] = useState<ObserverSnapshot | null>(null);
  const [connection, setConnection] = useState<'connected' | 'connecting' | 'disconnected'>(
    'connecting',
  );
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
    let failures = 0;
    const visible = () => {
      if (!document.hidden && !pausedRef.current && latest.current) setSnapshot(latest.current);
    };
    document.addEventListener('visibilitychange', visible);
    const apply = (data: unknown) => {
      const candidate = data as ObserverSnapshot;
      if (candidate?.schemaVersion !== 1 || !Array.isArray(candidate.sessions)) return;
      latest.current = candidate;
      if (!pausedRef.current && !document.hidden) setSnapshot(candidate);
    };
    const connect = async () => {
      if (disposed) return;
      try {
        const response = await fetch('/api/snapshot', { cache: 'no-store' });
        if (response.status === 401) await fetch('/', { cache: 'no-store' });
        else if (response.ok) apply(await response.json());
        if (disposed) return;
        socket = new WebSocket(
          `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/live`,
        );
        socket.onopen = () => {
          failures = 0;
          setConnection('connected');
        };
        socket.onmessage = (event) => {
          try {
            apply(JSON.parse(event.data));
          } catch {
            /* retain valid state */
          }
        };
        socket.onerror = () => socket?.close();
        socket.onclose = schedule;
      } catch {
        schedule();
      }
    };
    function schedule() {
      if (disposed) return;
      setConnection('disconnected');
      retry = setTimeout(
        () => {
          void connect();
        },
        Math.min(1000 * 2 ** failures++, 10000),
      );
    }
    void connect();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', visible);
      clearTimeout(retry);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);
  return { snapshot, connection };
}
