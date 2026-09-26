import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test(
  'real observer boots with public settings and serves only the synthetic profile',
  { timeout: 15000 },
  async () => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'ai-office-config-'));
    await mkdir(path.join(profile, 'sessions'));
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = (probe.address() as { port: number }).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/observer/main.ts'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AI_OFFICE_PORT: String(port),
        CHELEBY_PORT: 'invalid',
        AI_OFFICE_CODEX_HOME: profile,
        AI_OFFICE_TRACKING: 'stopped',
      },
    });
    let output = '';
    child.stdout.on('data', (value) => {
      output += value;
    });
    child.stderr.on('data', (value) => {
      output += value;
    });
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    try {
      const base = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        const health = await fetch(base + '/api/health').catch(() => null);
        if (health?.ok) {
          ready = true;
          break;
        }
        assert.equal(child.exitCode, null, output);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(ready, output);
      const page = await fetch(base);
      const cookie = page.headers.get('set-cookie')?.split(';')[0];
      assert.ok(cookie);
      const response = await fetch(base + '/api/snapshot', { headers: { cookie } });
      assert.equal(response.status, 200);
      const snapshot = await response.json();
      assert.equal(snapshot.runtime.state, 'stopped');
      assert.deepEqual(snapshot.sessions, []);
    } finally {
      child.kill();
      await exited;
      await rm(profile, { recursive: true, force: true });
    }
  },
);
