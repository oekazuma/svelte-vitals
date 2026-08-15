import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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

function run(dir: string, ...args: string[]): { code: number; report: JsonReport } {
  try {
    const out = execFileSync(process.execPath, [bin, dir, ...args, '--reporter', 'json'], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024
    });
    return { code: 0, report: JSON.parse(out) };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, report: JSON.parse(err.stdout) };
  }
}

const findings = (r: JsonReport, id: string) => r.rules[id]?.findings ?? 0;
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
    const cfgPath = join(dir, 'svelte-vitals.config.mjs');
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
