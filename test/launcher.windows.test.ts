import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const powershell = path.join(
  process.env.SystemRoot ?? 'C:/Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function run(script: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(
      powershell,
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH,
        },
      },
    );
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

async function portNumber() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

test(
  'Windows launcher handles duplicate clicks and startup failures without touching other apps',
  {
    skip: process.platform !== 'win32',
    timeout: 120_000,
  },
  async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'Cheleby launcher & '));
    const scripts = path.join(root, 'scripts');
    const main = path.join(root, 'src/observer/main.ts');
    const vite = path.join(root, 'node_modules/vite/bin/vite.js');
    const tsx = path.join(root, 'node_modules/tsx');
    for (const dir of [scripts, path.dirname(main), path.dirname(vite), tsx])
      await mkdir(dir, { recursive: true });
    const launcher = path.join(scripts, 'start-office.ps1');
    await copyFile(path.join(repo, 'scripts/start-office.ps1'), launcher);
    await copyFile(
      path.join(repo, 'scripts/office-runtime.mjs'),
      path.join(scripts, 'office-runtime.mjs'),
    );
    await copyFile(
      path.join(repo, 'scripts/stop-office.ps1'),
      path.join(scripts, 'stop-office.ps1'),
    );
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
    await writeFile(path.join(tsx, 'package.json'), '{"type":"module","exports":"./index.mjs"}');
    await writeFile(path.join(tsx, 'index.mjs'), '');
    // Isolated local stand-ins exercise real Windows process/mutex semantics,
    // without reading Codex data, rebuilding the user's app or opening browsers.
    await writeFile(vite, 'console.error("A harmless build warning");');
    const port = await portNumber();
    let ownedPid: number | undefined;
    let unrelated: ReturnType<typeof createServer> | undefined;
    const stop = () => run(path.join(scripts, 'stop-office.ps1'), ['-Port', String(port), '-Json']);
    const status = async () => {
      const result = await run(launcher, [
        '-Action',
        'status',
        '-Port',
        String(port),
        '-NoBrowser',
        '-Json',
      ]);
      return JSON.parse(result.stdout);
    };
    const waitFor = async (predicate: () => Promise<boolean>, timeout = 15000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) {
        if (await predicate()) return;
        await pause(100);
      }
      assert.fail('Timed out waiting for the owned office lifecycle');
    };
    const currentHealth = () =>
      fetch(`http://127.0.0.1:${port}/api/health`)
        .then((r) => r.json())
        .catch(() => null);
    t.after(async () => {
      if (unrelated) await new Promise<void>((resolve) => unrelated!.close(() => resolve()));
      await run(launcher, ['-Action', 'stop', '-Port', String(port), '-NoBrowser', '-Json']);
      const resolved = path.resolve(root);
      assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
      assert.ok(path.basename(resolved).startsWith('Cheleby launcher & '));
      await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    });
    const invoke = async (targetPort = port) => {
      const result = await run(launcher, [
        '-Port',
        String(targetPort),
        '-NoBrowser',
        '-Json',
        '-StartupTimeoutSeconds',
        '5',
      ]);
      const line = result.stdout
        .trim()
        .split(/\r?\n/)
        .findLast((line) => line.startsWith('{'));
      assert.ok(line, `Expected launcher JSON: ${result.stderr}\n${result.stdout}`);
      return { ...result, data: JSON.parse(line) };
    };
    await writeFile(
      main,
      `import { createServer } from 'node:http';
createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({name:'cheleby-home',schemaVersion:1,processId:process.pid}));}).listen(Number(process.env.CHELEBY_PORT),'127.0.0.1');`,
    );

    await t.test(
      'concurrent cold clicks create one server; warm click reuses it despite spaces and & in path',
      async () => {
        const results = await Promise.all([invoke(), invoke(), invoke()]);
        ownedPid = results.find((r) => r.data.status === 'started')?.data.processId;
        for (const result of results) assert.equal(result.code, 0, result.stderr + result.stdout);
        assert.equal(results.filter((r) => r.data.status === 'started').length, 1);
        assert.equal(results.filter((r) => r.data.status === 'reused').length, 2);
        ownedPid = results.find((r) => r.data.status === 'started')!.data.processId;
        const warm = await invoke();
        assert.equal(warm.data.status, 'reused');
        const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.json());
        assert.equal(health.processId, ownedPid);
      },
    );
    await t.test(
      'crash recovers the owned server; clicks during recovery reuse the supervisor',
      async () => {
        const previous = await status();
        assert.equal(previous.phase, 'running');
        const health = await currentHealth();
        assert.equal(health.processId, ownedPid);
        process.kill(health.processId);
        const results = await Promise.all([invoke(), invoke()]);
        for (const result of results) {
          assert.equal(result.code, 0, result.stdout);
          assert.equal(result.data.status, 'reused');
          assert.equal(result.data.supervisorId, previous.supervisorId);
          assert.equal(result.data.runId, previous.runId);
        }
        ownedPid = results[0].data.processId;
        assert.notEqual(ownedPid, previous.processId);
        assert.equal((await status()).retries, 1);
      },
    );
    await t.test(
      'explicit stop during backoff cancels restart and a new click starts a new generation',
      async () => {
        const previous = await status();
        assert.equal((await currentHealth()).processId, previous.processId);
        process.kill(previous.processId);
        await waitFor(async () => (await status()).phase === 'restarting');
        const result = await stop();
        assert.equal(result.code, 0, result.stdout + result.stderr);
        await pause(3300);
        assert.equal(await currentHealth(), null);
        assert.equal((await status()).phase, 'offline');
        assert.equal(JSON.parse((await stop()).stdout).status, 'already-stopped');
        const next = await invoke();
        assert.equal(next.code, 0, next.stdout);
        assert.notEqual(next.data.runId, previous.runId);
        ownedPid = next.data.processId;
      },
    );
    await t.test(
      'four short-lived crashes exhaust three retries instead of looping forever',
      async () => {
        const initial = await status();
        for (let i = 0; i < 4; i++) {
          await waitFor(async () => (await status()).phase === 'running');
          const live = await currentHealth();
          assert.equal(live.processId, ownedPid);
          process.kill(live.processId);
          if (i < 3) {
            await waitFor(async () => {
              const next = await currentHealth();
              if (!next || next.processId === live.processId) return false;
              ownedPid = next.processId;
              return true;
            });
          } else await waitFor(async () => (await status()).phase === 'offline');
        }
        await pause(1200);
        assert.equal(await currentHealth(), null);
        const events = (
          await readFile(
            path.join(root, '.local/launcher', initial.runId + '-supervisor.log'),
            'utf8',
          )
        )
          .trim()
          .split(/\r?\n/)
          .map((line) => JSON.parse(line));
        assert.equal(events.filter((e) => e.event === 'running').length, 4);
        assert.equal(events.filter((e) => e.event === 'restarting').length, 3);
        assert.equal(events.at(-1).phase, 'failed');
      },
    );
    await t.test('stop cancels preparation without waiting for the start mutex', async () => {
      await writeFile(
        vite,
        `import {writeFileSync} from 'node:fs';writeFileSync('build-pid.txt',String(process.pid));setInterval(()=>{},1000);`,
      );
      const pending = invoke();
      await waitFor(async () =>
        readFile(path.join(root, 'build-pid.txt'), 'utf8')
          .then(() => true)
          .catch(() => false),
      );
      const buildPid = Number(await readFile(path.join(root, 'build-pid.txt'), 'utf8'));
      assert.equal((await stop()).code, 0);
      assert.equal((await pending).code, 1);
      assert.throws(() => process.kill(buildPid, 0));
      await waitFor(async () => (await status()).phase === 'offline');
      assert.equal(await currentHealth(), null);
      await writeFile(vite, 'console.error("A harmless build warning");');
      const next = await invoke();
      assert.equal(next.code, 0, next.stdout);
      ownedPid = next.data.processId;
      assert.equal((await stop()).code, 0);
      await waitFor(async () => (await status()).phase === 'offline');
      assert.equal(await currentHealth(), null);
    });
    await t.test('an occupied or nonresponsive port is left alone', async () => {
      unrelated = createServer((_req, res) => {
        res.end('{"name":"different-app"}');
      });
      await new Promise<void>((resolve) => unrelated!.listen(0, '127.0.0.1', resolve));
      const foreignPort = (unrelated.address() as { port: number }).port;
      assert.equal((await invoke(foreignPort)).code, 1);
      assert.equal(
        (
          await run(launcher, [
            '-Action',
            'stop',
            '-Port',
            String(foreignPort),
            '-NoBrowser',
            '-Json',
          ])
        ).code,
        1,
      );
      assert.equal(
        await fetch(`http://127.0.0.1:${foreignPort}`).then((r) => r.text()),
        '{"name":"different-app"}',
      );
      await new Promise<void>((resolve) => unrelated!.close(() => resolve()));
      unrelated = createServer(() => {});
      await new Promise<void>((resolve) => unrelated!.listen(0, '127.0.0.1', resolve));
      const silentPort = (unrelated.address() as { port: number }).port;
      assert.equal((await invoke(silentPort)).code, 1);
      assert.equal(unrelated.listening, true);
      unrelated.closeAllConnections();
      await new Promise<void>((resolve) => unrelated!.close(() => resolve()));
      unrelated = undefined;
    });
    await t.test('build failure reports its log without starting a server', async () => {
      await writeFile(vite, 'process.exit(9)');
      const failed = await invoke(await portNumber());
      assert.equal(failed.code, 1);
      assert.match(failed.data.message, /build-error\.log/);
    });
    await t.test('early server exit and readiness timeout are bounded', async () => {
      await writeFile(vite, '');
      await writeFile(main, 'process.exit(23)');
      assert.equal((await invoke(await portNumber())).code, 1);
      await writeFile(
        main,
        `import {writeFileSync} from 'node:fs';writeFileSync('owned-pid.txt',String(process.pid));setInterval(()=>{},1000);`,
      );
      const failed = await invoke(await portNumber());
      assert.equal(failed.code, 1);
      assert.match(failed.data.message, /zamaninda/);
      const timedOutPid = Number(await readFile(path.join(root, 'owned-pid.txt'), 'utf8'));
      assert.throws(
        () => process.kill(timedOutPid, 0),
        'Only the newly-created timed-out server is stopped',
      );
    });
    await t.test(
      'shortcut installation is repeatable and targets the hidden launcher',
      async () => {
        const destination = path.join(root, 'shortcut destination');
        await mkdir(destination);
        const installer = path.join(repo, 'scripts/install-office-shortcut.ps1');
        const first = await run(installer, ['-Destination', destination]);
        const second = await run(installer, ['-Destination', destination]);
        assert.equal(first.code, 0, first.stderr);
        assert.equal(second.code, 0, second.stderr);
        assert.equal(first.stdout.trim(), second.stdout.trim());
        assert.ok((await readFile(first.stdout.trim())).length > 0);
        const inspect = path.join(scripts, 'inspect-shortcut.ps1');
        await writeFile(
          inspect,
          `param([string]$LinkPath)
+$s = (New-Object -ComObject WScript.Shell).CreateShortcut($LinkPath)
+[ordered]@{target=$s.TargetPath;arguments=$s.Arguments;directory=$s.WorkingDirectory} | ConvertTo-Json -Compress`.replace(
            /^\+/gm,
            '',
          ),
        );
        const inspected = await run(inspect, ['-LinkPath', first.stdout.trim()]);
        assert.equal(inspected.code, 0, inspected.stderr);
        const link = JSON.parse(inspected.stdout);
        assert.equal(
          path.resolve(link.target).toLowerCase(),
          path.resolve(powershell).toLowerCase(),
        );
        assert.ok(link.arguments.includes('-WindowStyle Hidden'));
        assert.ok(link.arguments.includes(path.join(repo, 'scripts/start-office.ps1')));
        assert.equal(path.resolve(link.directory), path.resolve(repo));
        const stopLink = await run(installer, ['-Destination', destination, '-Stop']);
        const stopLinkAgain = await run(installer, ['-Destination', destination, '-Stop']);
        assert.equal(stopLink.code, 0, stopLink.stderr);
        assert.equal(stopLink.stdout, stopLinkAgain.stdout);
        const stopInspected = JSON.parse((await run(inspect, ['-LinkPath', stopLink.stdout.trim()])).stdout);
        assert.ok(stopInspected.arguments.includes(path.join(repo, 'scripts/stop-office.ps1')));
        assert.ok(stopInspected.arguments.includes('-WindowStyle Hidden'));
      },
    );
    await t.test('missing dependencies explain the required setup', async () => {
      await rm(vite);
      const failed = await invoke(await portNumber());
      assert.equal(failed.code, 1);
      assert.match(failed.data.message, /npm ci/);
    });
  },
);
