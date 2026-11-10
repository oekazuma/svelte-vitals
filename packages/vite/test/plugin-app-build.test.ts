import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { svelteVitals } from '../src/index.js';

type Hook = (...args: unknown[]) => Promise<void>;
function handlerOf(hook: unknown): Hook {
  return (typeof hook === 'function' ? hook : (hook as { handler: Hook }).handler).bind({}) as Hook;
}

// SvelteKit 3 builds through Vite's app builder: `config.builder` is set, and it prerenders in a
// `buildApp` hook, after the ssr and client closeBundle but before the service worker's.
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

  function plugin(resolved: { builder?: object; build?: object }): Plugin {
    const p = svelteVitals({ ui: false, report: false, failOn: 'critical' }) as Plugin;
    handlerOf(p.configResolved)({ root: cwd, build: { outDir: 'dist' }, ...resolved });
    return p;
  }

  it('skips closeBundle, even an ssr one that already sees the prerendered pages', async () => {
    const p = plugin({ builder: {}, build: { ssr: true, outDir: 'custom-out/output/server' } });
    await expect(handlerOf(p.closeBundle)()).resolves.toBeUndefined();
  });

  it('analyzes the pages beside the ssr environment output in buildApp', async () => {
    const p = plugin({ builder: {} });
    await expect(handlerOf(p.buildApp)(builder)).rejects.toThrow(/svelte-vitals: build failed/);
  });

  it('reads minify from the client environment, which can differ from the top-level value', async () => {
    const minifyFindings = async (topLevel: boolean, client: boolean): Promise<number> => {
      const p = svelteVitals({ cwd, ui: false, report: false, outFile: 'report.json' }) as Plugin;
      handlerOf(p.config)({ build: { minify: topLevel } }, {});
      handlerOf(p.configResolved)({ root: cwd, builder: {}, build: { outDir: 'dist' } });
      const environments = { ...builder.environments, client: { config: { build: { minify: client } } } };
      await handlerOf(p.buildApp)({ environments }).catch(() => {});
      const report = JSON.parse(await readFile(join(cwd, 'report.json'), 'utf8')) as {
        rules: Record<string, { findings: number }>;
      };
      return report.rules['performance/minify-disabled']!.findings;
    };
    expect(await minifyFindings(true, false)).toBe(1);
    expect(await minifyFindings(false, true)).toBe(0);
  });

  it('runs buildApp after the other buildApp hooks', () => {
    expect(plugin({}).buildApp).toMatchObject({ order: 'post' });
  });

  it('does nothing in buildApp without an app builder', async () => {
    await expect(handlerOf(plugin({}).buildApp)(builder)).resolves.toBeUndefined();
  });
});
