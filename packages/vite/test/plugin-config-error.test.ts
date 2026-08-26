import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import { svelteVitals } from '../src/index.js';

// Plan 047: an invalid svelte-vitals.config.* (e.g. an unknown rule id) must fail
// `vite build` — the same stance as the CLI's exit 2 — but must NOT crash `vite dev`;
// the dashboard warns and falls back to plugin options/defaults instead.

async function makeInvalidConfigProject() {
  const cwd = await mkdtemp(join(tmpdir(), 'sv-cfg-err-'));
  const pages = join(cwd, '.svelte-kit/output/prerendered/pages');
  await mkdir(pages, { recursive: true });
  await writeFile(join(pages, 'index.html'), `<html lang="en"><head><title>Home</title></head><body></body></html>`);
  await writeFile(join(cwd, 'svelte-vitals.config.js'), `export default { rules: { 'nope/nope': 'off' } };\n`);
  return cwd;
}

describe('svelteVitals build — invalid config file', () => {
  function closeBundleOf(p: Plugin): () => Promise<void> {
    const hook = typeof p.closeBundle === 'function' ? p.closeBundle : p.closeBundle?.handler;
    return (hook as () => Promise<void>).bind({});
  }

  let cwd: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    cwd = await makeInvalidConfigProject();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(async () => {
    warnSpy.mockRestore();
    await rm(cwd, { recursive: true, force: true });
  });

  it('rejects closeBundle instead of skipping the gate with a warning', async () => {
    const p = svelteVitals({ cwd, ui: false }) as Plugin;
    await expect(closeBundleOf(p)()).rejects.toThrow(/svelte-vitals\.config\.js.*unknown rule id/);
    // Distinct from the "analysis failed" warn-and-skip path (plugin-error.test.ts) —
    // a config error must propagate, not be swallowed as a tool-side analysis failure.
    expect(warnSpy.mock.calls.some((args: unknown[]) => String(args[0]).includes('skipped — analysis failed'))).toBe(
      false
    );
  });
});

describe('svelteVitals dev — invalid config file', () => {
  type MiddlewareHandler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

  function fakeRes() {
    const chunks: string[] = [];
    const r = {
      statusCode: 200,
      setHeader: (_k: string, _v: string) => {},
      writeHead: (c: number) => {
        r.statusCode = c;
      },
      write: (c: string) => {
        chunks.push(c);
      },
      end: (c?: string) => {
        if (c) chunks.push(c);
      }
    };
    // Single boundary cast: `r` carries only the ServerResponse members the middleware touches.
    return { res: r as ServerResponse, body: () => chunks.join('') };
  }

  function req(method: string, url: string): IncomingMessage {
    return Object.assign(new EventEmitter(), {
      method,
      url,
      headers: { host: 'localhost:5173' },
      resume: () => {}
    }) as IncomingMessage;
  }

  let cwd: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  afterEach(async () => {
    delete process.env.SVELTE_VITALS_UI;
    warnSpy.mockRestore();
    await rm(cwd, { recursive: true, force: true });
  });

  it('completes server setup, warns, and serves a config built from plugin options alone', async () => {
    cwd = await makeInvalidConfigProject();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // An explicit plugin option — proves the dev fallback is mergeConfig(options, undefined)
    // (plugin options honored), not a bare built-in default (which would leave weights.seo unset).
    const plugins = svelteVitals({ ui: true, cwd, weights: { seo: 7 } }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    let handler: MiddlewareHandler = () => {};
    const server = {
      config: { root: cwd },
      watcher: { on: (_event: string, _cb: (...args: unknown[]) => void) => {} },
      middlewares: { use: (_path: string, fn: MiddlewareHandler) => (handler = fn) }
    } as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;

    // Server setup must complete (not reject / crash) despite the invalid config file.
    await expect((hook as (s: ViteDevServer) => void | Promise<void>).call({}, server)).resolves.toBeUndefined();

    expect(warnSpy.mock.calls.some((args: unknown[]) => String(args[0]).includes('config file invalid'))).toBe(true);

    // Seed a real 'seo' finding via /ingest so computeHealth's `weights` map (which only
    // contains categories present in the results) includes 'seo' (same technique as
    // ui-plugin-config-file.test.ts).
    const call = (r: IncomingMessage, res: ServerResponse) => handler(r, res, () => {});
    const ingestReq = req('POST', '/ingest');
    call(ingestReq, fakeRes().res);
    ingestReq.emit(
      'data',
      Buffer.from(
        JSON.stringify({
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
        })
      )
    );
    ingestReq.emit('end');
    await new Promise((r) => setTimeout(r, 0));

    const { res, body } = fakeRes();
    call(req('GET', '/data.json'), res);
    const data = JSON.parse(body());
    expect(data.report.weights.seo).toBe(7);
  });
});
