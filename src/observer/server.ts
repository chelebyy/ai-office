import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import type { CodexObserver } from './reader.ts';

export interface ServerOptions {
  observer: CodexObserver;
  webRoot?: string;
  // Development middleware shares this exact host and port. There is no CORS proxy.
  middleware?: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
}

export function createObserverServer(options: ServerOptions) {
  const { observer } = options;
  const token = randomBytes(32).toString('hex');
  let origin = '';
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  function isLocalRequest(req: IncomingMessage): boolean {
    return req.headers.host === new URL(origin).host
      && (!req.headers.origin || req.headers.origin === origin)
      && (!req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])));
  }
  function authenticated(req: IncomingMessage): boolean {
    const cookie = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('cheleby_session='))?.slice(16) ?? '';
    const supplied = Buffer.from(cookie);
    const expected = Buffer.from(token);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }
  function json(res: ServerResponse, code: number, value: unknown) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  }

  const server = createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    if (!origin || !isLocalRequest(req)) { json(res, 403, { error: 'Forbidden origin' }); return; }
    if (req.method !== 'GET') { json(res, 405, { error: 'Read-only observer' }); return; }
    const url = new URL(req.url ?? '/', origin);
    if (url.pathname === '/api/health') {
      json(res, 200, { name: 'cheleby-home', schemaVersion: 1 }); return;
    }
    if (url.pathname === '/api/snapshot') {
      if (!authenticated(req)) { json(res, 401, { error: 'Open the local app first' }); return; }
      json(res, 200, observer.snapshot()); return;
    }
    if (url.pathname.startsWith('/api/')) { json(res, 404, { error: 'Not found' }); return; }
    if (url.pathname === '/') res.setHeader('Set-Cookie', `cheleby_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
    if (options.middleware) { options.middleware(req, res, () => { res.writeHead(404); res.end('Not found'); }); return; }
    void (async () => {
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const root = path.resolve(options.webRoot ?? 'dist/web');
      const filename = path.resolve(root, relative);
      if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      try {
        const body = await readFile(filename);
        const extension = path.extname(filename);
        const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
        res.setHeader('Content-Security-Policy', `default-src 'self'; connect-src 'self' ${origin.replace('http:', 'ws:')}; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'`);
        res.writeHead(200, { 'Content-Type': types[extension] ?? 'application/octet-stream' }); res.end(body);
      } catch { res.writeHead(404); res.end('Run npm run build before npm start.'); }
    })().catch(() => { if (!res.headersSent) res.writeHead(400); res.end(); });
  });

  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => {});
    if (req.url !== '/live') {
      // Let Vite handle its own HMR upgrade in development.
      if (!options.middleware) socket.destroy();
      return;
    }
    if (!origin || !isLocalRequest(req) || req.headers.origin !== origin || !authenticated(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
    }
    sockets.handleUpgrade(req, socket, head, client => {
      client.on('error', () => {});
      client.send(JSON.stringify(observer.snapshot()));
      // No application commands are accepted from the browser.
      client.on('message', () => client.close(1008, 'Read-only connection'));
    });
  });
  const broadcast = (snapshot: unknown) => {
    const message = JSON.stringify(snapshot);
    for (const client of sockets.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (client.bufferedAmount > 2 * 1024 * 1024) { client.close(1013, 'Slow connection'); continue; }
      client.send(message);
    }
  };
  observer.on('snapshot', broadcast);

  return {
    server,
    async listen(port = 4317): Promise<string> {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('TCP address unavailable');
      origin = `http://127.0.0.1:${address.port}`;
      return origin;
    },
    async close(): Promise<void> {
      observer.off('snapshot', broadcast);
      for (const client of sockets.clients) client.terminate();
      await new Promise<void>(resolve => sockets.close(() => resolve()));
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}
