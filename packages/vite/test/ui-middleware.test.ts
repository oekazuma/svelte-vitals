import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { installUiMiddleware } from '../src/ui/middleware.js';
import { createStore } from '../src/ui/store.js';
import { defineConfig } from '@svelte-vitals/core';

type MiddlewareHandler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

// Capture the handler that installUiMiddleware registers on server.middlewares.use(path, fn).
function setup(coreVersion?: string) {
  let handler: MiddlewareHandler = () => {};
  const httpServer = new EventEmitter();
  const server = {
    httpServer,
    middlewares: { use: (_path: string, fn: MiddlewareHandler) => (handler = fn) }
  } as unknown as ViteDevServer;
  installUiMiddleware(server, defineConfig({}), '9.9.9', createStore(), coreVersion);
  return {
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
  return r as unknown as MockRes & ServerResponse;
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
  }) as unknown as IncomingMessage;
}
function getReq(url: string, headers: Record<string, string> = { host: 'localhost:5173' }): IncomingMessage {
  return Object.assign(new EventEmitter(), {
    method: 'GET',
    url,
    headers,
    resume: () => {}
  }) as unknown as IncomingMessage;
}

const ingestBody = JSON.stringify({
  route: '/a',
  results: [
    {
      id: 'SEO001',
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
    expect(html).toContain('SEO001');
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
            { id: 'SEO002', detection: { presence: 'none', value: 'absent' } }, // missing message/severity
            { id: 'SEO003', message: 'm', severity: 'bogus', detection: { presence: 'none', value: 'absent' } }, // invalid severity
            {
              id: 'SEO001',
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
    expect(html).toContain('SEO001'); // the valid finding survived
    expect(html).not.toContain('SEO002'); // missing message/severity → dropped
    expect(html).not.toContain('SEO003'); // invalid severity → dropped
  });

  it('decodes a multibyte ingest body split across chunk boundaries', async () => {
    const { call } = setup();
    // A finding message with a multibyte char; split the JSON bytes mid-character.
    const payload = Buffer.from(
      JSON.stringify({
        route: '/x',
        results: [
          {
            id: 'SEO001',
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
    expect(html).toContain('SEO001'); // body parsed despite the split → finding survived
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
    expect(gr.chunks.join('')).not.toContain('SEO001');
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
    expect(gr.chunks.join('')).toContain('SEO001'); // stored and rendered
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
              id: 'SEO009',
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
    expect(html).not.toContain('SEO009'); // malformed finding was filtered out
  });

  it('surfaces the resolved @svelte-vitals/core version in the dashboard when passed', () => {
    const { call } = setup('0.21.0');
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.chunks.join('')).toContain('core v0.21.0');
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
              id: 'SEO010',
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
    expect(html).not.toContain('SEO010'); // malformed finding was filtered out
  });
});
