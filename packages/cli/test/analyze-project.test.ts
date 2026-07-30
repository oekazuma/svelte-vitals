import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyzeProject } from '../src/index.js';
import { ProjectError } from '../src/providers/source/project.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');
const configFileFixtureDir = join(here, 'fixtures', 'config-file-project');
const configFileInvalidFixtureDir = join(here, 'fixtures', 'config-file-invalid-project');
const configFileWarningsFixtureDir = join(here, 'fixtures', 'config-file-warnings');
const minifyDisabledFixtureDir = join(here, 'fixtures', 'minify-disabled-project');
const waterfallProjectFixtureDir = join(here, 'fixtures', 'waterfall-project');
const unitEntryFixtureDir = join(here, 'fixtures', 'unit-entry-project');
const directoryNamingFixtureDir = join(here, 'fixtures', 'directory-naming-project');
const reservedNamesFixtureDir = join(here, 'fixtures', 'reserved-names-project');

describe('analyzeProject', () => {
  it('returns results, config, version and warnings for a SvelteKit project', async () => {
    const { results, config, version, warnings } = await analyzeProject({ cwd: fixtureDir });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'seo/title-presence')).toBe(true);
    expect(config.treatDynamicAs).toBe('pass');
    expect(typeof version).toBe('string');
    // basic-project has no config file, so warnings must stay empty (equivalence regression check).
    expect(warnings).toEqual([]);
  });

  it('respects the route glob filter', async () => {
    const { results } = await analyzeProject({ cwd: fixtureDir, route: 'none' });
    const routes = new Set(results.filter((r) => r.route).map((r) => r.route));
    expect(routes.size).toBeGreaterThan(0);
    for (const route of routes) expect(route).toBe('/none');
  });

  it('throws ProjectError for a non-SvelteKit directory', async () => {
    await expect(analyzeProject({ cwd: here })).rejects.toBeInstanceOf(ProjectError);
  });

  it('applies config-file overrides: seo off under src/routes/(app)/** only (design 2026-07-18)', async () => {
    const { results, config } = await analyzeProject({ cwd: join(here, 'fixtures', 'overrides-project') });
    expect(config.overrides).toEqual([{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]);
    const seoOf = (route: string) => results.filter((r) => r.route === route && (r.category ?? 'seo') === 'seo');
    // (group) segments are dropped from route ids, so the dashboard reports as '/dashboard'.
    // Passing seeds carry no location and so survive a files glob — only penalized
    // findings must be gone (they are what gates CI and drags the score).
    const penalized = (r: { detection: { presence: string; value: string } }) =>
      r.detection.presence === 'none' || r.detection.value === 'absent';
    expect(seoOf('/dashboard').filter(penalized)).toEqual([]);
    expect(seoOf('/public').some((r) => r.id === 'seo/title-presence' && penalized(r))).toBe(true);
  });

  it('flags performance/minify-disabled when vite.config disables minification', async () => {
    const { results } = await analyzeProject({ cwd: minifyDisabledFixtureDir });
    const hit = results.find((r) => r.id === 'performance/minify-disabled');
    expect(hit).toBeDefined();
    expect(hit?.detection.presence).toBe('none');
    expect(hit?.location).toBe('vite.config.ts');
    expect(hit?.line).toBe(5);
    expect(hit?.route).toBeUndefined();
  });

  it('emits no performance/minify-disabled result for a project without the override', async () => {
    const { results } = await analyzeProject({ cwd: fixtureDir });
    expect(results.some((r) => r.id === 'performance/minify-disabled')).toBe(false);
  });

  it('flags performance/load-waterfall and performance/sequential-awaits in a universal load, performance/sequential-awaits only in a server load', async () => {
    const { results } = await analyzeProject({ cwd: waterfallProjectFixtureDir });
    const perf011 = results.filter((r) => r.id === 'performance/load-waterfall' && r.detection.presence === 'none');
    expect(perf011.map((r) => ({ file: r.location, line: r.line }))).toEqual([
      { file: 'src/routes/+page.ts', line: 3 }
    ]);
    const perf013 = results.filter((r) => r.id === 'performance/sequential-awaits' && r.detection.presence === 'none');
    expect(perf013.map((r) => ({ file: r.location, line: r.line }))).toEqual([
      { file: 'src/routes/+page.ts', line: 4 },
      { file: 'src/routes/server/+page.server.ts', line: 4 }
    ]);
  });
});

describe('analyzeProject config-file precedence (design doc 2026-07-05-config-file-design.md §3)', () => {
  it('uses the config file when no flags are passed (file > default)', async () => {
    const { config } = await analyzeProject({ cwd: configFileFixtureDir });
    expect(config.failOn).toBe('warning');
    expect(config.metaComponents).toEqual(['Seo']);
    expect(config.treatDynamicAs).toBe('warn');
    expect(config.rules).toEqual({ 'seo/title-presence': 'off' });
    expect(config.weights).toEqual({ seo: 2 });
  });

  it('lets an explicit option win over the config file (flag > file)', async () => {
    const { config } = await analyzeProject({ cwd: configFileFixtureDir, failOn: 'critical' });
    expect(config.failOn).toBe('critical');
    // Untouched fields still come from the file (per-field independence).
    expect(config.metaComponents).toEqual(['Seo']);
    expect(config.weights).toEqual({ seo: 2 });
  });

  it('lets an explicit weights option replace the file weights as a whole', async () => {
    const { config } = await analyzeProject({ cwd: configFileFixtureDir, weights: { performance: 3 } });
    expect(config.weights).toEqual({ performance: 3 });
  });

  it('seo/title-presence is disabled by the file, changing findings vs the same project without the config file', async () => {
    const { results } = await analyzeProject({ cwd: configFileFixtureDir });
    expect(results.some((r) => r.id === 'seo/title-presence')).toBe(false);
  });

  it('rejects an unknown rule id in the file rules, listing known rule ids', async () => {
    await expect(analyzeProject({ cwd: configFileInvalidFixtureDir })).rejects.toThrow(
      /unknown rule id\(s\) in rules: NOPE999.*Known rule ids:/s
    );
  });

  // The source-file inventory (design 2026-07-28) is the only fact no rule can rebuild for itself,
  // so nothing but an end-to-end run proves it reaches the RuleContext.
  it('collects the source-file inventory and runs a directory-shaped Architecture rule over it', async () => {
    const { results } = await analyzeProject({ cwd: unitEntryFixtureDir });
    const found = results.filter((r) => r.id === 'architecture/unit-entry-file');
    expect(found).toHaveLength(1);
    expect(found[0]!.location).toBe('src/lib/Card/index.svelte');
    expect(found[0]!.message).toContain('src/lib/Card/Card.svelte');
  });

  it('runs architecture/directory-naming over the collected inventory', async () => {
    const { results } = await analyzeProject({ cwd: directoryNamingFixtureDir });
    const found = results.filter((r) => r.id === 'architecture/directory-naming');
    expect(found).toHaveLength(1);
    // `route` is the directory, `location` a file inside it (see the rule's comment on why the two differ).
    expect(found[0]!.route).toBe('src/lib/Price_Table');
    expect(found[0]!.location).toBe('src/lib/Price_Table/index.ts');
    expect(found[0]!.message).toContain('camelCase');
  });

  it('runs architecture/reserved-directory-names over the collected inventory', async () => {
    const { results } = await analyzeProject({ cwd: reservedNamesFixtureDir });
    const found = results.filter((r) => r.id === 'architecture/reserved-directory-names');
    expect(found).toHaveLength(1);
    expect(found[0]!.route).toBe('src/lib/Card/helpers');
    expect(found[0]!.location).toBe('src/lib/Card/helpers/format.ts');
  });

  it('leaves the inventory unbuilt for a --route run, so directory-shaped rules stay silent', async () => {
    // A single route says nothing about the shape of the tree, and a partial inventory would call
    // every unexamined declaration inert. The rule is deliberately given nothing rather than a
    // subset, so the run emits no unit-entry findings at all — not even the inert-declaration one.
    const { results } = await analyzeProject({ cwd: unitEntryFixtureDir, route: 'other' });
    expect(results.filter((r) => r.id === 'architecture/unit-entry-file')).toEqual([]);
  });

  it('surfaces config-file warnings (invalid enum value, unknown top-level key) without throwing', async () => {
    const { warnings, config } = await analyzeProject({ cwd: configFileWarningsFixtureDir });
    expect(warnings.some((w) => w.includes("unknown treatDynamicAs 'nope'"))).toBe(true);
    expect(warnings.some((w) => w.includes("unknown config key 'someFutureOption'"))).toBe(true);
    // The invalid field is dropped, so it falls through to the default.
    expect(config.treatDynamicAs).toBe('pass');
  });
});
