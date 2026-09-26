import type { SessionView } from '../../shared/contract.ts';

/** Keep event receipts, question state and identity scoped to their originating session. */
export function roomFeed(root: SessionView | undefined, members: SessionView[] = []) {
  if (!root) return [];
  const sessions = new Map([[root.id, root]]);
  for (const member of members)
    if (member.agentKind === 'subagent' && member.parentResolved && member.rootId === root.id)
      sessions.set(member.id, member);
  return [...sessions.values()]
    .flatMap((session) => {
      const completed = new Set(
        session.events.filter((e) => e.kind === 'tool_completed').map((e) => e.callId),
      );
      const pending = new Set(session.pendingQuestions?.map((q) => q.id));
      return session.events
        .filter((e) =>
          [
            'assistant_message',
            'tool_started',
            'waiting',
            'turn_completed',
            'turn_aborted',
          ].includes(e.kind),
        )
        .map((event) => ({
          ...event,
          session,
          key: JSON.stringify([session.id, event.id]),
          returned: !!event.callId && completed.has(event.callId),
          pending,
        }));
    })
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.key.localeCompare(b.key))
    .slice(-80);
}
