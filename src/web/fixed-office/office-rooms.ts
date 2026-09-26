import type { ObserverSnapshot, SessionView } from '../../shared/contract.ts';
import { freshness, type Connection, type Freshness } from './fixed-state.ts';

export type OfficeCard = {
  session: SessionView;
  state: SessionView['status'] | Freshness;
  updatedAt: string;
};

export function officeRooms(
  snapshot: ObserverSnapshot | null,
  connection: Connection,
  paused: boolean,
  now: number,
): OfficeCard[] {
  const sessions = snapshot?.sessions ?? [];
  const cards = sessions
    .filter((s) => s.agentKind === 'main')
    .map((session) => {
      const members = sessions.filter(
        (s) =>
          s.id === session.id ||
          (s.agentKind === 'subagent' && s.parentResolved && s.rootId === session.id),
      );
      const fresh = members.filter((s) => freshness(s, connection, paused, now) === 'current');
      const rootFreshness = freshness(session, connection, paused, now);
      const state = fresh.some((s) => s.pendingQuestions?.length)
        ? 'waiting'
        : fresh.some((s) => s.status === 'working')
          ? 'working'
          : fresh.some((s) => s.status === 'waiting')
            ? 'waiting'
            : rootFreshness === 'current'
              ? session.status
              : rootFreshness;
      const updatedAt = members.reduce(
        (latest, s) => (s.lastEventAt > latest ? s.lastEventAt : latest),
        session.lastEventAt,
      );
      return { session, state, updatedAt };
    });
  return cards.sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.session.id.localeCompare(b.session.id),
  );
}

export type ProjectGroup = {
  key: string;
  name: string;
  rooms: OfficeCard[];
  working: number;
  waiting: number;
};

export function projectGroups(
  snapshot: ObserverSnapshot | null,
  connection: Connection,
  paused: boolean,
  now: number,
): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();
  for (const room of officeRooms(snapshot, connection, paused, now)) {
    const key = room.session.projectKey
      ? 'cwd:' + room.session.projectKey
      : 'legacy:' + room.session.project;
    let project = groups.get(key);
    if (!project) {
      project = { key, name: room.session.project, rooms: [], working: 0, waiting: 0 };
      groups.set(key, project);
    }
    project.rooms.push(room);
    if (room.state === 'working') project.working++;
    if (room.state === 'waiting') project.waiting++;
  }
  // Live activity never reorders project headings or changes the selected room.
  return [...groups.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key),
  );
}

export function liveProjectGroups(
  snapshot: ObserverSnapshot | null,
  selectedRootId: string | undefined,
  connection: Connection,
  paused: boolean,
  now: number,
): ProjectGroup[] {
  return projectGroups(snapshot, connection, paused, now)
    .map((project) => ({
      ...project,
      rooms: project.rooms.filter(
        (room) =>
          room.session.id === selectedRootId ||
          room.state === 'working' ||
          room.state === 'waiting',
      ),
    }))
    .filter((project) => project.rooms.length);
}

export function sessionTitle(session: SessionView, fallback: string): string {
  return session.title?.trim() || fallback + ' · ' + session.id.slice(-8);
}

// Compact selector used by the earlier card view.
export function officeCards(
  snapshot: ObserverSnapshot | null,
  selectedRootId: string | undefined,
  connection: Connection,
  paused: boolean,
  now: number,
): OfficeCard[] {
  const priority = (room: OfficeCard) =>
    room.session.id === selectedRootId
      ? 0
      : room.state === 'working'
        ? 1
        : room.state === 'waiting'
          ? 2
          : 3;
  return officeRooms(snapshot, connection, paused, now)
    .sort(
      (a, b) =>
        priority(a) - priority(b) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.session.id.localeCompare(b.session.id),
    )
    .slice(0, 5);
}
