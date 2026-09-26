import { useSyncExternalStore } from 'react';
import {
  ROOM_ACCENT_PREFIX,
  defaultRoomAccent,
  roomAccentKey,
  validRoomAccent,
  type RoomProject,
} from './room-accent.ts';

const changed = 'cheleby:room-accent';
// A denied/quota-limited store must not prevent changing the current view.
const temporary = new Map<string, string | null>();

function subscribe(callback: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(ROOM_ACCENT_PREFIX)) {
      if (event.key === null) temporary.clear();
      else temporary.delete(event.key);
      callback();
    }
  };
  window.addEventListener('storage', sync);
  window.addEventListener(changed, callback);
  return () => {
    window.removeEventListener('storage', sync);
    window.removeEventListener(changed, callback);
  };
}

function read(key: string | null) {
  if (!key) return null;
  if (temporary.has(key)) return temporary.get(key) ?? null;
  try {
    return validRoomAccent(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function useRoomAccent(project?: RoomProject) {
  const key = roomAccentKey(project);
  // The primitive snapshot stays equal across unrelated live-feed updates.
  const custom = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  function setAccent(value: string | null) {
    if (!key || (value !== null && !validRoomAccent(value))) return;
    let saved = true;
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      temporary.delete(key);
    } catch {
      temporary.set(key, value);
      saved = false;
    }
    window.dispatchEvent(new Event(changed));
    return saved;
  }
  return { color: custom ?? defaultRoomAccent(project), custom, setAccent };
}
