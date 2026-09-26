import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

test(
  'Linux launcher owns one server, recovers and stops without touching unrelated apps',
  {
    skip: process.platform !== 'linux',
    timeout: 90000,
  },
  async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'Cheleby Linux & Türkçe '));
    const port = await freePort();
    const scripts = path.join(root, 'scripts');
    const main = path.join(root, 'src/observer/main.ts');
    const vite = path.join(root, 'node_modules/vite/bin/vite.js');
    const tsx = path.join(root, 'node_modules/tsx');
    for (const dir of [scripts, path.dirname(main), path.dirname(vite), tsx])
      await mkdir(dir, { recursive: true });
    for (const file of ['office-runtime.mjs', 'start-office.sh', 'stop-office.sh'])
      await copyFile(path.join(repo, 'scripts', file), path.join(scripts, file));
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
    await writeFile(path.join(tsx, 'package.json'), '{"type":"module","exports":"./index.mjs"}');
    await writeFile(path.join(tsx, 'index.mjs'), '');
    await writeFile(vite, 'console.log("fixture build");');
    await writeFile(
      main,
      `import {createServer} from 'node:http';createServer((req,res)=>res.end(JSON.stringify({name:'cheleby-home',schemaVersion:1,processId:process.pid}))).listen(Number(process.env.CHELEBY_PORT),'127.0.0.1');`,
    );

    function run(action: string, targetPort = port, extra: string[] = []) {
      return new Promise<{ code: number | null; data: any; stderr: string }>((resolve, reject) => {
        const child = spawn(
          'sh',
          [
            path.join(scripts, 'start-office.sh'),
            '--action',
            action,
            '--port',
            String(targetPort),
            '--timeout',
            '5',
            ...extra,
          ],
          {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
              ...process.env,
              PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH,
            },
          },
        );
        let stdout = '',
          stderr = '';
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.once('error', reject);
        child.once('close', (code) => {
          try {
            resolve({ code, data: JSON.parse(stdout.trim().split('\n').at(-1) || '{}'), stderr });
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    const health = () =>
      fetch(`http://127.0.0.1:${port}/api/health`)
        .then((r) => r.json())
        .catch(() => null);
    async function waitFor(predicate: () => Promise<boolean>) {
      const until = Date.now() + 15000;
      while (Date.now() < until) {
        if (await predicate()) return;
        await pause(100);
      }
      assert.fail('Linux office lifecycle timed out');
    }
    t.after(async () => {
      await run('stop');
      const resolved = path.resolve(root);
      assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
      assert.ok(path.basename(resolved).startsWith('Cheleby Linux & '));
      await rm(root, { recursive: true, force: true });
    });

    await t.test('concurrent launches and warm reuse keep the same owned process', async () => {
      const results = await Promise.all([run('start'), run('start'), run('start')]);
      for (const result of results) assert.equal(result.code, 0, JSON.stringify(result));
      assert.equal(new Set(results.map((r) => r.data.processId)).size, 1);
      assert.equal(results.filter((r) => r.data.status === 'started').length, 1);
      assert.equal((await run('start')).data.status, 'reused');
    });
    await t.test('owned child crash recovers under the same supervisor', async () => {
      const previous = (await run('status')).data;
      assert.equal((await health()).processId, previous.processId);
      process.kill(previous.processId);
      const next = await run('start');
      assert.equal(next.code, 0, JSON.stringify(next));
      assert.equal(next.data.runId, previous.runId);
      assert.notEqual(next.data.processId, previous.processId);
    });
    await t.test('explicit stop prevents restart and permits a new generation', async () => {
      const previous = (await run('status')).data;
      assert.equal((await run('stop')).code, 0);
      await waitFor(async () => (await run('status')).data.phase === 'offline');
      assert.equal(await health(), null);
      assert.equal((await run('stop')).data.status, 'already-stopped');
      const next = await run('start');
      assert.equal(next.code, 0, JSON.stringify(next));
      assert.notEqual(next.data.runId, previous.runId);
      await run('stop');
      await waitFor(async () => (await run('status')).data.phase === 'offline');
    });
    await t.test('stop cancels an in-progress build', async () => {
      await writeFile(
        vite,
        `import {writeFileSync} from 'node:fs';writeFileSync('build-pid.txt',String(process.pid));setInterval(()=>{},1000);`,
      );
      const pending = run('start');
      await waitFor(async () =>
        readFile(path.join(root, 'build-pid.txt'))
          .then(() => true)
          .catch(() => false),
      );
      const pid = Number(await readFile(path.join(root, 'build-pid.txt'), 'utf8'));
      assert.equal((await run('stop')).code, 0);
      assert.equal((await pending).code, 1);
      assert.throws(() => process.kill(pid, 0));
      await waitFor(async () => (await run('status')).data.phase === 'offline');
      await writeFile(vite, '');
    });
    await t.test('foreign HTTP service is left intact', async () => {
      const foreign = createServer((_req, res) => res.end('another app'));
      await new Promise<void>((resolve) => foreign.listen(0, '127.0.0.1', resolve));
      const foreignPort = (foreign.address() as { port: number }).port;
      try {
        assert.equal((await run('start', foreignPort)).code, 1);
        assert.equal((await run('stop', foreignPort)).code, 1);
        assert.equal(
          await fetch(`http://127.0.0.1:${foreignPort}`).then((r) => r.text()),
          'another app',
        );
      } finally {
        await new Promise<void>((resolve) => foreign.close(() => resolve()));
      }
    });
    await t.test('invalid arguments and missing dependencies fail clearly', async () => {
      assert.equal((await run('start', 80)).code, 1);
      assert.equal((await run('start', port, ['--timeout', 'invalid'])).code, 1);
      await rm(vite);
      const result = await run('start');
      assert.equal(result.code, 1);
      assert.match(result.data.message, /npm ci/);
    });
  },
);
