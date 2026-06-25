import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { installUiMiddleware } from '../src/ui/middleware.js';
import { defineConfig } from '@svelte-vitals/core';

type MiddlewareHandler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

// Capture the handler that installUiMiddleware registers on server.middlewares.use(path, fn).
function setup() {
  let handler: MiddlewareHandler = () => {};
  const httpServer = new EventEmitter();
  const server = {
    httpServer,
    middlewares: { use: (_path: string, fn: MiddlewareHandler) => (handler = fn) }
  } as unknown as ViteDevServer;
  installUiMiddleware(server, defineConfig({}), '9.9.9');
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
function postReq(url: string): IncomingMessage {
  return Object.assign(new EventEmitter(), { method: 'POST', url }) as unknown as IncomingMessage;
}
function getReq(url: string): IncomingMessage {
  return Object.assign(new EventEmitter(), { method: 'GET', url }) as unknown as IncomingMessage;
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
});
