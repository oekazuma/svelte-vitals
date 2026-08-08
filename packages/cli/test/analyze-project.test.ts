import { describe, it, expect, vi, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Mock the git layer so the --diff scope below is testable without a real repo (mirrors
// run-diff.test.ts). Only the test in the "examined counts" describe block below touches this.
vi.mock('../src/changed-files.js', async (orig) => {
  const actual = await orig<typeof import('../src/changed-files.js')>();
  return { ...actual, getChangedFiles: vi.fn() };
});

import { analyzeProject, applyScope } from '../src/index.js';
import { getChangedFiles } from '../src/changed-files.js';
import { ProjectError } from '../src/providers/source/project.js';
import { parseRunArgs, resolveArgs } from '../src/resolve-args.js';

const mockGetChangedFiles = vi.mocked(getChangedFiles);

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
const rulesFlagConfigFixtureDir = join(here, 'fixtures', 'rules-flag-config-project');
const deadDeclarationFixtureDir = join(here, 'fixtures', 'dead-declaration-project');
const reservedNamePlacementFixtureDir = join(here, 'fixtures', 'reserved-name-placement-project');

// `architecture/component-size` (a componentRule) seeds a PASS result for every applicable
// component in addition to a PENALIZED one for a violation, so a plain id filter can't tell
// "fired with the file's max: 3" from "fired with the built-in default of 200" — both leave
// component-size present in `results`, just with different `detection`. Only the penalized
// shape pins the option actually being honoured.
const penalizedComponentSize = (results: { id: string; detection: { presence: string; value: string } }[]) =>
  results.filter((r) => r.id === 'architecture/component-size' && r.detection.presence === 'none');

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

// `rules-flag-config-project`'s config file declares options for two otherwise-inert/high-default
// rules: `architecture/component-size` (max: 3, well under Big.svelte's line count but far below
// the built-in default of 200) and `architecture/directory-naming` (declares `src/lib/**` must be
// camelCase, which `Price_Table` violates; the rule is inert without a `directories` declaration
// at all). These tests go through `resolveArgs` — the real --rules/--ignore parsing path, not just
// `analyzeProject`'s composition — so they pin the actual CLI flag behavior (design:
// rules-flag-clobbers-config-options), not just a hand-built options object.
describe("--rules/--ignore compose with a config file's per-rule options (design: rules-flag-clobbers-config-options)", () => {
  /** Parse argv the same way bin.ts does, resolve it, and assert no fatal errors along the way. */
  function optionsFor(...args: string[]) {
    const { options, errors } = resolveArgs(parseRunArgs(args));
    expect(errors).toEqual([]);
    return options!;
  }

  // Test 1 — the bug, directly: an --ignore naming an unrelated rule must not touch any other
  // rule's config-file options.
  it("--ignore of an unrelated rule keeps every other rule's options", async () => {
    const options = optionsFor('--ignore', 'seo/title-presence');
    const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
    expect(penalizedComponentSize(results)).toHaveLength(1);
    expect(results.filter((r) => r.id === 'architecture/directory-naming')).toHaveLength(1);
  });

  // Test 2 — --ignore still silences the rule it names, even though the file gives it options.
  it('--ignore still silences the rule it names, even when the config file enables it with options', async () => {
    const options = optionsFor('--ignore', 'architecture/directory-naming');
    const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
    expect(results.filter((r) => r.id === 'architecture/directory-naming')).toEqual([]);
    // Silencing directory-naming must not disturb component-size's options.
    expect(penalizedComponentSize(results)).toHaveLength(1);
  });

  // Test 3 — regression guard for the discarded mechanism (a plain `{ ...file.rules, ...opts.rules }`
  // merge): --rules must still force-enable a rule the config file turns off, since `'off'` is
  // selection and a selection flag overrides it. `config-file-project`'s file sets
  // `'seo/title-presence': 'off'`; naming it in --rules must override that.
  it('--rules still force-enables a rule that the config file sets to off', async () => {
    const options = optionsFor('--rules', 'seo/title-presence');
    const { results } = await analyzeProject({ ...options, cwd: configFileFixtureDir });
    expect(results.some((r) => r.id === 'seo/title-presence')).toBe(true);
  });

  // Test 4 — --rules still disables every rule not named (assert on the id set, not a count).
  it('--rules still disables every rule not named', async () => {
    const options = optionsFor('--rules', 'architecture/component-size');
    const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
    expect(new Set(results.map((r) => r.id))).toEqual(new Set(['architecture/component-size']));
  });

  // Test 5 — both flags together: deny wins for the rule named by both, so this test pins only the
  // set of rule ids that ran. That a rule --rules names keeps its file-declared options is pinned
  // by the tests below.
  it('--rules A,B --ignore B leaves only A running (deny wins)', async () => {
    const options = optionsFor(
      '--rules',
      'seo/title-presence,architecture/directory-naming',
      '--ignore',
      'architecture/directory-naming'
    );
    const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
    expect(new Set(results.map((r) => r.id))).toEqual(new Set(['seo/title-presence']));
    expect(results.some((r) => r.id === 'seo/title-presence' && r.detection.presence === 'none')).toBe(true);
  });

  it('runs a rule named by --rules with the options the config file declared', async () => {
    const options = optionsFor('--rules', 'architecture/component-size');
    const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
    expect(penalizedComponentSize(results)).toHaveLength(1);
  });

  it('wakes an L3 rule named by --rules using the config file declaration', async () => {
    const options = optionsFor('--rules', 'architecture/directory-naming');
    const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
    expect(results.filter((r) => r.id === 'architecture/directory-naming')).toHaveLength(1);
  });

  it('restores the self-diagnostic a discarded declaration silenced', async () => {
    // The field's report: the defect was doubly silent. The rule reported nothing AND the
    // aggregated "this declaration does not check what it says" finding disappeared with it,
    // because a discarded options map leaves no declaration to diagnose. So a dead glob and a
    // complying tree looked identical — the exact reading the charter's inverse-precision gate
    // exists to prevent. Uses its own fixture, whose config declares a glob matching nothing.
    const options = optionsFor('--rules', 'architecture/reserved-name-placement');
    const { results } = await analyzeProject({ ...options, cwd: deadDeclarationFixtureDir });
    const projectScoped = results.filter((r) => r.route === undefined && r.location === undefined);
    expect(projectScoped).toHaveLength(1);
    expect(projectScoped[0]?.message).toContain('matched no directory');
  });

  it('lets --ignore beat --rules when both name the same rule', async () => {
    const options = optionsFor('--rules', 'architecture/component-size', '--ignore', 'architecture/component-size');
    const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
    expect(results.filter((r) => r.id === 'architecture/component-size')).toEqual([]);
  });
});

describe('allowRules keeps the named rules configured', () => {
  it('runs a named rule with the config file options it declared', async () => {
    const { results } = await analyzeProject({
      cwd: rulesFlagConfigFixtureDir,
      allowRules: ['architecture/component-size']
    });
    expect(penalizedComponentSize(results)).toHaveLength(1);
  });

  it('narrows to the named rule only', async () => {
    const { results } = await analyzeProject({
      cwd: rulesFlagConfigFixtureDir,
      allowRules: ['architecture/component-size']
    });
    expect([...new Set(results.map((r) => r.id))]).toEqual(['architecture/component-size']);
  });

  it('lets an explicit rules map still replace the file map as a whole', async () => {
    const { config } = await analyzeProject({
      cwd: rulesFlagConfigFixtureDir,
      rules: { 'seo/title-presence': 'off' }
    });
    expect(config.rules).toEqual({ 'seo/title-presence': 'off' });
  });
});

// A rule named in --rules that a config `overrides` entry scopes 'off' for some paths used to
// report nothing there, silently (issue #385). Part 1 only breaks the silence with a warning —
// the results themselves are unaffected (overrides still apply exactly as before the fix).
describe('allowRules named a rule that overrides scopes off warns without changing results (issue #385)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  /** A throwaway copy of basic-project with the given config file content written into it. */
  function projectWithConfig(configSource: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-overrides-warning-'));
    dirs.push(dir);
    cpSync(fixtureDir, dir, { recursive: true });
    writeFileSync(join(dir, 'svelte-vitals.config.mjs'), configSource);
    return dir;
  }

  it('warns when a rule-id key scopes the --rules-named rule off, and leaves results unaffected', async () => {
    const dir = projectWithConfig(
      "export default { overrides: [{ files: 'src/**', rules: { 'seo/title-presence': 'off' } }] };"
    );
    const { results, warnings } = await analyzeProject({ cwd: dir, allowRules: ['seo/title-presence'] });
    expect(
      warnings.some(
        (w) =>
          w.includes("--rules 'seo/title-presence' is scoped 'off' by overrides entry") && w.includes("files: 'src/**'")
      )
    ).toBe(true);
    // Overrides still remove every seo/title-presence result under src/** (unchanged semantics).
    expect(results.filter((r) => r.id === 'seo/title-presence')).toEqual([]);
  });

  it('warns when a category key scopes the --rules-named rule off (rule id beats category, but category still applies when the rule id key is absent)', async () => {
    // overrides-project's config sets the `seo` category off under src/routes/(app)/**.
    const { warnings } = await analyzeProject({
      cwd: join(here, 'fixtures', 'overrides-project'),
      allowRules: ['seo/title-presence']
    });
    expect(
      warnings.some(
        (w) =>
          w.includes("--rules 'seo/title-presence' is scoped 'off' by overrides entry") &&
          w.includes("files: 'src/routes/(app)/**'")
      )
    ).toBe(true);
  });

  it('does not warn when the overrides entry scopes off a different rule', async () => {
    const dir = projectWithConfig(
      "export default { overrides: [{ files: 'src/**', rules: { 'seo/description-presence': 'off' } }] };"
    );
    const { warnings } = await analyzeProject({ cwd: dir, allowRules: ['seo/title-presence'] });
    expect(warnings).toEqual([]);
  });

  it('does not warn when the overrides entry sets a severity (not off) for the named rule', async () => {
    const dir = projectWithConfig(
      "export default { overrides: [{ files: 'src/**', rules: { 'seo/title-presence': 'warning' } }] };"
    );
    const { warnings } = await analyzeProject({ cwd: dir, allowRules: ['seo/title-presence'] });
    expect(warnings).toEqual([]);
  });

  it('does not warn when no --rules is given at all, even with a matching overrides entry present', async () => {
    const { warnings } = await analyzeProject({ cwd: join(here, 'fixtures', 'overrides-project') });
    expect(warnings).toEqual([]);
  });
});

describe('examined counts survive --diff scoping (examined-counts design, "It is not filtered")', () => {
  // `analyzeProject` returns `examined` before any scope is applied — `--diff`/`--staged`/`--baseline`
  // narrow `results` only, via the separate `applyScope` step. This pins that decoupling at the
  // CLI level: three `parts/` directories are judged (one permitted, two violations), and scoping
  // the results down to a single changed file must leave the count at the full 3, not fall to 1.
  it('reports the full count while --diff narrows the results to one changed file', async () => {
    mockGetChangedFiles.mockReturnValue(new Set(['src/lib/other/parts/b.svelte']));

    const { results, examined, config } = await analyzeProject({ cwd: reservedNamePlacementFixtureDir });
    const violations = results.filter((r) => r.id === 'architecture/reserved-name-placement' && r.route !== undefined);
    expect(violations).toHaveLength(2); // other/parts and legacy/parts
    expect(examined['architecture/reserved-name-placement']?.['capitalisedUnitPlacements.parts → src/**']).toBe(3);

    // `applyScope`'s signature takes and returns only `Result[]` — it never sees `examined` at all,
    // so the count asserted above is already the whole proof: it was read from `analyzeProject`'s
    // return before this call and nothing here could have changed it. What this narrows is `results`.
    const scoped = await applyScope(results, { cwd: reservedNamePlacementFixtureDir, config, diffBase: 'HEAD' });
    const scopedViolations = scoped.filter(
      (r) => r.id === 'architecture/reserved-name-placement' && r.route !== undefined
    );
    expect(scopedViolations).toHaveLength(1); // only other/parts' file is "changed"
  });
});
