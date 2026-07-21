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

describe('analyzeProject', () => {
  it('returns results, config, version and warnings for a SvelteKit project', async () => {
    const { results, config, version, warnings } = await analyzeProject({ cwd: fixtureDir });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'SEO001')).toBe(true);
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
    expect(seoOf('/public').some((r) => r.id === 'SEO001' && penalized(r))).toBe(true);
  });

  it('flags PERF012 when vite.config disables minification', async () => {
    const { results } = await analyzeProject({ cwd: minifyDisabledFixtureDir });
    const hit = results.find((r) => r.id === 'PERF012');
    expect(hit).toBeDefined();
    expect(hit?.detection.presence).toBe('none');
    expect(hit?.location).toBe('vite.config.ts');
    expect(hit?.line).toBe(5);
    expect(hit?.route).toBeUndefined();
  });

  it('emits no PERF012 result for a project without the override', async () => {
    const { results } = await analyzeProject({ cwd: fixtureDir });
    expect(results.some((r) => r.id === 'PERF012')).toBe(false);
  });
});

describe('analyzeProject config-file precedence (design doc 2026-07-05-config-file-design.md §3)', () => {
  it('uses the config file when no flags are passed (file > default)', async () => {
    const { config } = await analyzeProject({ cwd: configFileFixtureDir });
    expect(config.failOn).toBe('warning');
    expect(config.metaComponents).toEqual(['Seo']);
    expect(config.treatDynamicAs).toBe('warn');
    expect(config.rules).toEqual({ SEO001: 'off' });
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

  it('SEO001 is disabled by the file, changing findings vs the same project without the config file', async () => {
    const { results } = await analyzeProject({ cwd: configFileFixtureDir });
    expect(results.some((r) => r.id === 'SEO001')).toBe(false);
  });

  it('rejects an unknown rule id in the file rules, listing known rule ids', async () => {
    await expect(analyzeProject({ cwd: configFileInvalidFixtureDir })).rejects.toThrow(
      /unknown rule id\(s\) in rules: NOPE999.*Known rule ids:/s
    );
  });

  it('surfaces config-file warnings (invalid enum value, unknown top-level key) without throwing', async () => {
    const { warnings, config } = await analyzeProject({ cwd: configFileWarningsFixtureDir });
    expect(warnings.some((w) => w.includes("unknown treatDynamicAs 'nope'"))).toBe(true);
    expect(warnings.some((w) => w.includes("unknown config key 'someFutureOption'"))).toBe(true);
    // The invalid field is dropped, so it falls through to the default.
    expect(config.treatDynamicAs).toBe('pass');
  });
});
