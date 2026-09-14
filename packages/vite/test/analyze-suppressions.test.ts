import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { analyze } from '../src/analyze.js';
import { svelteVitals } from '../src/index.js';
import { createAnalysisRunner, type AnalyzeFn } from '../src/ui/analysis.js';
import { isRelevant } from '../src/plugin.js';
import { defaultConfig } from '@svelte-vitals/core/internal';
import type { Result } from '@svelte-vitals/core';

const PAGE = `<html lang="en"><head><title>Home</title><meta name="description" content="d"/></head><body><main><h1>Home</h1></main></body></html>`;
const LIST = '{#each items as item}<li>{item}</li>{/each}';
const ENTRY = { id: 'correctness/each-key', route: 'src/lib/List.svelte', location: 'src/lib/List.svelte' };
// What the CLI records for a route-level rule: the plugin never applies these.
const ROUTE_ENTRY = { id: 'seo/title-presence', route: '/', location: 'src/routes/+page.svelte' };
const ROUTE_NOTICE =
  '1 route-level entry does not apply to the plugin (svelte-vitals-suppressions.json) — rendered route findings anchor to the built HTML; use `overrides` for those.';

async function project(suppressions?: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'sv-suppress-'));
  const pages = join(cwd, '.svelte-kit/output/prerendered/pages');
  await mkdir(pages, { recursive: true });
  await mkdir(join(cwd, 'src/lib'), { recursive: true });
  await writeFile(join(pages, 'index.html'), PAGE);
  await writeFile(join(cwd, 'src/lib/List.svelte'), LIST);
  if (suppressions !== undefined) await writeFile(join(cwd, 'svelte-vitals-suppressions.json'), suppressions);
  return cwd;
}

function closeBundleOf(p: Plugin): () => Promise<void> {
  const hook = typeof p.closeBundle === 'function' ? p.closeBundle : p.closeBundle?.handler;
  return (hook as () => Promise<void>).bind({});
}

const eachKey = (results: Result[]) =>
  results.filter((r) => r.id === 'correctness/each-key' && r.detection.presence === 'none');
// The fixture's only warning-level finding once the page-level seo rules the shell page lacks are off.
const onlyEachKey = {
  report: false as const,
  failOn: 'warning' as const,
  rules: Object.fromEntries(
    ['canonical-url', 'og-image', 'og-title', 'og-url', 'viewport', 'charset', 'robots-txt', 'sitemap-xml'].map((r) => [
      `seo/${r}`,
      'off' as const
    ])
  )
};

describe('build: svelte-vitals-suppressions.json', () => {
  const dirs: string[] = [];
  let plain: string;
  let suppressed: string;
  let malformed: string;
  beforeAll(async () => {
    plain = await project();
    suppressed = await project(JSON.stringify({ version: 1, suppressions: [ENTRY, ROUTE_ENTRY] }));
    malformed = await project('{ "version": 2, "suppressions": [] }');
    dirs.push(plain, suppressed, malformed);
  });
  afterAll(async () => {
    for (const d of dirs) await rm(d, { recursive: true, force: true });
  });

  it('drops a recorded finding before scoring and the gate, and says how many', async () => {
    const before = await analyze(join(plain, '.svelte-kit/output/prerendered/pages'), plain, onlyEachKey);
    expect(eachKey(before.results)).toHaveLength(1);
    expect(before.failed).toBe(true);

    const after = await analyze(join(suppressed, '.svelte-kit/output/prerendered/pages'), suppressed, onlyEachKey);
    expect(eachKey(after.results)).toHaveLength(0);
    expect(after.failed).toBe(false);
    expect(after.score).toBeGreaterThan(before.score);
    expect(after.warnings).toContain('1 finding(s) suppressed by svelte-vitals-suppressions.json.');
    expect(after.warnings).toContain(ROUTE_NOTICE);
    expect(JSON.parse(after.jsonReport).rules['correctness/each-key'].findings).toBe(0);
  });

  it('a malformed file fails the build instead of silently un-gating it', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const p = svelteVitals({ cwd: malformed, ui: false, report: false }) as Plugin;
      await expect(closeBundleOf(p)()).rejects.toThrow(/invalid svelte-vitals-suppressions\.json.*"version": 1/);
      expect(warnSpy.mock.calls.some((args: unknown[]) => String(args[0]).includes('skipped — analysis failed'))).toBe(
        false
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('dev dashboard: svelte-vitals-suppressions.json', () => {
  const finding = (): Result =>
    ({
      ...ENTRY,
      message: 'x',
      category: 'correctness',
      detection: { presence: 'none', value: 'absent' },
      severity: 'warning'
    }) as Result;
  const other = (): Result =>
    ({
      id: 'seo/title-presence',
      route: '/',
      location: 'src/routes/+page.svelte',
      message: 'x',
      category: 'seo',
      detection: { presence: 'none', value: 'absent' },
      severity: 'critical'
    }) as Result;

  async function runOnce(cwd: string): Promise<{ results: Result[]; warnings: string[] }> {
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [finding(), other()], config: defaultConfig }));
    const seen = { results: [] as Result[], warnings: [] as string[] };
    const runner = createAnalysisRunner({
      root: cwd,
      analyze,
      onResults: (results) => (seen.results = results),
      onError: (err) => {
        throw err;
      },
      onWarnings: (w) => (seen.warnings = w)
    });
    runner.start();
    await vi.waitFor(() => expect(seen.results.length).toBeGreaterThan(0));
    runner.stop();
    return seen;
  }

  it('applies source-scan entries to the static layer, skips route-level ones, and says so', async () => {
    // `other()` carries the CLI key ROUTE_ENTRY would match — the live layer would re-surface it on
    // the next visit, so the static layer must not drop it either.
    const cwd = await project(JSON.stringify({ version: 1, suppressions: [ENTRY, ROUTE_ENTRY] }));
    try {
      const seen = await runOnce(cwd);
      expect(seen.results.map((r) => r.id)).toEqual(['seo/title-presence']);
      expect(seen.warnings).toEqual(['1 finding(s) suppressed by svelte-vitals-suppressions.json.', ROUTE_NOTICE]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('warns and keeps every finding when the file is malformed — dev must not go down', async () => {
    const cwd = await project('not json');
    try {
      const seen = await runOnce(cwd);
      expect(seen.results).toHaveLength(2);
      expect(seen.warnings).toHaveLength(1);
      expect(seen.warnings[0]).toMatch(
        /^invalid svelte-vitals-suppressions\.json.*— svelte-vitals-suppressions\.json ignored\.$/
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('re-analyzes when the file changes (--update-suppressions rewrites it)', () => {
    expect(isRelevant(join('/proj', 'svelte-vitals-suppressions.json'), '/proj')).toBe(true);
  });
});
