import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Every disable/suppress surface, exercised against the real gallery: a surface that stops
// working (the a11y-category inline-directive regression was exactly this class) fails here,
// not in a user's CI. The gallery itself stays untouched — each surface runs on a scratch copy
// so the detection expectations in expected-findings.json are never confused with suppression.
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(appDir, '..', '..', 'packages', 'cli', 'dist', 'bin.js');

interface JsonReport {
  rules: Record<string, { findings: number; passed: number }>;
  routes: Array<{ route: string; issues: Array<{ id: string; severity: string }> }>;
  siteIssues: Array<{ id: string; severity: string }>;
}

function run(dir: string, ...args: string[]): { code: number; stderr: string; report: JsonReport } {
  const res = spawnSync(process.execPath, [bin, dir, ...args, '--reporter', 'json'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  return { code: res.status ?? 1, stderr: res.stderr, report: JSON.parse(res.stdout) };
}

const findings = (r: JsonReport, id: string) => r.rules[id]?.findings ?? 0;
const passed = (r: JsonReport, id: string) => r.rules[id]?.passed ?? 0;

/** Write `src` with a directive inserted above `anchor`'s first occurrence. */
function disableAbove(file: string, anchor: string, ids = ''): void {
  const src = readFileSync(file, 'utf8');
  if (!src.includes(anchor)) throw new Error(`anchor gone from ${file}: ${anchor}`);
  writeFileSync(file, src.replace(anchor, `<!-- svelte-vitals-disable-next-line ${ids} -->\n${anchor}`));
}
const totalFindings = (r: JsonReport) => Object.values(r.rules).reduce((n, v) => n + v.findings, 0);
const issuesOn = (r: JsonReport, routePrefix: string, idPrefix: string) =>
  r.routes
    .filter((rt) => rt.route.startsWith(routePrefix))
    .flatMap((rt) => rt.issues)
    .filter((i) => i.id.startsWith(idPrefix)).length;

/** Scratch copy of the example (node_modules symlinked) so a surface can edit files freely. */
function scratchCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kitchen-sink-suppress-'));
  cpSync(appDir, dir, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|\.svelte-kit|build)([\\/]|$)/.test(src)
  });
  symlinkSync(join(appDir, 'node_modules'), join(dir, 'node_modules'), 'dir');
  return dir;
}

let baseline: JsonReport;
const scratch: string[] = [];

beforeAll(() => {
  baseline = run(appDir).report;
});
afterAll(() => {
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

describe('kitchen-sink e2e (suppression surfaces)', () => {
  it('has a baseline with findings to suppress', () => {
    expect(findings(baseline, 'a11y/invalid-role')).toBeGreaterThan(0);
    expect(findings(baseline, 'seo/title-presence')).toBeGreaterThan(0);
  });

  it('--ignore drops the rule from the run', () => {
    const { report } = run(appDir, '--ignore', 'a11y/invalid-role');
    expect(report.rules['a11y/invalid-role']).toBeUndefined();
    expect(totalFindings(report)).toBe(totalFindings(baseline) - findings(baseline, 'a11y/invalid-role'));
  });

  it('--rules keeps only the allow-listed rule', () => {
    const { report } = run(appDir, '--rules', 'seo/title-presence');
    expect(Object.keys(report.rules)).toEqual(['seo/title-presence']);
    expect(findings(report, 'seo/title-presence')).toBe(findings(baseline, 'seo/title-presence'));
  });

  it('--category restricts the run to that category and its exit code', () => {
    const { code, report } = run(appDir, '--category', 'a11y');
    expect(Object.keys(report.rules).every((id) => id.startsWith('a11y/'))).toBe(true);
    // No a11y rule is critical, so the gallery's critical findings elsewhere no longer gate.
    expect(code).toBe(0);
  });

  it('--fail-on and --min-health move the exit-code gate', () => {
    expect(run(appDir, '--fail-on', 'warning').code).toBe(1);
    expect(run(appDir, '--min-health', '1').code).toBe(1);
  });

  it("config rules: 'off', a severity override, and a route-scoped override all apply", () => {
    const dir = scratchCopy();
    scratch.push(dir);
    const cfgPath = join(dir, 'svelte-vitals.config.ts');
    let cfg = readFileSync(cfgPath, 'utf8');
    cfg = cfg.replace('rules: {', "rules: {\n    'a11y/invalid-role': 'off',\n    'seo/title-presence': 'warning',");
    cfg = cfg.replace(
      'export default {',
      "export default {\n  overrides: [{ route: '/gallery/a11y/**', rules: { a11y: 'off' } }],"
    );
    writeFileSync(cfgPath, cfg);
    const { report } = run(dir);
    expect(findings(report, 'a11y/invalid-role')).toBe(0);
    const titles = report.routes.flatMap((rt) => rt.issues).filter((i) => i.id === 'seo/title-presence');
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every((i) => i.severity === 'warning')).toBe(true);
    expect(issuesOn(report, '/gallery/a11y', 'a11y/')).toBe(0);
    // Other categories on those routes are untouched by a category-scoped override.
    expect(issuesOn(baseline, '/gallery/a11y', 'a11y/')).toBeGreaterThan(0);
  });

  it('an inline directive suppresses exactly its line, including for a11y/* ids', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    const page = join(dir, 'src', 'routes', 'gallery', 'a11y', 'aria', '+page.svelte');
    const src = readFileSync(page, 'utf8');
    expect(src).toContain('<div role="bogus">');
    writeFileSync(
      page,
      src.replace(
        '<div role="bogus">',
        '<!-- svelte-vitals-disable-next-line a11y/invalid-role -->\n<div role="bogus">'
      )
    );
    const { report } = run(dir);
    // The bogus role is silenced; the abstract-role arm on the following element still fires.
    expect(findings(report, 'a11y/invalid-role')).toBe(findings(baseline, 'a11y/invalid-role') - 1);
  });

  it('silences the spec-data rules, including a deprecated attribute on a multi-line start tag', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    const page = join(dir, 'src', 'routes', 'gallery', 'a11y', 'legacy', '+page.svelte');
    let src = readFileSync(page, 'utf8');
    // The finding is anchored at the start tag, so the directive above a tag that spans lines works.
    src = src.replace(
      '<iframe src="/clean" frameborder="0" title="Embedded page"></iframe>',
      '<!-- svelte-vitals-disable-next-line a11y/deprecated-attr -->\n<iframe\n  src="/clean"\n  frameborder="0"\n  title="Embedded page"\n></iframe>'
    );
    src = src.replace('<p><strike>', '<!-- svelte-vitals-disable-next-line a11y/deprecated-element -->\n<p><strike>');
    writeFileSync(page, src);
    const { report } = run(dir);
    expect(findings(report, 'a11y/deprecated-attr')).toBe(findings(baseline, 'a11y/deprecated-attr') - 1);
    expect(findings(report, 'a11y/deprecated-element')).toBe(findings(baseline, 'a11y/deprecated-element') - 1);
  });

  it('silences the ARIA role-table rules, including on a multi-line start tag', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    const page = join(dir, 'src', 'routes', 'gallery', 'a11y', 'aria', '+page.svelte');
    let src = readFileSync(page, 'utf8');
    src = src.replace(
      '<div role="button" tabindex="0" aria-checked="true">Toggle</div>',
      '<!-- svelte-vitals-disable-next-line a11y/disallowed-aria-props -->\n<div\n  role="button"\n  tabindex="0"\n  aria-checked="true"\n>Toggle</div>'
    );
    src = src.replace(
      '<div aria-grabbed="true">',
      '<!-- svelte-vitals-disable-next-line a11y/deprecated-aria -->\n<div aria-grabbed="true">'
    );
    writeFileSync(page, src);
    const { report } = run(dir);
    expect(findings(report, 'a11y/disallowed-aria-props')).toBe(findings(baseline, 'a11y/disallowed-aria-props') - 1);
    expect(findings(report, 'a11y/deprecated-aria')).toBe(findings(baseline, 'a11y/deprecated-aria') - 1);
  });

  it('silences a route-scoped finding in a composed component and turns it into a PASS', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    const scoped = ['--route', 'gallery/a11y/**'];
    const before = [run(dir).report, run(dir, ...scoped).report];
    disableAbove(join(dir, 'src', 'lib', 'a11y', 'DupId.svelte'), '<p id="dup-x">', 'a11y/id-duplication');
    // The scoped run is the case per-family wiring would have broken: it skips component-fact
    // collection, so the directive has to reach the pass through the route composition.
    for (const [i, args] of [[], scoped].entries()) {
      expect(findings(before[i]!, 'a11y/id-duplication')).toBe(1);
      const { report } = run(dir, ...args);
      // A suppressed finding is checked-and-clean, so the route stays in the average as a PASS
      // rather than dropping out of it the way a skipped route does.
      expect(findings(report, 'a11y/id-duplication')).toBe(0);
      expect(passed(report, 'a11y/id-duplication')).toBe(passed(before[i]!, 'a11y/id-duplication') + 1);
    }
  });

  it('silences a route-scoped finding outside a11y, which is what makes the rule general', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    disableAbove(
      join(dir, 'src', 'routes', 'gallery', 'seo', '+page.svelte'),
      '<h1>Gallery — SEO defects</h1>',
      'seo/single-h1'
    );
    const { report } = run(dir);
    expect(findings(report, 'seo/single-h1')).toBe(findings(baseline, 'seo/single-h1') - 1);
    expect(passed(report, 'seo/single-h1')).toBe(passed(baseline, 'seo/single-h1') + 1);
  });

  it('honours a bare directive, and emits no PASS while a sibling finding survives', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    disableAbove(
      join(dir, 'src', 'routes', 'gallery', 'a11y', 'landmarks', '+page.svelte'),
      '<aside role="complementary">'
    );
    const { report } = run(dir);
    expect(findings(report, 'a11y/top-level-landmark')).toBe(findings(baseline, 'a11y/top-level-landmark') - 1);
    expect(passed(report, 'a11y/top-level-landmark')).toBe(passed(baseline, 'a11y/top-level-landmark'));
  });

  it('ignores a directive naming another rule, and warns when it names no rule at all', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    disableAbove(join(dir, 'src', 'lib', 'a11y', 'DupId.svelte'), '<p id="dup-x">', 'a11y/id-duplicaton');
    const { report, stderr } = run(dir);
    expect(findings(report, 'a11y/id-duplication')).toBe(findings(baseline, 'a11y/id-duplication'));
    expect(stderr).toContain('src/lib/a11y/DupId.svelte:3 disables unknown rule "a11y/id-duplicaton"');
    // Scoped runs stay quiet: the composition parses every route before --route filters, so the
    // warning would otherwise name files the run never analysed.
    expect(run(dir, '--route', 'gallery/a11y/**').stderr).not.toContain('unknown rule');
  });

  it('silences a shared component on every route that composed it', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    const comp = join(dir, 'src', 'lib', 'Shared.svelte');
    writeFileSync(comp, '<p id="shared">a</p>\n<p id="shared">b</p>\n');
    for (const route of ['shared-a', 'shared-b']) {
      mkdirSync(join(dir, 'src', 'routes', route), { recursive: true });
      writeFileSync(
        join(dir, 'src', 'routes', route, '+page.svelte'),
        "<script>\n  import Shared from '$lib/Shared.svelte';\n</script>\n\n<Shared />\n"
      );
    }
    const before = run(dir).report;
    expect(findings(before, 'a11y/id-duplication')).toBe(findings(baseline, 'a11y/id-duplication') + 2);
    // One directive, two routes — the documented difference from the suppressions file, whose
    // key is per route.
    disableAbove(comp, '<p id="shared">b</p>');
    expect(findings(run(dir).report, 'a11y/id-duplication')).toBe(findings(baseline, 'a11y/id-duplication'));
  });

  it('says so when a selection matches nothing, and stays quiet on a clean run', () => {
    expect(run(appDir, '--route', 'no-such-route/**').stderr).toContain('matched none of the');
    expect(run(appDir, '--rules', 'correctness/effect-as-derived', '--route', 'gallery/a11y/**').stderr).toContain(
      'examined nothing: --route collects route facts only'
    );
    const dir = scratchCopy();
    scratch.push(dir);
    const cfgPath = join(dir, 'svelte-vitals.config.ts');
    writeFileSync(
      cfgPath,
      readFileSync(cfgPath, 'utf8').replace(
        'export default {',
        "export default {\n  overrides: [{ route: '/no-such-route/**', rules: { seo: 'off' } }],"
      )
    );
    expect(run(dir).stderr).toContain("overrides entry for route '/no-such-route/**' matched no route");
    const filesDir = scratchCopy();
    scratch.push(filesDir);
    const filesCfg = join(filesDir, 'svelte-vitals.config.ts');
    const withFiles = (glob: string) =>
      writeFileSync(
        filesCfg,
        readFileSync(cfgPath, 'utf8').replace(
          "overrides: [{ route: '/no-such-route/**', rules: { seo: 'off' } }],",
          `overrides: [{ files: ['${glob}'], rules: { seo: 'off' } }],`
        )
      );
    withFiles('src/lib/no-such-dir/**');
    expect(run(filesDir).stderr).toContain('matched no file');
    // A file every rule can attribute a finding to, but that no src/ glob covers — judging these
    // against the source tree alone would report a working override as dead.
    withFiles('vite.config.ts');
    expect(run(filesDir).stderr).not.toContain('matched no file');
    // A run that selects normally must stay silent, or the warnings get tuned out.
    expect(run(appDir, '--route', 'gallery/a11y/**').stderr).toBe('');
  });

  it('reaches a finding anchored outside src/, in the Vite config', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    const cfg = join(dir, 'vite.config.ts');
    writeFileSync(
      cfg,
      readFileSync(cfg, 'utf8').replace(
        'minify: false',
        '// svelte-vitals-disable-next-line performance/minify-disabled\n    minify: false'
      )
    );
    const { report } = run(dir);
    expect(findings(report, 'performance/minify-disabled')).toBe(0);
    expect(passed(report, 'performance/minify-disabled')).toBe(1);
  });

  it('does not record an inline-suppressed finding in the suppressions file', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    disableAbove(join(dir, 'src', 'lib', 'a11y', 'DupId.svelte'), '<p id="dup-x">', 'a11y/id-duplication');
    execFileSync(process.execPath, [bin, dir, '--update-suppressions'], { encoding: 'utf8', stdio: 'pipe' });
    const recorded = JSON.parse(readFileSync(join(dir, 'svelte-vitals-suppressions.json'), 'utf8')) as {
      suppressions: Array<{ id: string }>;
    };
    expect(recorded.suppressions.length).toBeGreaterThan(0);
    expect(recorded.suppressions.some((s) => s.id === 'a11y/id-duplication')).toBe(false);
  });

  it('turns a recorded entry stale once the same finding is suppressed inline', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    execFileSync(process.execPath, [bin, dir, '--update-suppressions'], { encoding: 'utf8', stdio: 'pipe' });
    expect(run(dir).stderr).not.toContain('stale');
    disableAbove(join(dir, 'src', 'lib', 'a11y', 'DupId.svelte'), '<p id="dup-x">', 'a11y/id-duplication');
    expect(run(dir).stderr).toContain('stale entry — re-run --update-suppressions to prune');
  });

  it('the suppressions file records every finding and silences the next run', () => {
    const dir = scratchCopy();
    scratch.push(dir);
    execFileSync(process.execPath, [bin, dir, '--update-suppressions'], { encoding: 'utf8', stdio: 'pipe' });
    const recorded = JSON.parse(readFileSync(join(dir, 'svelte-vitals-suppressions.json'), 'utf8')) as {
      suppressions: unknown[];
    };
    expect(recorded.suppressions.length).toBeGreaterThan(0);
    const { code, report } = run(dir);
    expect(totalFindings(report)).toBe(0);
    expect(code).toBe(0);
  });
});
