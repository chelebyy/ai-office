// A project keeps its accent across activity changes, room order and reloads.
const accents = ['#79d9c2', '#8bbfff', '#8ed8f8', '#e8c17e', '#72c7e8', '#9bd48c'];

export function projectColor(identity: string) {
  let hash = 2166136261;
  for (const character of identity.normalize('NFKC').trim().toLowerCase()) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return accents[(hash >>> 0) % accents.length];
}
