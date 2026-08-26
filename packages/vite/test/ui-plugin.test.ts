import { describe, it, expect, afterEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

type MiddlewareHandler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

// Stub out the whole-project analysis runner so the watcher-callback test below can
// assert on `notifyChange` calls directly, without a real analysis run in the loop.
// `vi.hoisted` gives the mock factory a safe reference to a variable declared here,
// since `vi.mock` factories are hoisted above regular imports/consts.
const { mockNotifyChange } = vi.hoisted(() => ({ mockNotifyChange: vi.fn() }));
vi.mock('../src/ui/analysis.js', () => ({
  createAnalysisRunner: () => ({
    start: vi.fn(),
    notifyChange: mockNotifyChange,
    stop: vi.fn()
  })
}));

import { svelteVitals } from '../src/index.js';

afterEach(() => {
  delete process.env.SVELTE_VITALS_UI;
  mockNotifyChange.mockClear();
});

describe('svelteVitals({ ui })', () => {
  it('defaults ui to true: returns both plugins when ui is not set', () => {
    const plugins = svelteVitals({}) as Plugin[];
    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.map((p) => p.name).sort()).toEqual(['svelte-vitals', 'svelte-vitals:ui']);
  });

  it('returns a single build-only plugin when ui: false is passed explicitly', () => {
    const p = svelteVitals({ ui: false });
    expect(Array.isArray(p)).toBe(false);
    expect((p as Plugin).name).toBe('svelte-vitals');
  });

  it('adds a dev-only UI plugin when ui:true', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    expect(Array.isArray(plugins)).toBe(true);
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    expect(ui).toBeDefined();
    expect(ui.apply).toBe('serve');
  });

  it('configureServer installs middleware and sets the UI env flag', async () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const used: string[] = [];
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: (_event: string, _cb: (...args: unknown[]) => void) => {} },
      middlewares: {
        use: (path: string, _fn: MiddlewareHandler) => {
          used.push(path);
        }
      }
    } as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    await (hook as (s: ViteDevServer) => void | Promise<void>).call({}, server);
    expect(process.env.SVELTE_VITALS_UI).toBe('1');
    expect(used).toContain('/__svelte-vitals');
  });

  it('configureServer registers a watcher listener for source-change re-analysis', async () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const watcherEvents: string[] = [];
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: {
        on: (event: string, _cb: (...args: unknown[]) => void) => {
          watcherEvents.push(event);
        }
      },
      middlewares: { use: (_path: string, _fn: MiddlewareHandler) => {} }
    } as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    await (hook as (s: ViteDevServer) => void | Promise<void>).call({}, server);
    expect(watcherEvents).toContain('all');
  });

  it('the watcher callback triggers re-analysis for a relevant file and skips an irrelevant one', async () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    let watcherCallback: ((event: string, file: string) => void) | undefined;
    const root = '/tmp/does-not-exist-svelte-vitals-ui-plugin-test';
    const server = {
      config: { root },
      watcher: {
        on: (_event: string, cb: (event: string, file: string) => void) => {
          watcherCallback = cb;
        }
      },
      middlewares: { use: (_path: string, _fn: MiddlewareHandler) => {} }
    } as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    await (hook as (s: ViteDevServer) => void | Promise<void>).call({}, server);
    expect(watcherCallback).toBeDefined();

    // A relevant file (under src/) triggers a re-analysis via runner.notifyChange.
    const relevantFile = `${root}/src/routes/+page.svelte`;
    watcherCallback!('change', relevantFile);
    expect(mockNotifyChange).toHaveBeenCalledWith(relevantFile);

    // An irrelevant file (under node_modules/) must not trigger a re-analysis.
    mockNotifyChange.mockClear();
    const irrelevantFile = `${root}/node_modules/foo/index.js`;
    watcherCallback!('change', irrelevantFile);
    expect(mockNotifyChange).not.toHaveBeenCalled();
  });

  it('configureServer wraps printUrls to also announce the dashboard URL', async () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const originalPrintUrls = vi.fn();
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: (_event: string, _cb: (...args: unknown[]) => void) => {} },
      middlewares: { use: (_path: string, _fn: MiddlewareHandler) => {} },
      printUrls: originalPrintUrls as ViteDevServer['printUrls'],
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] as string[] }
    } as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    await (hook as (s: ViteDevServer) => void | Promise<void>).call({}, server);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      server.printUrls();
      expect(originalPrintUrls).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('http://localhost:5173/__svelte-vitals/'));
    } finally {
      logSpy.mockRestore();
    }
  });

  it('announces the dashboard at the server root even when Vite prints a URL with a configured base path', async () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const originalPrintUrls = vi.fn();
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: (_event: string, _cb: (...args: unknown[]) => void) => {} },
      middlewares: { use: (_path: string, _fn: MiddlewareHandler) => {} },
      printUrls: originalPrintUrls as ViteDevServer['printUrls'],
      // A non-root `base` in vite.config makes Vite print a URL with a path
      // segment (e.g. /my-app/), but installUiMiddleware always mounts at
      // the server root — the announced URL must not inherit that path.
      resolvedUrls: { local: ['http://localhost:5173/my-app/'], network: [] as string[] }
    } as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    await (hook as (s: ViteDevServer) => void | Promise<void>).call({}, server);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      server.printUrls();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('http://localhost:5173/__svelte-vitals/'));
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('/my-app/__svelte-vitals/'));
    } finally {
      logSpy.mockRestore();
    }
  });

  it('printUrls wrapper still calls the original and does not throw when resolvedUrls is unavailable', async () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const originalPrintUrls = vi.fn();
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: (_event: string, _cb: (...args: unknown[]) => void) => {} },
      middlewares: { use: (_path: string, _fn: MiddlewareHandler) => {} },
      printUrls: originalPrintUrls as ViteDevServer['printUrls'],
      resolvedUrls: null
    } as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    await (hook as (s: ViteDevServer) => void | Promise<void>).call({}, server);

    expect(() => server.printUrls()).not.toThrow();
    expect(originalPrintUrls).toHaveBeenCalledTimes(1);
  });

  it('configureServer works without a watcher or httpServer on the mock server (defensive)', async () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      middlewares: { use: (_path: string, _fn: MiddlewareHandler) => {} }
    } as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    // Rejecting here would fail the test the same way `.not.toThrow()` would for sync code.
    await (hook as (s: ViteDevServer) => void | Promise<void>).call({}, server);
  });
});
