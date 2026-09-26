import { fileURLToPath } from 'node:url';
import { CodexObserver } from './reader.ts';
import { createObserverServer } from './server.ts';
import { OfficeRuntime, rememberSupervisorTracking } from './office-runtime.ts';
import { readConfig } from './config.ts';

const config = readConfig();
const readerOptions = config.reader;
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
  const url = await app.listen(config.port);
  console.log(`AI Office → ${url}`);
  console.log(
    `Local observation · recent ${readerOptions.recentDays} days + resumed older records · up to ${readerOptions.maxFiles} reads`,
  );
  await observer.initialize(config.tracking);
} catch (error) {
  console.error(
    (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
      ? 'Port in use. Set AI_OFFICE_PORT to another port.'
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
