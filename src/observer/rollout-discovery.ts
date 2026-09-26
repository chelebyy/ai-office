import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ioDeadline } from './io-deadline.ts';

export type RolloutCandidate = { filename: string; mtime: number };

// One shared cap per phase, including files spread across many small date folders.
// Per-directory batches serialize their latency even when most workers are idle.
async function eachLimited<T>(
  items: readonly T[],
  visit: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(16, items.length) }, async () => {
      while (next < items.length) await visit(items[next++]!);
    }),
  );
}

// Discovery reads directory entries and file metadata only. It never opens old transcripts.
// The reader retains its own file/history budgets after this candidate filter.
export async function discoverRollouts(
  root: string,
  recentDirectories: Set<string>,
  tracked: Set<string>,
  checkedAt: number,
): Promise<{
  catalog: RolloutCandidate[];
  candidates: RolloutCandidate[];
  errors: number;
  reactivated: number;
}> {
  const dates = new Set(recentDirectories);
  let errors = 0;
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth === 3) {
      dates.add(directory);
      return;
    }
    let entries;
    try {
      entries = await ioDeadline(readdir(directory, { withFileTypes: true }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors++;
      return;
    }
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        (depth === 0 ? /^\d{4}$/ : /^\d{1,2}$/).test(entry.name)
      ) {
        await visit(path.join(directory, entry.name), depth + 1);
      }
    }
  };
  await visit(root, 0);
  const filenames: string[] = [];
  await eachLimited([...dates], async (directory) => {
    let entries;
    try {
      entries = await ioDeadline(readdir(directory, { withFileTypes: true }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors++;
      return;
    }
    for (const entry of entries) {
      if (entry.isFile() && !entry.isSymbolicLink() && /^rollout-.*\.jsonl$/.test(entry.name)) {
        filenames.push(path.join(directory, entry.name));
      }
    }
  });
  const catalog: RolloutCandidate[] = [];
  await eachLimited(filenames, async (filename) => {
    try {
      catalog.push({ filename, mtime: (await ioDeadline(stat(filename))).mtimeMs });
    } catch {
      errors++;
    }
  });
  // Tracked files survive crossing the creation-date window, including nonstandard test paths.
  const knownPaths = new Set(catalog.map((file) => file.filename));
  await eachLimited(
    [...tracked].filter((filename) => !knownPaths.has(filename)),
    async (filename) => {
      try {
        catalog.push({ filename, mtime: (await ioDeadline(stat(filename))).mtimeMs });
      } catch {
        /* Reader retains an unavailable view of a disappeared tracked record. */
      }
    },
  );
  catalog.sort((a, b) => b.mtime - a.mtime || a.filename.localeCompare(b.filename));
  // Small startup grace catches a just-resumed old session. File time is a discovery signal,
  // never proof of working state: only public lifecycle events can drive the office.
  const recentlyWritten = checkedAt - 5 * 60_000;
  let reactivated = 0;
  const candidates = catalog.filter((file) => {
    if (recentDirectories.has(path.dirname(file.filename)) || tracked.has(file.filename))
      return true;
    if (file.mtime >= recentlyWritten) {
      reactivated++;
      return true;
    }
    return false;
  });
  return { catalog, candidates, errors, reactivated };
}
