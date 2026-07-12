import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Plugin, ViteDevServer } from 'vite';
import { svelteVitals } from '../src/index.js';

afterEach(() => {
  delete process.env.SVELTE_VITALS_UI;
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

  it('configureServer installs middleware and sets the UI env flag', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const used: string[] = [];
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: () => {} },
      middlewares: { use: (path: string) => used.push(path) }
    } as unknown as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    (hook as (s: ViteDevServer) => void).call({}, server);
    expect(process.env.SVELTE_VITALS_UI).toBe('1');
    expect(used).toContain('/__svelte-vitals');
  });

  it('configureServer registers a watcher listener for source-change re-analysis', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const watcherEvents: string[] = [];
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: (event: string) => watcherEvents.push(event) },
      middlewares: { use: () => {} }
    } as unknown as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    (hook as (s: ViteDevServer) => void).call({}, server);
    expect(watcherEvents).toContain('all');
  });

  it('configureServer wraps printUrls to also announce the dashboard URL', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const originalPrintUrls = vi.fn();
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: () => {} },
      middlewares: { use: () => {} },
      printUrls: originalPrintUrls,
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] }
    } as unknown as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    (hook as (s: ViteDevServer) => void).call({}, server);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      server.printUrls();
      expect(originalPrintUrls).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('http://localhost:5173/__svelte-vitals/'));
    } finally {
      logSpy.mockRestore();
    }
  });

  it('announces the dashboard at the server root even when Vite prints a URL with a configured base path', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const originalPrintUrls = vi.fn();
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: () => {} },
      middlewares: { use: () => {} },
      printUrls: originalPrintUrls,
      // A non-root `base` in vite.config makes Vite print a URL with a path
      // segment (e.g. /my-app/), but installUiMiddleware always mounts at
      // the server root — the announced URL must not inherit that path.
      resolvedUrls: { local: ['http://localhost:5173/my-app/'], network: [] }
    } as unknown as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    (hook as (s: ViteDevServer) => void).call({}, server);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      server.printUrls();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('http://localhost:5173/__svelte-vitals/'));
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('/my-app/__svelte-vitals/'));
    } finally {
      logSpy.mockRestore();
    }
  });

  it('printUrls wrapper still calls the original and does not throw when resolvedUrls is unavailable', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const originalPrintUrls = vi.fn();
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: () => {} },
      middlewares: { use: () => {} },
      printUrls: originalPrintUrls,
      resolvedUrls: null
    } as unknown as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    (hook as (s: ViteDevServer) => void).call({}, server);

    expect(() => server.printUrls()).not.toThrow();
    expect(originalPrintUrls).toHaveBeenCalledTimes(1);
  });

  it('configureServer works without a watcher or httpServer on the mock server (defensive)', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      middlewares: { use: () => {} }
    } as unknown as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    expect(() => (hook as (s: ViteDevServer) => void).call({}, server)).not.toThrow();
  });
});
