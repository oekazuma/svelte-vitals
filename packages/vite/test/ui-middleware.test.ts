import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { installUiMiddleware } from '../src/ui/middleware.js';
import { createStore, type FindingsStore } from '../src/ui/store.js';
import { defineConfig } from '@svelte-vitals/core';

type MiddlewareHandler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

// Capture the handler that installUiMiddleware registers on server.middlewares.use(path, fn).
function setup(
  coreVersion?: string,
  getStaticFailedRuleIds?: () => string[] | undefined,
  store: FindingsStore = createStore()
) {
  let handler: MiddlewareHandler = () => {};
  const httpServer = new EventEmitter();
  const server = {
    httpServer,
    middlewares: { use: (_path: string, fn: MiddlewareHandler) => (handler = fn) }
  } as ViteDevServer;
  installUiMiddleware(server, defineConfig({}), '9.9.9', store, coreVersion, getStaticFailedRuleIds);
  return {
    store,
    call: (req: IncomingMessage, res: ServerResponse) => handler(req, res, () => {}),
    closeServer: () => httpServer.emit('close')
  };
}
interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  chunks: string[];
  ended: boolean;
  setHeader(k: string, v: string): void;
  writeHead(c: number, h?: Record<string, string>): void;
  write(c: string): void;
  end(c?: string): void;
}
function res(): MockRes & ServerResponse {
  const r: MockRes = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    chunks: [] as string[],
    ended: false,
    setHeader(k: string, v: string) {
      r.headers[k] = v;
    },
    writeHead(c: number, h?: Record<string, string>) {
      r.statusCode = c;
      Object.assign(r.headers, h ?? {});
    },
    write(c: string) {
      r.chunks.push(c);
    },
    end(c?: string) {
      if (c) r.chunks.push(c);
      r.ended = true;
    }
  };
  return r as MockRes & ServerResponse;
}
// A real IncomingMessage always carries a headers object (the http parser initializes it),
// and HTTP/1.1 requires Host — default to a loopback Host to model real dev-server traffic.
// It is also a Readable, so resume() always exists (the middleware drains rejected bodies).
function postReq(url: string, headers: Record<string, string> = { host: 'localhost:5173' }): IncomingMessage {
  return Object.assign(new EventEmitter(), {
    method: 'POST',
    url,
    headers,
    resume: () => {}
  }) as IncomingMessage;
}
function getReq(url: string, headers: Record<string, string> = { host: 'localhost:5173' }): IncomingMessage {
  return Object.assign(new EventEmitter(), {
    method: 'GET',
    url,
    headers,
    resume: () => {}
  }) as IncomingMessage;
}

const ingestBody = JSON.stringify({
  route: '/a',
  results: [
    {
      id: 'seo/title-presence',
      message: 'Missing <title>',
      category: 'seo',
      detection: { presence: 'none', value: 'absent' },
      route: '/a',
      severity: 'critical'
    }
  ]
});

describe('installUiMiddleware', () => {
  it('serves the dashboard at / reflecting ingested findings', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest');
    call(ireq, ir);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    const html = gr.chunks.join('');
    expect(html).toContain('seo/title-presence');
    expect(gr.headers['Content-Type']).toContain('text/html');
  });

  it('streams an SSE update when findings are ingested', async () => {
    const { call } = setup();
    const sse = res();
    call(getReq('/events'), sse);
    expect(sse.headers['Content-Type']).toContain('text/event-stream');
    const ireq = postReq('/ingest');
    call(ireq, res());
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    expect(sse.chunks.join('')).toContain('event: update');
  });

  it('drops malformed finding objects so the dashboard still renders', async () => {
    const { call } = setup();
    const ireq = postReq('/ingest');
    call(ireq, res());
    ireq.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          route: '/x',
          results: [
            {}, // not an object-shaped finding
            { id: 'seo/description-presence', detection: { presence: 'none', value: 'absent' } }, // missing message/severity
            {
              id: 'seo/canonical-url',
              message: 'm',
              severity: 'bogus',
              detection: { presence: 'none', value: 'absent' }
            }, // invalid severity
            {
              id: 'seo/title-presence',
              detection: { presence: 'none', value: 'absent' },
              message: 'm',
              category: 'seo',
              severity: 'critical'
            }
          ]
        })
      )
    );
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    const html = gr.chunks.join('');
    expect(html.startsWith('<!doctype html>')).toBe(true); // did not crash on the malformed entries
    expect(html).toContain('seo/title-presence'); // the valid finding survived
    expect(html).not.toContain('seo/description-presence'); // missing message/severity → dropped
    expect(html).not.toContain('seo/canonical-url'); // invalid severity → dropped
  });

  it('decodes a multibyte ingest body split across chunk boundaries', async () => {
    const { call } = setup();
    // A finding message with a multibyte char; split the JSON bytes mid-character.
    const payload = Buffer.from(
      JSON.stringify({
        route: '/x',
        results: [
          {
            id: 'seo/title-presence',
            message: '日本語タイトルがありません',
            category: 'seo',
            detection: { presence: 'none', value: 'absent' },
            severity: 'critical'
          }
        ]
      }),
      'utf8'
    );
    const split = payload.indexOf(Buffer.from('日', 'utf8')) + 1; // mid first multibyte char
    const ireq = postReq('/ingest');
    call(ireq, res());
    ireq.emit('data', payload.subarray(0, split));
    ireq.emit('data', payload.subarray(split));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    const html = gr.chunks.join('');
    expect(html).toContain('seo/title-presence'); // body parsed despite the split → finding survived
  });

  it('ends open SSE connections when the dev server closes', () => {
    const { call, closeServer } = setup();
    const sse = res();
    call(getReq('/events'), sse);
    expect(sse.ended).toBe(false);
    closeServer();
    expect(sse.ended).toBe(true); // connection released so httpServer.close() can finish
  });

  it('rejects a cross-site ingest POST carrying a non-loopback Origin', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest', { host: 'localhost:5173', origin: 'https://evil.example' });
    call(ireq, ir);
    expect(ir.statusCode).toBe(403); // rejected before the body is even read
    // even if the body still arrives, no listener consumes it — the store must not change
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.statusCode).not.toBe(403);
    expect(gr.chunks.join('')).not.toContain('seo/title-presence');
  });

  it('rejects an ingest POST from another loopback port (cross-origin on localhost)', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest', { host: 'localhost:5173', origin: 'http://localhost:3000' });
    call(ireq, ir);
    expect(ir.statusCode).toBe(403);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.chunks.join('')).not.toContain('seo/title-presence');
  });

  it("accepts an ingest POST from the dashboard's own origin", async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest', { host: 'localhost:5173', origin: 'http://localhost:5173' });
    call(ireq, ir);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    expect(ir.statusCode).toBe(204);
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.chunks.join('')).toContain('seo/title-presence');
  });

  it('accepts a same-host https Origin (server.https)', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest', { host: 'localhost:5173', origin: 'https://localhost:5173' });
    call(ireq, ir);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    expect(ir.statusCode).toBe(204);
  });

  it('rejects Origin: null', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest', { host: 'localhost:5173', origin: 'null' });
    call(ireq, ir);
    expect(ir.statusCode).toBe(403);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.chunks.join('')).not.toContain('seo/title-presence');
  });

  it('rejects an ingest body over the size cap and stores nothing', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest', { host: 'localhost:5173' });
    call(ireq, ir);
    ireq.emit('data', Buffer.alloc(4 * 1024 * 1024 + 1, 0x20));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    expect(ir.statusCode).toBe(413);
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.chunks.join('')).not.toContain('seo/title-presence');
  });

  it('accepts an ingest POST without an Origin header (server-side postIngest behavior)', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest', { host: 'localhost:5173' }); // node fetch sends no Origin
    call(ireq, ir);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    expect(ir.statusCode).toBe(204);
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.chunks.join('')).toContain('seo/title-presence'); // stored and rendered
  });

  it('rejects a dashboard GET with a non-loopback Host (DNS rebinding)', () => {
    const { call } = setup();
    const gr = res();
    call(getReq('/', { host: 'evil.example' }), gr);
    expect(gr.statusCode).toBe(403);
    expect(gr.chunks.join('')).not.toContain('<!doctype html>');
  });

  it('filters a finding with a non-string category so the dashboard still renders', async () => {
    const { call } = setup();
    const ireq = postReq('/ingest');
    call(ireq, res());
    ireq.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          route: '/x',
          results: [
            {
              id: 'seo/html-lang',
              message: 'm',
              category: 123, // would pass `?? 'seo'` and throw inside escapeHtml
              detection: { presence: 'none', value: 'absent' },
              severity: 'critical'
            }
          ]
        })
      )
    );
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    const html = gr.chunks.join('');
    expect(gr.statusCode).not.toBe(500); // dashboard did not crash
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toContain('seo/html-lang'); // malformed finding was filtered out
  });

  it('surfaces the resolved @svelte-vitals/core version in the embedded snapshot when passed', () => {
    const { call } = setup('0.21.0');
    const gr = res();
    call(getReq('/'), gr);
    const html = gr.chunks.join('');
    const start = html.indexOf('<script type="application/json" id="svelte-vitals-data">');
    const contentStart = html.indexOf('>', start) + 1;
    const end = html.indexOf('</script>', contentStart);
    const embedded = JSON.parse(html.slice(contentStart, end));
    expect(embedded.meta.coreVersion).toBe('0.21.0');
  });

  it('filters a finding with a malformed fix shape so the dashboard still renders', async () => {
    const { call } = setup();
    const ireq = postReq('/ingest');
    call(ireq, res());
    ireq.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          route: '/x',
          results: [
            {
              id: 'seo/indexability',
              message: 'm',
              category: 'seo',
              detection: { presence: 'none', value: 'absent' },
              severity: 'critical',
              fix: { description: 5 } // non-string description would throw inside escapeHtml
            }
          ]
        })
      )
    );
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    const html = gr.chunks.join('');
    expect(gr.statusCode).not.toBe(500); // dashboard did not crash
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toContain('seo/indexability'); // malformed finding was filtered out
  });

  it('GET /data.json returns the same snapshot the dashboard embeds', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest');
    call(ireq, ir);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));

    const jr = res();
    call(getReq('/data.json'), jr);
    expect(jr.headers['Content-Type']).toContain('application/json');
    const data = JSON.parse(jr.chunks.join(''));
    expect(data.report.routes.some((r: { route: string }) => r.route === '/a')).toBe(true);
    expect(typeof data.sequence).toBe('number');
  });

  it('rejects a /data.json request with a non-loopback Host', () => {
    const { call } = setup();
    const jr = res();
    call(getReq('/data.json', { host: 'evil.example' }), jr);
    expect(jr.statusCode).toBe(403);
  });

  it('an ingested failedRuleIds list lowers the score vs. the same payload without it', async () => {
    // 'warning', not 'critical' — so the critical-cap doesn't mask the denominator shift.
    const body = (failedRuleIds?: string[]) =>
      JSON.stringify({
        route: '/a',
        results: [
          {
            id: 'seo/canonical-url',
            message: 'm',
            category: 'seo',
            detection: { presence: 'none', value: 'absent' },
            route: '/a',
            severity: 'warning'
          }
        ],
        ...(failedRuleIds ? { failedRuleIds } : {})
      });

    const control = setup();
    const cr = postReq('/ingest');
    control.call(cr, res());
    cr.emit('data', Buffer.from(body()));
    cr.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const controlData = JSON.parse(
      (() => {
        const jr = res();
        control.call(getReq('/data.json'), jr);
        return jr.chunks.join('');
      })()
    );

    const failing = setup();
    const fr = postReq('/ingest');
    failing.call(fr, res());
    fr.emit('data', Buffer.from(body(['seo/title-presence'])));
    fr.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const failingData = JSON.parse(
      (() => {
        const jr = res();
        failing.call(getReq('/data.json'), jr);
        return jr.chunks.join('');
      })()
    );

    expect(failingData.report.score).not.toBe(controlData.report.score);
  });

  it('tolerates a non-array failedRuleIds field (treated as no failures)', async () => {
    const { call } = setup();
    const ireq = postReq('/ingest');
    call(ireq, res());
    ireq.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          route: '/a',
          results: [
            {
              id: 'seo/title-presence',
              message: 'm',
              category: 'seo',
              detection: { presence: 'none', value: 'absent' },
              route: '/a',
              severity: 'critical'
            }
          ],
          failedRuleIds: 'nonsense'
        })
      )
    );
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.statusCode).not.toBe(500); // did not crash on the malformed field
    expect(gr.chunks.join('')).toContain('seo/title-presence'); // finding still stored
  });

  it('tolerates an absent failedRuleIds field (treated as no failures)', async () => {
    const { call } = setup();
    const ireq = postReq('/ingest');
    call(ireq, res());
    ireq.emit('data', Buffer.from(ingestBody)); // no failedRuleIds key at all
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.statusCode).not.toBe(500);
  });

  it('reads getStaticFailedRuleIds per request so a later re-analysis is reflected without re-mounting', () => {
    // The getter closes over this variable and reads it at request time, so a later
    // reassignment is visible without re-mounting the middleware.
    let currentFailedIds: string[] | undefined = undefined;
    const store = createStore();
    store.setStatic([
      {
        id: 'seo/canonical-url',
        message: 'm',
        category: 'seo',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        severity: 'warning'
      }
    ]);
    const { call } = setup(undefined, () => currentFailedIds, store);

    const before = res();
    call(getReq('/data.json'), before);
    const beforeScore = JSON.parse(before.chunks.join('')).report.score;

    // A later whole-project run reports seo/canonical-url as failed — the getter reads the
    // CURRENT value at request time, not a snapshot taken when installUiMiddleware was called.
    currentFailedIds = ['seo/canonical-url'];
    const after = res();
    call(getReq('/data.json'), after);
    const afterScore = JSON.parse(after.chunks.join('')).report.score;

    expect(afterScore).not.toBe(beforeScore);
  });
});
