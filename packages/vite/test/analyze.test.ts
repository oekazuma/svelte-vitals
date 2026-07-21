import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze } from '../src/analyze.js';

describe('analyze', () => {
  let cwd: string;
  let pages: string;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-analyze-'));
    pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    // one good page, one missing title
    await writeFile(
      join(pages, 'index.html'),
      `<html lang="en"><head><title>Home</title><meta name="description" content="d"/></head><body></body></html>`
    );
    await writeFile(
      join(pages, 'bad.html'),
      `<html lang="en"><head><meta charset="utf-8"/></head><body></body></html>`
    );
    // a component with an unkeyed {#each} (CORRECT001), for the component-scope wiring test
    await mkdir(join(cwd, 'src/lib'), { recursive: true });
    await writeFile(join(cwd, 'src/lib/List.svelte'), '{#each items as item}<li>{item}</li>{/each}');
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('runs all rules over rendered routes and computes a score', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(r.routeCount).toBe(2);
    // /bad is missing <title> (critical) -> headline capped at 79
    expect(r.score).toBeLessThanOrEqual(79);
    expect(r.results.some((x) => x.id === 'SEO001' && x.route === '/bad' && x.detection.presence === 'none')).toBe(
      true
    );
    // html lang present (en) -> SEO009 not a site issue
    const json = JSON.parse(r.jsonReport);
    expect(json.siteIssues.map((i: { id: string }) => i.id)).not.toContain('SEO009');
    // console report must carry the plugin-mode label and not the static-mode label
    expect(r.consoleReport).toContain('Svelte Vitals  ·  rendered / plugin');
    expect(r.consoleReport).not.toContain('static mode');
  });

  it('fails when findings meet failOn', async () => {
    const r = await analyze(pages, cwd, { report: false, failOn: 'critical' });
    expect(r.failed).toBe(true);
  });

  it('also runs component-scoped rules against .svelte source under src/', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(
      r.results.some(
        (x) => x.id === 'CORRECT001' && x.location === 'src/lib/List.svelte' && x.detection.presence === 'none'
      )
    ).toBe(true);
    expect(r.consoleReport).toContain('Scanned 1 component(s) under src/');
  });

  it('threads a resolved minify-disabled fact into PERF012', async () => {
    const r = await analyze(pages, cwd, { report: false }, { viteMinifyDisabled: { file: 'vite.config.ts', line: 3 } });
    const hit = r.results.find((x) => x.id === 'PERF012');
    expect(hit).toBeDefined();
    expect(hit?.location).toBe('vite.config.ts');
    expect(hit?.line).toBe(3);

    const clean = await analyze(pages, cwd, { report: false });
    expect(clean.results.some((x) => x.id === 'PERF012')).toBe(false);
  });
});

describe('analyze — svelte-vitals.config.*', () => {
  // Each test gets its own temp project (rather than sharing one cwd and rewriting the same
  // config file path across tests): Node's ESM loader caches a dynamic import() by URL, so
  // reusing one absolute path across tests would silently return a stale config from an
  // earlier test instead of re-reading the file each time.
  async function makeProject(configContent: string) {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-analyze-config-'));
    const pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    // missing <title> -> SEO001 -- used to check `rules` from the config file is honored.
    await writeFile(
      join(pages, 'index.html'),
      `<html lang="en"><head><meta name="description" content="d"/></head><body></body></html>`
    );
    await writeFile(join(cwd, 'svelte-vitals.config.mjs'), configContent);
    return { cwd, pages };
  }

  it('honors rules/weights/failOn from svelte-vitals.config.mjs when no plugin option overrides them', async () => {
    const { cwd, pages } = await makeProject(
      `export default {
        rules: { SEO001: 'off' },
        weights: { seo: 5 },
        failOn: 'info'
      };\n`
    );
    try {
      const r = await analyze(pages, cwd, { report: false });
      // SEO001 disabled by the config file -> no finding for the missing <title>.
      expect(r.results.some((x) => x.id === 'SEO001')).toBe(false);
      // weights flow into the emitted JSON report (config.weights, per buildJsonReport/computeHealth).
      const json = JSON.parse(r.jsonReport);
      expect(json.weights.seo).toBe(5);
      // failOn: 'info' from the config file, unset by any plugin option.
      expect(r.failOn).toBe('info');
      expect(r.warnings).toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('an explicit plugin option wins over the config file for the same field', async () => {
    const { cwd, pages } = await makeProject(`export default { failOn: 'info' };\n`);
    try {
      const r = await analyze(pages, cwd, { report: false, failOn: 'critical' });
      expect(r.failOn).toBe('critical');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('applies route-scoped overrides from the config file to rendered results (design 2026-07-18)', async () => {
    const { cwd, pages } = await makeProject(
      `export default { overrides: [{ route: '/', rules: { seo: 'off' } }] };\n`
    );
    try {
      const r = await analyze(pages, cwd, { report: false });
      expect(r.results.some((x) => x.id === 'SEO001')).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('surfaces non-fatal config-file warnings (e.g. an unrecognized failOn value)', async () => {
    const { cwd, pages } = await makeProject(`export default { failOn: 'nope' };\n`);
    try {
      const r = await analyze(pages, cwd, { report: false });
      expect(r.warnings.length).toBeGreaterThan(0);
      expect(r.warnings[0]).toContain('failOn');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
