import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createServer, createConnection } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This control channel is local IPC, separate from the read-only office HTTP API.
const script = fileURLToPath(import.meta.url);
const repo = path.dirname(path.dirname(script));
const [action, portText, timeoutText = '45', requestedRunId] = process.argv.slice(2);
const port = Number(portText);
const startupMs = Number(timeoutText) * 1000;
const userKey = createHash('sha256')
  .update(os.userInfo().username + os.homedir())
  .digest('hex')
  .slice(0, 24);
const pipe =
  process.platform === 'linux'
    ? `\0cheleby-home-${userKey}-${port}`
    : `\\\\.\\pipe\\cheleby-home-${userKey}-${port}`;
let controlToken;
const url = `http://127.0.0.1:${port}`;
const logDirectory = path.join(repo, '.local', 'launcher');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Abstract Linux sockets disappear when their process exits. A private token
// authenticates this channel because abstract sockets have no file permissions.
async function linuxControlToken() {
  const directory = path.join(os.tmpdir(), `cheleby-home-${process.getuid()}`);
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.uid !== process.getuid() || info.mode & 0o077)
    throw new Error('Ofis yonetim dizini bu kullaniciya ozel olmali.');
  const tokenFile = path.join(directory, 'launcher-token');
  try {
    writeFileSync(tokenFile, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const tokenInfo = lstatSync(tokenFile);
    if (!tokenInfo.isFile() || tokenInfo.uid !== process.getuid() || tokenInfo.mode & 0o077)
      throw new Error('Ofis yonetim anahtari bu kullaniciya ozel olmali.');
    const token = readFileSync(tokenFile, 'utf8');
    if (/^[a-f0-9]{64}$/.test(token)) return token;
    // Another simultaneous launch may have created the file but not written it.
    if (token.length !== 0) break;
    await pause(25);
  }
  throw new Error('Gecersiz ofis yonetim anahtari.');
}

function control(command = 'status', runId) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(pipe);
    let data = '';
    socket.setEncoding('utf8');
    socket.setTimeout(command === 'stop' ? 10000 : 2000, () =>
      socket.destroy(new Error('Ofis yoneticisi yanit vermedi.')),
    );
    socket.on('connect', () =>
      socket.write(JSON.stringify({ command, runId, token: controlToken }) + '\n'),
    );
    socket.on('data', (chunk) => {
      data += chunk;
      if (data.length > 8192) socket.destroy(new Error('Gecersiz yonetici yaniti.'));
      else if (data.includes('\n')) {
        try {
          resolve(JSON.parse(data.split('\n')[0]));
        } catch (error) {
          reject(error);
        }
        socket.destroy();
      }
    });
    socket.on('error', (error) => {
      if (['ENOENT', 'ECONNREFUSED'].includes(error.code)) resolve(null);
      else reject(error);
    });
    socket.on('end', () => {
      if (!data.includes('\n')) reject(new Error('Ofis yoneticisi baglantiyi kapatti.'));
    });
  });
}

async function health() {
  try {
    const response = await fetch(url + '/api/health', {
      signal: AbortSignal.timeout(2000),
      redirect: 'error',
    });
    // Bound the response even if another local app occupies this port.
    const reader = response.body?.getReader();
    if (!response.ok || !reader) return { state: 'occupied' };
    let text = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += Buffer.from(value).toString();
        if (text.length > 8192) return { state: 'occupied' };
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const body = JSON.parse(text);
    return body.name === 'cheleby-home' && body.schemaVersion === 1
      ? { state: 'office', processId: body.processId }
      : { state: 'occupied' };
  } catch (error) {
    return { state: error.cause?.code === 'ECONNREFUSED' ? 'offline' : 'occupied' };
  }
}

async function supervise(runId) {
  let child = null,
    childDone = Promise.resolve(),
    stopping = false;
  let trackingEnabled = true;
  let state = {
    runId,
    supervisorId: process.pid,
    processId: null,
    phase: 'preparing',
    retries: 0,
    trackingEnabled,
  };
  const log = (event, detail = {}) =>
    console.log(JSON.stringify({ at: new Date().toISOString(), event, ...detail }));
  const update = (change) => {
    state = { ...state, ...change };
    log(state.phase, state);
  };
  const stopChild = async () => {
    // Retained ChildProcess only: never trust or kill a PID read from disk/IPC.
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    await childDone;
  };
  const stop = async () => {
    stopping = true;
    update({ phase: 'stopping' });
    await stopChild();
  };
  const server = createServer((socket) => {
    let input = '',
      handled = false;
    socket.setEncoding('utf8');
    socket.setTimeout(2000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('data', async (chunk) => {
      if (handled) return;
      input += chunk;
      if (input.length > 8192) {
        socket.destroy();
        return;
      }
      if (!input.includes('\n')) return;
      handled = true;
      try {
        const request = JSON.parse(input.split('\n')[0]);
        if (controlToken && request.token !== controlToken) {
          socket.destroy();
          return;
        }
        if (request.command === 'status') socket.end(JSON.stringify(state) + '\n');
        else if (request.command === 'stop' && request.runId === runId) {
          socket.setTimeout(10000);
          await stop();
          socket.end(JSON.stringify({ ...state, phase: 'stopped' }) + '\n');
        } else
          socket.end(JSON.stringify({ error: 'Gecersiz komut veya eski acilis kimligi.' }) + '\n');
      } catch {
        socket.destroy();
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(pipe, resolve);
  });
  const signalStop = () => {
    void stop();
  };
  process.on('SIGINT', signalStop);
  process.on('SIGTERM', signalStop);

  function launch(args, label, timeout = 0) {
    const stdout = openSync(path.join(logDirectory, `${runId}-${label}.log`), 'a');
    const stderr = openSync(path.join(logDirectory, `${runId}-${label}-error.log`), 'a');
    let owned;
    try {
      owned = spawn(process.execPath, args, {
        cwd: repo,
        windowsHide: true,
        env: {
          ...process.env,
          AI_OFFICE_PORT: String(port),
          AI_OFFICE_TRACKING: trackingEnabled ? 'running' : 'stopped',
          // Keep older observer versions and existing managed instances compatible.
          CHELEBY_PORT: String(port),
          CHELEBY_TRACKING: trackingEnabled ? 'running' : 'stopped',
        },
        stdio: label === 'server' ? ['ignore', stdout, stderr, 'ipc'] : ['ignore', stdout, stderr],
      });
    } finally {
      closeSync(stdout);
      closeSync(stderr);
    }
    child = owned;
    if (label === 'server')
      owned.on('message', (message) => {
        if (
          owned !== child ||
          message?.type !== 'office-tracking' ||
          typeof message.enabled !== 'boolean' ||
          typeof message.id !== 'string' ||
          message.id.length > 100
        )
          return;
        trackingEnabled = message.enabled;
        state = { ...state, trackingEnabled };
        log('tracking', { enabled: trackingEnabled });
        if (owned.connected) owned.send({ type: 'office-tracking-ack', id: message.id }, () => {});
      });
    let ended = false,
      timedOut = false;
    const startedAt = Date.now();
    childDone = new Promise((resolve) => {
      const timer = timeout
        ? setTimeout(() => {
            timedOut = true;
            owned.kill();
          }, timeout)
        : null;
      owned.on('error', (error) => log('spawn-error', { message: error.message }));
      owned.once('close', (code, signal) => {
        clearTimeout(timer);
        ended = true;
        if (child === owned) child = null;
        resolve({ code, signal, timedOut, duration: Date.now() - startedAt });
      });
    });
    update({ processId: owned.pid ?? null });
    return { process: owned, done: childDone, ended: () => ended };
  }

  try {
    if (stopping) return;
    const before = await health();
    if (stopping) return;
    if (before.state !== 'offline')
      throw new Error('Port artik bos degil; hicbir uygulama kapatilmadi.');
    const build = launch(['node_modules/vite/bin/vite.js', 'build'], 'build', 60000);
    const built = await build.done;
    if (stopping) return;
    if (built.code !== 0 || built.timedOut)
      throw new Error(
        `Ofis gorunumu hazirlanamadi. Ayrinti: ${path.join(logDirectory, runId + '-build-error.log')}`,
      );
    let retries = 0,
      hasRun = false;
    while (!stopping) {
      const available = await health();
      if (stopping) break;
      if (available.state !== 'offline')
        throw new Error('Ofis portu kullanimda veya yanit vermiyor; baska uygulama kapatilmadi.');
      update({ phase: 'starting', retries });
      const running = launch(['--import', 'tsx', 'src/observer/main.ts'], 'server');
      const deadline = Date.now() + startupMs;
      let ready = false;
      while (!stopping && !running.ended() && Date.now() < deadline) {
        const result = await health();
        if (result.state === 'office' && result.processId === running.process.pid) {
          ready = true;
          break;
        }
        await pause(100);
      }
      if (stopping) break;
      if (!ready) {
        await stopChild();
        // A cold failure is surfaced immediately; no invisible retry after a failed launch.
        if (!hasRun)
          throw new Error(
            `Ofis sunucusu zamaninda hazir olmadi. Ayrinti: ${path.join(logDirectory, runId + '-server-error.log')}`,
          );
      } else {
        hasRun = true;
        update({ phase: 'running' });
      }
      const exit = await running.done;
      if (stopping) break;
      if (ready && exit.duration >= 60000) retries = 0;
      if (retries >= 3)
        throw new Error(
          'Ofis tekrar tekrar kapandi; otomatik denemeler durduruldu. Ofisi Ac ile yeniden deneyebilirsin.',
        );
      const delay = [1000, 3000, 7000][retries++];
      update({
        phase: 'restarting',
        processId: null,
        retries,
        delayMs: delay,
        exitCode: exit.code,
      });
      const until = Date.now() + delay;
      while (!stopping && Date.now() < until) await pause(100);
    }
  } catch (error) {
    update({ phase: 'failed', message: error.message });
    // Briefly retain the final status for the waiting launcher, then release IPC.
    await pause(500);
  } finally {
    await stopChild();
    if (stopping) update({ phase: 'stopped', processId: null });
    await new Promise((resolve) => server.close(resolve));
    process.off('SIGINT', signalStop);
    process.off('SIGTERM', signalStop);
  }
}

async function start() {
  let owner = await control();
  let created = false,
    runId = owner?.runId;
  if (!owner) {
    const current = await health();
    if (current.state === 'office')
      return { status: 'reused', url: url + '/', processId: current.processId, managed: false };
    if (current.state !== 'offline')
      throw new Error(
        `${port} portu baska bir uygulama tarafindan kullaniliyor veya yanit vermiyor. Hicbir uygulama kapatilmadi.`,
      );
    for (const required of ['node_modules/vite/bin/vite.js', 'node_modules/tsx/package.json']) {
      if (!existsSync(path.join(repo, required)))
        throw new Error('Proje bagimliliklari eksik. Proje klasorunde bir kez npm ci calistir.');
    }
    mkdirSync(logDirectory, { recursive: true });
    runId = randomUUID();
    const stdout = openSync(path.join(logDirectory, runId + '-supervisor.log'), 'a');
    const stderr = openSync(path.join(logDirectory, runId + '-supervisor-error.log'), 'a');
    try {
      const supervisor = spawn(
        process.execPath,
        [script, 'supervise', String(port), String(startupMs / 1000), runId],
        { cwd: repo, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr] },
      );
      await new Promise((resolve, reject) => {
        supervisor.once('spawn', resolve);
        supervisor.once('error', reject);
      });
      supervisor.unref();
    } finally {
      closeSync(stdout);
      closeSync(stderr);
    }
    created = true;
  }
  const deadline = Date.now() + (created ? 65000 : 0) + startupMs;
  let seenOwner = Boolean(owner);
  try {
    while (Date.now() < deadline) {
      owner = await control();
      if (owner) {
        // A simultaneous launcher may have acquired IPC first. Reuse that generation.
        if (owner.runId !== runId) {
          created = false;
          runId = owner.runId;
        }
        seenOwner = true;
        if (['failed', 'stopping', 'stopped'].includes(owner.phase))
          throw new Error(owner.message ?? 'Ofis kapatiliyor; biraz sonra yeniden acabilirsin.');
        if (owner.phase === 'running' && (await health()).processId === owner.processId) {
          return {
            status: created ? 'started' : 'reused',
            url: url + '/',
            managed: true,
            ...owner,
          };
        }
      } else if (seenOwner)
        throw new Error('Ofis baslatilamadi veya bilerek kapatildi. Ayrinti: ' + logDirectory);
      await pause(100);
    }
    throw new Error('Ofis zamaninda hazir olmadi. Ayrinti: ' + logDirectory);
  } catch (error) {
    if (created) await control('stop', runId).catch(() => {});
    throw error;
  }
}

try {
  if (!['win32', 'linux'].includes(process.platform))
    throw new Error('Bu baslatici Windows ve Linux icindir; macOS destegi henuz dogrulanmadi.');
  if (
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    !Number.isFinite(startupMs) ||
    startupMs < 5000 ||
    startupMs > 120000
  )
    throw new Error('Gecersiz port veya sure siniri.');
  if (process.platform === 'linux') controlToken = await linuxControlToken();
  if (action === 'supervise') await supervise(requestedRunId);
  else {
    let result;
    if (action === 'start') result = await start();
    else if (action === 'status') result = (await control()) ?? { phase: 'offline' };
    else if (action === 'stop') {
      const owner = await control();
      if (owner) {
        const stopped = await control('stop', owner.runId);
        if (stopped?.error) throw new Error(stopped.error);
        result = { status: 'stopped', runId: owner.runId };
      } else {
        const current = await health();
        if (current.state !== 'offline')
          throw new Error(
            'Bu sunucu yeni baslaticiyla acilmamis. Kaynak terminalinden kapat; baska islem durdurulmadi.',
          );
        result = { status: 'already-stopped' };
      }
    } else throw new Error('Gecersiz ofis komutu.');
    console.log(JSON.stringify(result));
  }
} catch (error) {
  console.log(JSON.stringify({ status: 'error', message: error.message }));
  process.exitCode = 1;
}
