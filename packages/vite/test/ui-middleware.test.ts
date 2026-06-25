import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { installUiMiddleware } from '../src/ui/middleware.js';
import { defineConfig } from '@svelte-vitals/core';

// Capture the handler that installUiMiddleware registers on server.middlewares.use(path, fn).
function setup() {
  let handler: (req: any, res: any, next: () => void) => void = () => {};
  const server = { middlewares: { use: (_path: string, fn: typeof handler) => (handler = fn) } } as any;
  installUiMiddleware(server, defineConfig({}), '9.9.9');
  return { call: (req: any, res: any) => handler(req, res, () => {}) };
}
function res() {
  return { statusCode: 0, headers: {} as Record<string, string>, chunks: [] as string[], setHeader(k: string, v: string) { this.headers[k] = v; }, writeHead(c: number, h?: Record<string, string>) { this.statusCode = c; Object.assign(this.headers, h ?? {}); }, write(c: string) { this.chunks.push(c); }, end(c?: string) { if (c) this.chunks.push(c); } };
}
function postReq(url: string) { return Object.assign(new EventEmitter(), { method: 'POST', url }); }
function getReq(url: string) { return Object.assign(new EventEmitter(), { method: 'GET', url }); }

const ingestBody = JSON.stringify({
  route: '/a',
  results: [{ id: 'SEO001', message: 'Missing <title>', category: 'seo', detection: { presence: 'none', value: 'absent' }, route: '/a', severity: 'critical' }]
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
});
