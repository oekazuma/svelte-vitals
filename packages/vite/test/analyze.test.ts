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
    // a component with an unkeyed {#each} (correctness/each-key), for the component-scope wiring test
    await mkdir(join(cwd, 'src/lib'), { recursive: true });
    await writeFile(join(cwd, 'src/lib/List.svelte'), '{#each items as item}<li>{item}</li>{/each}');
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('runs all rules over rendered routes and computes a score', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(r.routeCount).toBe(2);
    // /bad is missing <title> (critical) -> headline capped at 79
    expect(r.score).toBeLessThanOrEqual(79);
    expect(
      r.results.some((x) => x.id === 'seo/title-presence' && x.route === '/bad' && x.detection.presence === 'none')
    ).toBe(true);
    // html lang present (en) -> seo/html-lang not a site issue
    const json = JSON.parse(r.jsonReport);
    expect(json.siteIssues.map((i: { id: string }) => i.id)).not.toContain('seo/html-lang');
    // console report must carry the plugin-mode label and not the static-mode label
    expect(r.consoleReport).toContain('Svelte Vitals  ·  rendered / plugin');
    expect(r.consoleReport).not.toContain('static mode');
  });

  it('lists a selected rule in the json report even when it produced no results for this fixture', async () => {
    const r = await analyze(pages, cwd, { report: false });
    const parsed = JSON.parse(r.jsonReport);
    // Nothing in this fixture triggers security/raw-html, so it has no entries in `results` —
    // it appears in `rules` only because analyze passed the selected ids as the seed list.
    expect(Object.hasOwn(parsed.rules, 'security/raw-html')).toBe(true);
    expect(parsed.rules['security/raw-html']).toEqual({ findings: 0, passed: 0 });
  });

  it('fails when findings meet failOn', async () => {
    const r = await analyze(pages, cwd, { report: false, failOn: 'critical' });
    expect(r.failed).toBe(true);
  });

  it('also runs component-scoped rules against .svelte source under src/', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(
      r.results.some(
        (x) =>
          x.id === 'correctness/each-key' && x.location === 'src/lib/List.svelte' && x.detection.presence === 'none'
      )
    ).toBe(true);
    expect(r.consoleReport).toContain('Scanned 1 component(s) under src/');
  });

  it('threads a resolved minify-disabled fact into performance/minify-disabled', async () => {
    const r = await analyze(pages, cwd, { report: false }, { viteMinifyDisabled: { file: 'vite.config.ts', line: 3 } });
    const hit = r.results.find((x) => x.id === 'performance/minify-disabled');
    expect(hit).toBeDefined();
    expect(hit?.location).toBe('vite.config.ts');
    expect(hit?.line).toBe(3);

    const clean = await analyze(pages, cwd, { report: false });
    expect(clean.results.some((x) => x.id === 'performance/minify-disabled')).toBe(false);
  });
});

describe('analyze — a11y (rendered-mode collection wired into ctx.a11y)', () => {
  let cwd: string;
  let pages: string;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-analyze-a11y-'));
    pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    await writeFile(
      join(pages, 'index.html'),
      '<html lang="en"><head><title>Home</title><meta name="description" content="d"/></head><body>' +
        '<label for="ghost">Name</label>' +
        '</body></html>'
    );
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('reports a11y/no-missing-id-ref for a <label for> with no matching id anywhere', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(
      r.results.some((x) => x.id === 'a11y/no-missing-id-ref' && x.route === '/' && x.detection.presence === 'none')
    ).toBe(true);
  });
});

describe('analyze — kit alias wiring (project.kitAliases -> collectKitModuleFacts)', () => {
  // Mirrors the CLI's kit-alias-e2e.test.ts: security/shared-state-import is inert for an
  // alias-only import until analyze() actually threads project.kitAliases through to the
  // kit-module collector, so a finding here is evidence the wiring at analyze.ts:71 runs,
  // not just that the two functions type-check together.
  async function makeAliasProject(aliasDeclared: boolean) {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-analyze-alias-'));
    const pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    await writeFile(
      join(pages, 'index.html'),
      `<html lang="en"><head><title>Home</title><meta name="description" content="d"/></head><body></body></html>`
    );
    await writeFile(
      join(cwd, 'svelte.config.js'),
      aliasDeclared ? `export default { kit: { alias: { '$data': 'src/data' } } };\n` : `export default { kit: {} };\n`
    );
    await mkdir(join(cwd, 'src/data'), { recursive: true });
    await writeFile(join(cwd, 'src/data/cart.svelte.ts'), `export const items = $state([]);\n`);
    await mkdir(join(cwd, 'src/routes'), { recursive: true });
    await writeFile(
      join(cwd, 'src/routes/+page.server.ts'),
      `import { items } from '$data/cart.svelte';\nexport function load() {\n  return { count: items.length };\n}\n`
    );
    return { cwd, pages };
  }

  it('reports a shared-state import that arrives through a declared alias', async () => {
    const { cwd, pages } = await makeAliasProject(true);
    try {
      const r = await analyze(pages, cwd, { report: false });
      expect(
        r.results.some((x) => x.id === 'security/shared-state-import' && x.location === 'src/routes/+page.server.ts')
      ).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('reports nothing for the same tree when the alias is not declared (negative control)', async () => {
    const { cwd, pages } = await makeAliasProject(false);
    try {
      const r = await analyze(pages, cwd, { report: false });
      expect(r.results.some((x) => x.id === 'security/shared-state-import')).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
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
    // missing <title> -> seo/title-presence -- used to check `rules` from the config file is honored.
    await writeFile(
      join(pages, 'index.html'),
      `<html lang="en"><head><meta name="description" content="d"/></head><body></body></html>`
    );
    await writeFile(join(cwd, 'svelte-vitals.config.js'), configContent);
    return { cwd, pages };
  }

  it('honors rules/weights/failOn from svelte-vitals.config.js when no plugin option overrides them', async () => {
    const { cwd, pages } = await makeProject(
      `export default {
        rules: { 'seo/title-presence': 'off' },
        weights: { seo: 5 },
        failOn: 'info'
      };\n`
    );
    try {
      const r = await analyze(pages, cwd, { report: false });
      // seo/title-presence disabled by the config file -> no finding for the missing <title>.
      expect(r.results.some((x) => x.id === 'seo/title-presence')).toBe(false);
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

  // The build-mode analysis is the second of the two report-producing callers. `examined` is optional
  // at every hop from `runRules` to `formatJsonReport`, so dropping the argument here would compile
  // and leave every other assertion in this file green.
  it('carries the examined counts into the JSON report it builds', async () => {
    const { cwd, pages } = await makeProject(
      `export default {
        rules: {
          'architecture/reserved-name-placement': {
            options: { capitalisedUnitPlacements: { parts: 'src/**' } }
          }
        }
      };\n`
    );
    try {
      // Two `parts/` directories judged: one under a capitalised unit, one not.
      await mkdir(join(cwd, 'src/lib/Card/parts'), { recursive: true });
      await mkdir(join(cwd, 'src/lib/other/parts'), { recursive: true });
      await writeFile(join(cwd, 'src/lib/Card/Card.svelte'), '<p>card</p>');
      await writeFile(join(cwd, 'src/lib/Card/parts/a.svelte'), '<p>a</p>');
      await writeFile(join(cwd, 'src/lib/other/parts/b.svelte'), '<p>b</p>');

      const r = await analyze(pages, cwd, { report: false });
      const json = JSON.parse(r.jsonReport);
      expect(json.examined['architecture/reserved-name-placement']).toEqual({
        'capitalisedUnitPlacements.parts → src/**': 2
      });
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
      expect(r.results.some((x) => x.id === 'seo/title-presence')).toBe(false);
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

  it('notices an enabled a11y/unverified-id-ref: structurally inert in rendered mode', async () => {
    const { cwd, pages } = await makeProject(`export default { rules: { 'a11y/unverified-id-ref': 'info' } };\n`);
    try {
      const r = await analyze(pages, cwd, { report: false });
      expect(r.warnings.some((w) => w.includes('a11y/unverified-id-ref has no effect in rendered mode'))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('no notice when the rule is not enabled', async () => {
    const { cwd, pages } = await makeProject(`export default {};\n`);
    try {
      const r = await analyze(pages, cwd, { report: false });
      expect(r.warnings.some((w) => w.includes('unverified-id-ref'))).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
