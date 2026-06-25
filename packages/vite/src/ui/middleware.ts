import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import type { Config, Result } from '@svelte-vitals/core';
import { createStore } from './store.js';
import { renderDashboard } from './serve.js';

const SEVERITIES = new Set(['critical', 'warning', 'info']);

/**
 * The fields the dashboard renderer dereferences, so malformed ingest can't crash it:
 * `escapeHtml(id|message)` need strings, `effectiveSeverity`/`classify` read
 * `detection.presence|value` and `severity`. Real engine findings always carry these.
 */
function isResultLike(x: unknown): x is Result {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  const d = r.detection as Record<string, unknown> | undefined;
  return (
    typeof r.id === 'string' &&
    typeof r.message === 'string' &&
    typeof r.severity === 'string' &&
    SEVERITIES.has(r.severity) &&
    typeof d === 'object' &&
    d !== null &&
    typeof d.presence === 'string' &&
    typeof d.value === 'string'
  );
}

/** Mount the dev UI at /__svelte-vitals/ : GET / (dashboard), POST /ingest, GET /events (SSE). */
export function installUiMiddleware(server: ViteDevServer, config: Config, version: string): void {
  const store = createStore();
  const clients = new Set<ServerResponse>();

  store.subscribe(() => {
    for (const res of clients) {
      try {
        res.write('event: update\ndata: {}\n\n');
      } catch {
        // a client socket can error between its close event and this write —
        // drop it so one dead client never breaks the notify loop for the rest
        clients.delete(res);
      }
    }
  });

  // Open SSE connections keep the HTTP server from emitting 'close', so a `vite`
  // restart/shutdown would hang until each client disconnects. End them ourselves.
  server.httpServer?.once('close', () => {
    for (const res of clients) res.end();
    clients.clear();
  });

  // connect strips the mount path, so req.url is relative ('/', '/ingest', '/events').
  server.middlewares.use('/__svelte-vitals', (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    if (req.method === 'POST' && url.startsWith('/ingest')) {
      // Collect raw Buffers and decode once: per-chunk toString() would corrupt a
      // multibyte char split across a chunk boundary, dropping that route's findings.
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        try {
          const { route, results } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (typeof route === 'string' && Array.isArray(results)) {
            store.set(route, results.filter(isResultLike));
          }
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
