import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

export const NOW = '2026-09-11T18:00:00.000Z';
export const row = (type: string, payload: Record<string, unknown>, timestamp = NOW) => ({ type, payload, timestamp });
export const metadata = (id = 'main-1', extra: Record<string, unknown> = {}) => row('session_meta', {
  id, timestamp: NOW, cwd: '/workspace/Example', originator: 'Codex Desktop', source: 'vscode', cli_version: '0.153.4', ...extra,
});
export const event = (type: string, extra: Record<string,unknown> = {}, timestamp = NOW) => row('event_msg', { type, ...extra }, timestamp);
export const jsonl = (...rows: unknown[]) => rows.map(value => JSON.stringify(value) + '\n').join('');

export async function temporarySource() {
  const parent = path.resolve('.cache/tests');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'cheleby-test-'));
  const day = path.join(root, 'sessions', '2026', '09', '11');
  await mkdir(day, { recursive: true });
  return {
    root, day,
    async record(name: string, content: string) {
      const filename = path.join(day, `rollout-${name}.jsonl`);
      await writeFile(filename, content); return filename;
    },
    async cleanup() {
      assert.equal(path.dirname(path.resolve(root)), parent);
      assert.ok(path.basename(root).startsWith('cheleby-test-'));
      await rm(root, { recursive: true });
    },
  };
}
