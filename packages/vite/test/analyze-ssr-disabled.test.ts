import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import type { KitModuleFacts } from '@svelte-vitals/core/internal';
import { analyze, ssrDisabledRouteMatcher } from '../src/analyze.js';
import { svelteVitals } from '../src/index.js';

// What SvelteKit writes for an `ssr = false` route: app.html with the client bootstrap, no page.
const SHELL = `<html lang="en"><head><meta charset="utf-8"/></head><body><div style="display: contents"><script>{}</script></div></body></html>`;
const PAGE = `<html lang="en"><head><title>Home</title><meta name="description" content="d"/></head><body><main><h1>Home</h1></main></body></html>`;

async function fixture(files: Record<string, string>): Promise<{ cwd: string; pages: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'sv-ssr-off-'));
  const pages = join(cwd, '.svelte-kit/output/prerendered/pages');
  for (const [rel, content] of Object.entries(files)) {
    const path = rel.endsWith('.html') ? join(pages, rel) : join(cwd, rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, content);
  }
  return { cwd, pages };
}

describe('ssrDisabledRouteMatcher', () => {
  // The matcher reads only `file` and `ssrDisabled`.
  const facts = (file: string, ssrDisabled = true) =>
    ({ file, kind: 'universal', ...(ssrDisabled ? { ssrDisabled: { line: 0 } } : {}) }) as KitModuleFacts;

  it('a root +layout covers every route, (group) directories are not URL segments', () => {
    const is = ssrDisabledRouteMatcher([facts('src/routes/(app)/+layout.ts')]);
    expect(is('/')).toBe(true);
    expect(is('/about')).toBe(true);
  });

  it('a +page covers only its own route, a +layout its subtree', () => {
    const page = ssrDisabledRouteMatcher([facts('src/routes/spa/+page.server.js')]);
    expect(page('/spa')).toBe(true);
    expect(page('/spa/child')).toBe(false);
    const layout = ssrDisabledRouteMatcher([facts('src/routes/spa/+layout.ts')]);
    expect(layout('/spa')).toBe(true);
    expect(layout('/spa/child')).toBe(true);
    expect(layout('/spam')).toBe(false);
    expect(layout('/')).toBe(false);
  });

  it('matches concrete rendered paths against [param], [...rest] and [[optional]] segments', () => {
    const param = ssrDisabledRouteMatcher([facts('src/routes/docs/[slug=word]/+page.ts')]);
    expect(param('/docs/intro')).toBe(true);
    expect(param('/docs/intro/deep')).toBe(false);
    const rest = ssrDisabledRouteMatcher([facts('src/routes/docs/[...path]/+page.ts')]);
    expect(rest('/docs')).toBe(true);
    expect(rest('/docs/a/b')).toBe(true);
    const optional = ssrDisabledRouteMatcher([facts('src/routes/[[lang]]/about/+page.ts')]);
    expect(optional('/about')).toBe(true);
    expect(optional('/ja/about')).toBe(true);
    expect(optional('/ja/x/about')).toBe(false);
    // SvelteKit's default `entries: ['*']` prerenders `/` for a `[[lang]]` root page.
    const optionalRoot = ssrDisabledRouteMatcher([facts('src/routes/[[lang]]/+page.ts')]);
    expect(optionalRoot('/')).toBe(true);
    expect(optionalRoot('/ja')).toBe(true);
    expect(ssrDisabledRouteMatcher([facts('src/routes/+page.ts')])('/')).toBe(true);
    expect(ssrDisabledRouteMatcher([facts('src/routes/+page.ts')])('/about')).toBe(false);
  });

  it('ignores modules that cannot carry the page option, and modules with SSR on', () => {
    const is = ssrDisabledRouteMatcher([
      facts('src/routes/+server.ts'),
      facts('src/hooks.server.ts'),
      facts('src/routes/+layout.ts', false)
    ]);
    expect(is('/')).toBe(false);
  });
});

describe('analyze: routes with ssr = false', () => {
  let root: { cwd: string; pages: string };
  let scoped: { cwd: string; pages: string };
  beforeAll(async () => {
    root = await fixture({
      'src/routes/+layout.ts': 'export const prerender = true;\nexport const ssr = false;\n',
      'src/routes/+page.svelte': '<svelte:head><title>Home</title></svelte:head><main><h1>Home</h1></main>',
      'src/lib/List.svelte': '{#each items as item}<li>{item}</li>{/each}',
      'index.html': SHELL,
      'about.html': SHELL
    });
    scoped = await fixture({
      'src/routes/app/+layout.ts': 'export const ssr = false;\n',
      'index.html': PAGE,
      'app.html': SHELL,
      'app/settings.html': SHELL
    });
  });
  afterAll(async () => {
    await rm(root.cwd, { recursive: true, force: true });
    await rm(scoped.cwd, { recursive: true, force: true });
  });

  it('drops the shell routes instead of reporting them as missing everything', async () => {
    const r = await analyze(root.pages, root.cwd, { report: false });
    // Component and Kit-module findings carry their file as `route`; rendered routes start with '/'.
    expect(r.results.filter((x) => x.route?.startsWith('/'))).toEqual([]);
    expect(r.failed).toBe(false);
    expect(r.warnings).toContain(
      'skipped 2 prerendered route(s) with ssr = false — their HTML is the app shell, not the page; ' +
        'run `npx svelte-vitals` to check them from source: /, /about'
    );
    expect(r.consoleReport).toContain('Analyzed 0 prerendered route(s) (skipped 2 with ssr = false).');
    // Files found, not routes analyzed: plugin.ts reads 0 as "no build output" and skips the gate.
    expect(r.routeCount).toBe(2);
  });

  it('keeps routes outside the ssr = false subtree', async () => {
    const r = await analyze(scoped.pages, scoped.cwd, { report: false });
    const routes = new Set(r.results.map((x) => x.route).filter((x) => x?.startsWith('/')));
    expect(routes).toEqual(new Set(['/']));
    expect(r.results.some((x) => x.id === 'seo/title-presence' && x.detection.presence === 'none')).toBe(false);
    expect(r.warnings.some((w) => w.startsWith('skipped 2 prerendered route(s)'))).toBe(true);
  });

  it('an all-shell SPA still writes the report and runs the source rules through the gate', async () => {
    const outFile = join(root.cwd, 'report.json');
    const p = svelteVitals({ cwd: root.cwd, ui: false, report: false, outFile, failOn: 'warning' }) as Plugin;
    const hook = typeof p.closeBundle === 'function' ? p.closeBundle : p.closeBundle?.handler;
    await expect((hook as () => Promise<void>).call({})).rejects.toThrow(/svelte-vitals: build failed/);
    const report = JSON.parse(await readFile(outFile, 'utf8'));
    expect(report.rules['correctness/each-key'].findings).toBe(1);
    expect(report.routes.filter((r: { route: string }) => r.route.startsWith('/'))).toEqual([]);
  });
});
