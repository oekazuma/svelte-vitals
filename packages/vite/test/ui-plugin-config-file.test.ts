import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import { svelteVitals } from '../src/index.js';

// Whether the dev-dashboard's own `config` (used for buildSnapshot → buildJsonReport,
// independent of the whole-project `runner`, which already reads the config file via
// analyzeProject) picks up svelte-vitals.config.* the same way the CLI and build-mode
// analyze() do (2026-07-13 plan 038, Step B3).

afterEach(() => {
  delete process.env.SVELTE_VITALS_UI;
});

type MiddlewareHandler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

function fakeRes() {
  const chunks: string[] = [];
  const headers: Record<string, string> = {};
  const r = {
    statusCode: 200,
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    writeHead: (c: number, h?: Record<string, string>) => {
      r.statusCode = c;
      Object.assign(headers, h ?? {});
    },
    write: (c: string) => {
      chunks.push(c);
    },
    end: (c?: string) => {
      if (c) chunks.push(c);
    }
  };
  // Single boundary cast: `r` carries only the ServerResponse members the middleware touches.
  return { res: r as ServerResponse, headers, body: () => chunks.join('') };
}

function req(method: string, url: string): IncomingMessage {
  return Object.assign(new EventEmitter(), {
    method,
    url,
    headers: { host: 'localhost:5173' },
    resume: () => {}
  }) as IncomingMessage;
}

/** A minimal, already-scored seo-category finding — enough for computeHealth to report a weight for 'seo'. */
const seoFinding = {
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
};

async function startUiServer(cwd: string, extraOptions: Record<string, unknown> = {}) {
  const plugins = svelteVitals({ ui: true, cwd, ...extraOptions }) as Plugin[];
  const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
  let handler: MiddlewareHandler = () => {};
  let watcherCb: ((...args: unknown[]) => void) | undefined;
  const server = {
    config: { root: cwd },
    watcher: {
      on: (_event: string, cb: (...args: unknown[]) => void) => {
        watcherCb = cb;
      }
    },
    middlewares: { use: (_path: string, fn: MiddlewareHandler) => (handler = fn) }
  } as ViteDevServer;
  const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
  await (hook as (s: ViteDevServer) => void | Promise<void>).call({}, server);
  const call = (r: IncomingMessage, res: ServerResponse) => handler(r, res, () => {});

  // Seed the store with a real 'seo' finding via /ingest, so computeHealth's returned
  // `weights` map (which only contains categories present in the results) includes 'seo' —
  // isolates this test from the (independent) whole-project runner's success/failure.
  const ingestReq = Object.assign(req('POST', '/ingest'), { headers: { host: 'localhost:5173' } });
  call(ingestReq, fakeRes().res);
  ingestReq.emit('data', Buffer.from(JSON.stringify(seoFinding)));
  ingestReq.emit('end');
  await new Promise((r) => setTimeout(r, 0));

  return { call, fireWatcher: (file: string) => watcherCb?.('change', file) };
}

describe('svelteVitals dev dashboard — svelte-vitals.config.* wiring', () => {
  it("the dashboard's /data.json reflects the config file's weights", async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-ui-config-'));
    try {
      await writeFile(join(cwd, 'svelte-vitals.config.js'), 'export default { weights: { seo: 5 } };\n');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { call } = await startUiServer(cwd);
        const { res, body } = fakeRes();
        call(req('GET', '/data.json'), res);
        const data = JSON.parse(body());
        expect(data.report.weights.seo).toBe(5);
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('an explicit ui plugin option wins over the config file for the same field', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-ui-config-'));
    try {
      await writeFile(join(cwd, 'svelte-vitals.config.js'), 'export default { weights: { seo: 5 } };\n');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { call } = await startUiServer(cwd, { weights: { seo: 1 } });
        const { res, body } = fakeRes();
        call(req('GET', '/data.json'), res);
        const data = JSON.parse(body());
        expect(data.report.weights.seo).toBe(1);
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('logs a non-fatal config-file warning (e.g. an unrecognized failOn value) to the console', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-ui-config-'));
    try {
      await writeFile(join(cwd, 'svelte-vitals.config.js'), `export default { failOn: 'nope' };\n`);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await startUiServer(cwd);
        expect(warnSpy.mock.calls.some((args) => String(args[0]).includes('failOn'))).toBe(true);
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('re-resolves the dashboard config when svelte-vitals.config.* changes on the watcher', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-ui-config-'));
    try {
      const configPath = join(cwd, 'svelte-vitals.config.js');
      await writeFile(configPath, 'export default { weights: { seo: 5 } };\n');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { call, fireWatcher } = await startUiServer(cwd);
        await writeFile(configPath, 'export default { weights: { seo: 2 } };\n');
        fireWatcher(configPath);
        // The re-resolve is async; poll /data.json until the new weight lands.
        await vi.waitFor(
          () => {
            const { res, body } = fakeRes();
            call(req('GET', '/data.json'), res);
            expect(JSON.parse(body()).report.weights.seo).toBe(2);
          },
          { timeout: 2000 }
        );
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('keeps the previous dashboard config when the edited file fails validation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-ui-config-'));
    try {
      const configPath = join(cwd, 'svelte-vitals.config.js');
      await writeFile(configPath, 'export default { weights: { seo: 5 } };\n');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { call, fireWatcher } = await startUiServer(cwd);
        await writeFile(configPath, "export default { rules: { 'no/such-rule': 'off' } };\n");
        fireWatcher(configPath);
        await vi.waitFor(
          () => {
            expect(warnSpy.mock.calls.some((args) => String(args[0]).includes('config file invalid'))).toBe(true);
          },
          { timeout: 2000 }
        );
        const { res, body } = fakeRes();
        call(req('GET', '/data.json'), res);
        expect(JSON.parse(body()).report.weights.seo).toBe(5);
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
