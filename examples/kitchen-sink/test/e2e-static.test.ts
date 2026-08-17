import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allRules } from '@svelte-vitals/core/internal';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(appDir, '..', '..', 'packages', 'cli', 'dist', 'bin.js');

// `renderedOnly` rules (seo/charset, seo/viewport) read src/app.html, which static analysis
// never resolves; the rendered-mode (build) e2e report is where their pass/fail is exercised.
// `inert` rules (correctness/base-path-navigation) never open their gate in this example at
// all (no kit.paths.base configured), so neither findings nor passes are expected anywhere.
const expected = JSON.parse(readFileSync(join(appDir, 'expected-findings.json'), 'utf8')) as Record<
  string,
  { findings?: number; passOnly?: string; renderedOnly?: string; inert?: string }
>;

interface JsonReport {
  rules: Record<string, { findings: number; passed: number }>;
  routes: Array<{ route: string; issues: Array<{ location?: string }> }>;
  siteIssues: Array<{ location?: string }>;
}

let report: JsonReport;
let exitCode = 0;

beforeAll(() => {
  try {
    // ponytail: execFileSync's default 1MB maxBuffer caps the JSON report; raise it if the
    // gallery grows enough to hit ENOBUFS.
    const out = execFileSync(process.execPath, [bin, appDir, '--reporter', 'json'], { encoding: 'utf8' });
    report = JSON.parse(out);
  } catch (e) {
    const err = e as { status: number; stdout: string };
    exitCode = err.status;
    report = JSON.parse(err.stdout);
  }
});

describe('kitchen-sink e2e (static mode)', () => {
  it('covers every rule in the expectations file (meta-test)', () => {
    const ids = new Set(allRules.map((r) => r.id));
    expect(Object.keys(expected).sort()).toEqual([...ids].sort());
    for (const [id, entry] of Object.entries(expected)) {
      if (entry.passOnly) expect(entry.passOnly.length, `${id} passOnly reason`).toBeGreaterThan(0);
      else if (entry.renderedOnly) expect(entry.renderedOnly.length, `${id} renderedOnly reason`).toBeGreaterThan(0);
      else if (entry.inert) expect(entry.inert.length, `${id} inert reason`).toBeGreaterThan(0);
      else expect(entry.findings, `${id} findings declared`).toBeGreaterThanOrEqual(1);
    }
  });

  it('matches the expected finding count per rule; passOnly rules are exercised', () => {
    for (const [id, entry] of Object.entries(expected)) {
      const got = report.rules[id] ?? { findings: 0, passed: 0 };
      if (entry.passOnly) {
        expect(got.findings, `${id} must not fail (passOnly)`).toBe(0);
        expect(got.findings + got.passed, `${id} exercised`).toBeGreaterThanOrEqual(1);
      } else if (entry.renderedOnly) {
        expect(got.findings, `${id} emits nothing in static mode`).toBe(0);
      } else if (entry.inert) {
        expect(got.findings, `${id} inert: no findings`).toBe(0);
        expect(got.passed, `${id} inert: no passes`).toBe(0);
      } else {
        expect(got.findings, id).toBe(entry.findings);
      }
    }
  });

  it('keeps the clean canaries clean', () => {
    const locations = [
      ...report.routes.flatMap((r) => r.issues.map((i) => i.location)),
      ...report.siteIssues.map((i) => i.location)
    ].filter((location): location is string => location !== undefined);
    const offenders = locations.filter(
      (location) => location.startsWith('src/routes/clean/') || location.startsWith('src/lib/clean/')
    );
    const cleanRoutes = report.routes.filter((r) => r.route.startsWith('/clean') && r.issues.length > 0);
    expect(offenders).toEqual([]);
    expect(cleanRoutes).toEqual([]);
  });

  it('--by-route adds the per-route breakdown to console output', () => {
    // The gallery exits 1, so read stdout off spawnSync rather than letting execFileSync throw.
    const console_ = (...args: string[]) =>
      spawnSync(process.execPath, [bin, appDir, '--reporter', 'console', '--no-color', ...args], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, CI: '1', CLAUDECODE: '', CLAUDE_CODE: '' }
      }).stdout;
    expect(console_()).not.toContain('By route');
    expect(console_('--by-route')).toContain('By route');
  });

  it('exits 1 on the gallery (critical present) and 0 on clean routes', () => {
    expect(exitCode).toBe(1);
    const clean = execFileSync(process.execPath, [bin, appDir, '--route', '/clean/**', '--reporter', 'json'], {
      encoding: 'utf8'
    });
    // Assert the scope both selected and filtered before asserting it is clean. A glob matching no
    // route produces zero findings, and a `--route` ignored entirely returns the whole gallery —
    // either way an unguarded canary passes while checking nothing it claims to.
    const report = JSON.parse(clean) as { routes: { route: string; issues: unknown[] }[] };
    expect(report.routes.length).toBeGreaterThan(1);
    expect(report.routes.map((r) => r.route).every((r) => r.startsWith('/clean'))).toBe(true);
    expect(report.routes.flatMap((r) => r.issues)).toEqual([]);
  });
});
