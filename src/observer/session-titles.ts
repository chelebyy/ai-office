import { open } from 'node:fs/promises';
import path from 'node:path';
import { publicText } from './parser.ts';

// This optional public index contains names, not event or execution state.
export class SessionTitles {
  private signature = '';
  private names = new Map<string, string>();
  constructor(private codexHome: string) {}

  get(id: string): string | null { return this.names.get(id) ?? null; }

  async refresh(): Promise<void> {
    let handle;
    try {
      handle = await open(path.join(this.codexHome, 'session_index.jsonl'), 'r');
      const info = await handle.stat();
      const signature = `${info.ino}:${info.size}:${info.mtimeMs}`;
      if (signature === this.signature) return;
      const start = Math.max(0, info.size - 4 * 1024 * 1024);
      const buffer = Buffer.alloc(info.size - start);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, start + offset);
        if (!bytesRead) break;
        offset += bytesRead;
      }
      const text = buffer.subarray(0, offset).toString('utf8');
      const lines = text.split('\n');
      if (start > 0) lines.shift();
      if (!text.endsWith('\n')) lines.pop(); // Wait for a complete appended name.
      const latest = new Map<string, { title: string; at: number }>();
      for (const line of lines) {
        try {
          const row = JSON.parse(line.replace(/^\uFEFF/, ''));
          if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(row.id)
            || typeof row.thread_name !== 'string' || typeof row.updated_at !== 'string') continue;
          const at = Date.parse(row.updated_at);
          if (!Number.isFinite(at)) continue;
          const title = publicText(row.thread_name, 240).replace(/\s+/g, ' ').trim();
          if (at >= (latest.get(row.id)?.at ?? -Infinity)) latest.set(row.id, { title, at });
        } catch { /* A damaged optional title must not stop observing events. */ }
      }
      this.names = new Map([...latest].map(([id, value]) => [id, value.title]));
      this.signature = signature;
    } catch {
      this.names.clear(); this.signature = '';
    } finally { await handle?.close(); }
  }
}
