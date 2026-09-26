import { fileURLToPath } from 'node:url';
import { CodexObserver } from './reader.ts';
import { createObserverServer } from './server.ts';
import { OfficeRuntime, rememberSupervisorTracking } from './office-runtime.ts';

function integer(name: string, fallback: number, min: number, max: number): number {
  const input = process.env[name];
  if (!input) return fallback;
  const value = Number(input);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name}: expected ${min}–${max}`);
  return value;
}

const readerOptions = {
  codexHome: process.env.CHELEBY_CODEX_HOME,
  recentDays: integer('CHELEBY_RECENT_DAYS', 7, 1, 366),
  maxFiles: integer('CHELEBY_MAX_FILES', 60, 1, 250),
  pollIntervalMs: integer('CHELEBY_POLL_MS', 1500, 500, 30000),
};
const observer = new OfficeRuntime(
  () => new CodexObserver(readerOptions),
  rememberSupervisorTracking,
);
const development = process.argv.includes('--dev');
const vite = development
  ? await import('vite').then(({ createServer }) =>
      createServer({
        configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
        server: { middlewareMode: true, hmr: false },
      }),
    )
  : null;
const app = createObserverServer({
  observer,
  runtime: observer,
  webRoot: fileURLToPath(new URL('../../dist/web', import.meta.url)),
  middleware: vite?.middlewares,
});
try {
  const url = await app.listen(integer('CHELEBY_PORT', 4317, 1024, 65535));
  console.log(`AI Office → ${url}`);
  console.log(
    `Local observation · recent ${readerOptions.recentDays} days + resumed older records · up to ${readerOptions.maxFiles} reads`,
  );
  await observer.initialize(process.env.CHELEBY_TRACKING !== 'stopped');
} catch (error) {
  console.error(
    (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
      ? 'Port in use. Set CHELEBY_PORT to another port.'
      : 'Could not start the local observer.',
  );
  await observer.close();
  await vite?.close();
  await app.close();
  process.exitCode = 1;
}
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await observer.close();
  await vite?.close();
  await app.close();
}
process.on('SIGINT', () => {
  void close();
});
process.on('SIGTERM', () => {
  void close();
});
