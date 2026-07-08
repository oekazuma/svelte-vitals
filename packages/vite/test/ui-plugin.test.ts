import { describe, it, expect, afterEach } from 'vitest';
import type { Plugin, ViteDevServer } from 'vite';
import { svelteVitals } from '../src/index.js';

afterEach(() => {
  delete process.env.SVELTE_VITALS_UI;
});

describe('svelteVitals({ ui })', () => {
  it('returns a single plugin when ui is not set (unchanged)', () => {
    const p = svelteVitals({});
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
