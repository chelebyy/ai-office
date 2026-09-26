export const ROOM_ORDER_KEY = 'cheleby.room-order';

export function readRoomOrder(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ROOM_ORDER_KEY) ?? '[]');
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter((key): key is string => typeof key === 'string' && key.length < 250),
          ),
        ].slice(0, 500)
      : [];
  } catch {
    return [];
  }
}

/** Preserve hidden rooms and their relative order while moving one visible room. */
export function moveRoom(
  order: string[],
  available: string[],
  source: string,
  target: string,
  after: boolean,
): string[] {
  const keys = [...new Set([...order, ...available])];
  if (source === target || !available.includes(source) || !available.includes(target)) return keys;
  const next = keys.filter((key) => key !== source);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, source);
  return next.slice(0, 500);
}
