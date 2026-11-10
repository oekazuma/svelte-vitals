import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { svelteVitals } from '../src/index.js';

type Hook = (...args: unknown[]) => Promise<void>;
function handlerOf(hook: unknown): Hook {
  return (typeof hook === 'function' ? hook : (hook as { handler: Hook }).handler).bind({}) as Hook;
}

// SvelteKit 3 builds through Vite's app builder: `config.builder` is set, each environment's
// closeBundle runs before prerendering, and only `buildApp` hooks run after it.
describe('svelteVitals under an app build', () => {
  let cwd: string;
  const builder = { environments: { ssr: { config: { build: { outDir: 'custom-out/output/server' } } } } };
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-app-build-'));
    const pages = join(cwd, 'custom-out/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    // No <title>: seo/title-presence is critical, so analyzing this page fails the gate.
    await writeFile(
      join(pages, 'index.html'),
      `<html lang="en"><head><meta name="description" content="Home page."></head><body></body></html>`
    );
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  function plugin(resolved: { builder?: object }): Plugin {
    const p = svelteVitals({ ui: false, report: false, failOn: 'critical' }) as Plugin;
    handlerOf(p.configResolved)({ root: cwd, build: { outDir: 'dist' }, ...resolved });
    return p;
  }

  it('leaves closeBundle to buildApp, which analyzes the pages beside the ssr environment output', async () => {
    const p = plugin({ builder: {} });
    await expect(handlerOf(p.closeBundle)()).resolves.toBeUndefined();
    await expect(handlerOf(p.buildApp)(builder)).rejects.toThrow(/svelte-vitals: build failed/);
  });

  it('runs buildApp after the other buildApp hooks', () => {
    expect(plugin({}).buildApp).toMatchObject({ order: 'post' });
  });

  it('does nothing in buildApp without an app builder', async () => {
    await expect(handlerOf(plugin({}).buildApp)(builder)).resolves.toBeUndefined();
  });
});
