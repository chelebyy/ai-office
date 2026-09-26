import type { SessionView, ObserverSnapshot, ObservationEvent } from '../../shared/contract.ts';
import { STALE_AFTER_MS } from '../office/office-state.ts';
import type { CharacterId } from './scene-layout.ts';

export type Connection = 'connected' | 'connecting' | 'disconnected';
export type Freshness = 'preview' | 'paused' | 'offline' | 'unavailable' | 'stale' | 'current';
export function freshness(
  session: SessionView | undefined,
  connection: Connection,
  paused: boolean,
  now: number,
): Freshness {
  if (!session) return 'preview';
  if (paused) return 'paused';
  if (connection !== 'connected') return 'offline';
  if (!session.recordAvailable) return 'unavailable';
  const time = Date.parse(session.lastEventAt);
  if (!Number.isFinite(time)) return 'stale';
  // An observed unanswered question remains pending while its source is available.
  // Silence is normal while the user is considering the answer.
  // A dormant historic question is retained for the selected room, but must not
  // keep an old project in the live list indefinitely.
  if (session.pendingQuestions?.length && now - time <= 24 * 60 * 60 * 1000) return 'current';
  if (now - time > STALE_AFTER_MS) return 'stale';
  return 'current';
}
export function fixedOfficeState(snapshot: ObserverSnapshot | null, selectedId: string | null) {
  const sessions = snapshot?.sessions ?? [];
  const mains = sessions.filter((s) => s.agentKind === 'main');
  const selected = sessions.find((s) => s.id === selectedId);
  const root = selected
    ? selected.agentKind === 'main'
      ? selected
      : selected.agentKind === 'subagent' && selected.parentResolved
        ? mains.find((s) => s.id === selected.rootId)
        : undefined
    : selectedId
      ? undefined
      : mains[0];
  const team = root
    ? sessions
        .filter((s) => s.agentKind === 'subagent' && s.parentResolved && s.rootId === root.id)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id))
    : [];
  const actors: Record<CharacterId, SessionView | undefined> = {
    main: root,
    blue: team[0],
    green: team[1],
    purple: team[2],
  };
  const members = root ? [root, ...team] : [];
  const events = members
    .flatMap((session) => session.events.map((event) => ({ session, event })))
    .sort(
      (a, b) =>
        b.event.occurredAt.localeCompare(a.event.occurredAt) ||
        b.event.id.localeCompare(a.event.id),
    );
  const counts = members.reduce(
    (sum, s) => ({
      turns: sum.turns + s.counts.turns,
      starts: sum.starts + s.counts.toolStarts,
      results: sum.results + s.counts.toolCompletions,
      events: sum.events + s.events.length,
    }),
    { turns: 0, starts: 0, results: 0, events: 0 },
  );
  return { root, mains, team, actors, members, events, counts };
}
export function sessionName(session: SessionView | undefined, fallback: string) {
  if (session?.agentKind === 'main') return 'Cheleby';
  return session?.agentName?.trim() || session?.agentTask?.trim() || fallback;
}
export function latestMessage(session?: SessionView) {
  return session?.events.findLast((e) => e.kind === 'assistant_message' && e.text)?.text;
}
export function lastTool(session?: SessionView) {
  return session?.currentTool ?? session?.events.findLast((e) => e.toolName)?.toolName;
}
export function safeTime(value: string | null | undefined, locale: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}
export function toolEvents(events: ObservationEvent[]) {
  return events.filter((e) => e.kind === 'tool_started' || e.kind === 'tool_completed').slice(-8);
}
export function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferences remain in memory when storage is unavailable. */
  }
}
