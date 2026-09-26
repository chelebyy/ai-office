import type { SessionView } from '../../shared/contract.ts';
import { projectColor } from './project-color.ts';

export const ROOM_ACCENT_PREFIX = 'cheleby.room-accent.v1:';
export const ROOM_ACCENTS = [
  { color: '#79d9c2', tr: 'Nane', en: 'Mint' },
  { color: '#8bbfff', tr: 'Mavi', en: 'Blue' },
  { color: '#8ed8f8', tr: 'Buz', en: 'Ice' },
  { color: '#e8c17e', tr: 'Kehribar', en: 'Amber' },
  { color: '#72c7e8', tr: 'Turkuaz', en: 'Cyan' },
  { color: '#9bd48c', tr: 'Adaçayı', en: 'Sage' },
] as const;

export type RoomProject = Pick<SessionView, 'project' | 'projectKey'>;

// Match the Rooms grouping: paths distinguish projects with identical names.
export function roomAccentKey(project?: RoomProject) {
  if (!project) return null;
  const identity = project.projectKey ? `cwd:${project.projectKey}` : `legacy:${project.project}`;
  return ROOM_ACCENT_PREFIX + encodeURIComponent(identity);
}

export function validRoomAccent(value: string | null): string | null {
  return ROOM_ACCENTS.some((entry) => entry.color === value) ? value : null;
}

export function defaultRoomAccent(project?: RoomProject) {
  return projectColor(project?.projectKey ?? project?.project ?? 'office');
}
