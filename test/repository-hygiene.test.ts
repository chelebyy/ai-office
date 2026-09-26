import test from 'node:test';
import assert from 'node:assert/strict';
// The standalone guard also runs before TypeScript and does not require tsx.
// @ts-expect-error JavaScript CLI deliberately has no generated declaration file.
import { inspectFile } from '../scripts/repository-hygiene.mjs';

test('repository guard rejects private artifacts and credentials without echoing values', () => {
  const secret = ['ghp', '_', 'a'.repeat(36)].join('');
  assert.deepEqual(inspectFile('src/example.ts', Buffer.from(secret)), ['possible credential']);
  assert.deepEqual(inspectFile('.env', Buffer.from('')), ['credential file']);
  assert.deepEqual(inspectFile('.local/report.json', Buffer.from('{}')), [
    'private development artifact',
  ]);
});

test('repository guard sees personal paths in binary metadata and accepts documented placeholders', () => {
  const privatePath = ['C:', 'Users', 'example-user', 'project'].join(String.fromCharCode(92));
  assert.deepEqual(inspectFile('image.png', Buffer.from('\0tEXt\0' + privatePath)), [
    'personal absolute path',
  ]);
  assert.deepEqual(inspectFile('README.md', Buffer.from('/mnt/c/Users/<windows-user>/.codex')), []);
  assert.deepEqual(inspectFile('src/config.ts', Buffer.from('process.env.AI_OFFICE_PORT')), []);
});
