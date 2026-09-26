import { opendir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ioDeadline } from './io-deadline.ts';

export type RolloutCandidate = { filename: string; mtime: number };
const METADATA_BATCH = 128;

async function eachLimited<T>(items: readonly T[], visit: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(16, items.length) }, async () => {
    while (next < items.length) await visit(items[next++]!);
  }));
}

// Every entry consumes budget, including irrelevant entries. Directory handles
// are retained only while traversing and are closed on completion or stop.
async function* archive(root: string, depth = 0): AsyncGenerator<string | null> {
  const directory = await ioDeadline(opendir(root), 1500, handle => { void handle.close().catch(() => {}); });
  try {
    while (true) {
      const entry = await ioDeadline(directory.read());
      if (!entry) break;
      const filename = path.join(root, entry.name);
      yield depth === 3 && entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name) ? filename : null;
      if (depth < 3 && entry.isDirectory() && !entry.isSymbolicLink()
        && (depth === 0 ? /^\d{4}$/ : /^\d{1,2}$/).test(entry.name)) {
        yield* archive(filename, depth + 1);
      }
    }
  } finally { await ioDeadline(directory.close()); }
}

export class RolloutDiscovery {
  private catalog = new Map<string, number>();
  private cursor: AsyncGenerator<string | null> | undefined;
  private recentOffset = 0;

  async close() {
    await this.cursor?.return(null);
    this.cursor = undefined;
  }

  async discover(root: string, recentDirectories: Set<string>, tracked: Set<string>, checkedAt: number) {
    let errors = 0;
    const recent: string[] = [];
    await eachLimited([...recentDirectories], async directory => {
      try {
        for (const entry of await ioDeadline(readdir(directory, { withFileTypes: true }))) {
          if (entry.isFile() && !entry.isSymbolicLink() && /^rollout-.*\.jsonl$/.test(entry.name))
            recent.push(path.join(directory, entry.name));
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors++;
      }
    });
    recent.sort();
    const refresh = new Set(tracked);
    for (let i = 0; i < Math.min(METADATA_BATCH, recent.length); i++)
      refresh.add(recent[(this.recentOffset + i) % recent.length]!);
    this.recentOffset = recent.length ? (this.recentOffset + METADATA_BATCH) % recent.length : 0;
    this.cursor ??= archive(root);
    try {
      for (let i = 0; i < METADATA_BATCH; i++) {
        const entry = await this.cursor.next();
        if (entry.done) { this.cursor = undefined; break; }
        if (entry.value) refresh.add(entry.value);
      }
    } catch (error) {
      this.cursor = undefined;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors++;
    }
    await eachLimited([...refresh], async filename => {
      try { this.catalog.set(filename, (await ioDeadline(stat(filename))).mtimeMs); }
      catch { this.catalog.delete(filename); if (!tracked.has(filename)) errors++; }
    });
    const catalog = [...this.catalog].map(([filename, mtime]) => ({ filename, mtime }))
      .sort((a, b) => b.mtime - a.mtime || a.filename.localeCompare(b.filename));
    let reactivated = 0;
    const candidates = catalog.filter(file => {
      if (recentDirectories.has(path.dirname(file.filename)) || tracked.has(file.filename)) return true;
      if (file.mtime >= checkedAt - 5 * 60_000) { reactivated++; return true; }
      return false;
    });
    return { catalog, candidates, errors, reactivated };
  }
}

export async function discoverRollouts(root: string, recentDirectories: Set<string>, tracked: Set<string>, checkedAt: number) {
  const discovery = new RolloutDiscovery();
  try { return await discovery.discover(root, recentDirectories, tracked, checkedAt); }
  finally { await discovery.close(); }
}
