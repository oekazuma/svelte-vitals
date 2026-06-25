import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import type { Config } from '@svelte-vitals/core';
import { createStore } from './store.js';
import { renderDashboard } from './serve.js';

/** Mount the dev UI at /__svelte-vitals/ : GET / (dashboard), POST /ingest, GET /events (SSE). */
export function installUiMiddleware(server: ViteDevServer, config: Config, version: string): void {
  const store = createStore();
  const clients = new Set<ServerResponse>();

  store.subscribe(() => {
    for (const res of clients) res.write('event: update\ndata: {}\n\n');
  });

  // connect strips the mount path, so req.url is relative ('/', '/ingest', '/events').
  server.middlewares.use('/__svelte-vitals', (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    if (req.method === 'POST' && url.startsWith('/ingest')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { route, results } = JSON.parse(body);
          if (typeof route === 'string' && Array.isArray(results)) store.set(route, results);
        } catch {
          // ignore malformed ingest payloads — dev tooling must not crash the dev server
        }
        res.statusCode = 204;
        res.end();
      });
      return;
    }

    if (url.startsWith('/events')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write('\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    res.end(renderDashboard(store.snapshot(), config, { version }));
  });
}
