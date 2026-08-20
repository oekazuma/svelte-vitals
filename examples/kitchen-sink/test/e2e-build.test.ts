import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = join(appDir, 'svelte-vitals-report.json');
let buildFailed = false;
let buildStderr = '';

interface JsonReport {
  rules: Record<string, { findings: number; passed: number }>;
  routes: Array<{ route: string }>;
  skipped?: Record<
    string,
    Array<{ route: string; refs: number; causes: Array<{ kind: string; file: string; line: number; detail?: string }> }>
  >;
}

let report: JsonReport;

beforeAll(() => {
  rmSync(reportPath, { force: true });
  try {
    execFileSync(process.execPath, [join(appDir, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch (e) {
    buildFailed = true;
    buildStderr = (e as { stderr: string }).stderr;
  }
  // The report is written by the plugin before the gate decides; if it is missing, the build died
  // before analysis ran, and the build's own stderr is the useful failure — not an ENOENT.
  if (!existsSync(reportPath)) {
    throw new Error(`no ${reportPath} after vite build (buildFailed=${buildFailed}):\n${buildStderr}`);
  }
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
}, 240_000);

describe('kitchen-sink e2e (build mode)', () => {
  it('the gate fails the build on critical findings, after writing the report', () => {
    expect(buildFailed).toBe(true);
    expect(buildStderr).toContain('svelte-vitals: build failed');
    const expected = JSON.parse(readFileSync(join(appDir, 'expected-findings.rendered.json'), 'utf8')) as Record<
      string,
      number
    >;
    for (const [id, count] of Object.entries(expected)) {
      expect(report.rules[id]?.findings ?? 0, id).toBe(count);
    }
  });

  it('pins the rendered expectations to the same rule-id set as the static expectations', () => {
    const rendered = JSON.parse(readFileSync(join(appDir, 'expected-findings.rendered.json'), 'utf8')) as Record<
      string,
      number
    >;
    const staticExpected = JSON.parse(readFileSync(join(appDir, 'expected-findings.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(rendered).sort()).toEqual(Object.keys(staticExpected).sort());
  });

  // seo/charset and seo/viewport are `renderedOnly` in expected-findings.json (static analysis
  // never resolves src/app.html's %sveltekit.head%-adjacent tags) — this is where their gate
  // actually opens. app.html sets both, so every route must pass, never fail.
  it('exercises seo/charset and seo/viewport as passes, not findings', () => {
    for (const id of ['seo/charset', 'seo/viewport']) {
      expect(report.rules[id]?.findings, id).toBe(0);
      expect(report.rules[id]?.passed, id).toBeGreaterThan(0);
    }
  });

  it('excludes the ssr-off route (ssr=false skips prerendering, adapter fallback only)', () => {
    const routes = report.routes.map((r) => r.route);
    expect(routes).not.toContain('/gallery/seo/ssr-off');
  });

  it('never reports skipped routes: the prerendered document is its own closed world', () => {
    expect(report.skipped).toBeUndefined();
  });
});
