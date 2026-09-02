import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { CATEGORIES, type Config, type Result } from '@svelte-vitals/core';
import { renderAppShell } from '@svelte-vitals/core/internal';
import type { FindingsStore } from './store.js';
import { buildSnapshot } from './snapshot.js';
import { isLoopbackOrigin, isSameOrigin } from '../loopback.js';

const SEVERITIES = new Set(['critical', 'warning', 'info']);
const CATEGORY_SET = new Set<string>(CATEGORIES);
// Same-origin already limits reach to the dashboard's own page, but a same-origin request
// could still come from a giant accidental body; the built-in kitchen-sink defect gallery's
// largest route (25 findings) serializes to ~14 KB, so 4 MiB leaves ample headroom.
const INGEST_BODY_LIMIT = 4 * 1024 * 1024;

function isOptionalString(v: unknown): v is string | undefined {
  return v === undefined || typeof v === 'string';
}

/**
 * Every field the dashboard renderer dereferences, so malformed ingest can't crash it:
 * `escapeHtml` needs strings for `id`/`message`/`category`/`location`/`recommendation`/
 * `docsUrl`/`fix.*`/`route`, `effectiveSeverity`/`classify` read `detection.presence|value`
 * and `severity`, and `line` is interpolated as a number. Optional fields must be absent
 * or well-typed — `category: 123` would pass `?? 'seo'` and then throw inside `escapeHtml`.
 * Real engine findings always satisfy all of this.
 */
function isResultLike(x: unknown): x is Result {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  const d = r.detection as Record<string, unknown> | undefined;
  const f = r.fix as Record<string, unknown> | undefined;
  return (
    typeof r.id === 'string' &&
    typeof r.message === 'string' &&
    typeof r.severity === 'string' &&
    SEVERITIES.has(r.severity) &&
    typeof d === 'object' &&
    d !== null &&
    typeof d.presence === 'string' &&
    typeof d.value === 'string' &&
    (r.category === undefined || (typeof r.category === 'string' && CATEGORY_SET.has(r.category))) &&
    isOptionalString(r.location) &&
    isOptionalString(r.recommendation) &&
    isOptionalString(r.docsUrl) &&
    (f === undefined ||
      (typeof f === 'object' &&
        f !== null &&
        typeof f.description === 'string' &&
        isOptionalString(f.snippet) &&
        isOptionalString(f.lang))) &&
    (r.line === undefined || typeof r.line === 'number') &&
    isOptionalString(r.route)
  );
}

/**
 * Mount the dev UI at /__svelte-vitals/ : GET / (dashboard), POST /ingest, GET /events (SSE).
 * `store` is created and owned by the ui plugin (plugin.ts) so the analysis runner can also
 * write to it (`store.setStatic`) — this middleware only reads it and writes the live layer.
 */
export function installUiMiddleware(
  server: ViteDevServer,
  config: Config,
  version: string,
  store: FindingsStore,
  coreVersion?: string,
  /** Reads the whole-project runner's current crashed-rule ids; called per request so a later re-analysis is reflected without re-mounting the middleware. Empty/undefined until the first run completes or when nothing has failed. */
  getStaticFailedRuleIds?: () => string[] | undefined
): void {
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

    // Loopback Host defeats DNS rebinding; on top of that, a request carrying an Origin must come
    // from this very server (host:port). The handle's server-side fetch sends no Origin, and the
    // dashboard's own fetches are same-origin, so nothing legitimate is lost — while a page on any
    // other localhost port (another dev server, a local tool UI) can no longer POST findings in.
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (
      host === undefined ||
      !isLoopbackOrigin(`http://${host}`) ||
      (typeof origin === 'string' && !isSameOrigin(origin, host))
    ) {
      // drain any unread body so the client reliably receives the 403 (unread data kills the socket)
      req.resume();
      res.statusCode = 403;
      res.end('svelte-vitals dev UI is only available from localhost');
      return;
    }

    if (req.method === 'POST' && url.startsWith('/ingest')) {
      // Collect raw Buffers and decode once: per-chunk toString() would corrupt a
      // multibyte char split across a chunk boundary, dropping that route's findings.
      const chunks: Buffer[] = [];
      let received = 0;
      req.on('data', (c: Buffer) => {
        received += c.length;
        if (received <= INGEST_BODY_LIMIT) chunks.push(c);
      });
      req.on('end', () => {
        if (received > INGEST_BODY_LIMIT) {
          res.statusCode = 413;
          res.end();
          return;
        }
        try {
          const { route, results, failedRuleIds } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (typeof route === 'string' && Array.isArray(results)) {
            const failedIds = Array.isArray(failedRuleIds) ? failedRuleIds.filter((id) => typeof id === 'string') : [];
            store.set(route, results.filter(isResultLike), failedIds);
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

    if (url.startsWith('/data.json')) {
      try {
        const snapshot = buildSnapshot(store, config, { version, coreVersion }, getStaticFailedRuleIds?.());
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(snapshot));
      } catch {
        res.statusCode = 500;
        res.end('{}');
      }
      return;
    }

    // Last line of defense that validated data should never reach: if the renderer
    // throws anyway, return a plain-text 500 and never take down the dev server.
    try {
      const html = renderAppShell(buildSnapshot(store, config, { version, coreVersion }, getStaticFailedRuleIds?.()));
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    } catch {
      res.statusCode = 500;
      res.end('svelte-vitals dashboard failed to render');
    }
  });
}
