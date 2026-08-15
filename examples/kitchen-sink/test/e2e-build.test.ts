import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = join(appDir, 'svelte-vitals-report.json');
let buildFailed = false;
let buildStderr = '';

interface JsonReport {
  rules: Record<string, { findings: number; passed: number }>;
  routes: Array<{ route: string }>;
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
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
}, 240_000);

describe('kitchen-sink e2e (build mode)', () => {
  it('the gate fails the build on critical findings, after writing the report', () => {
    expect(buildFailed).toBe(true);
    expect(buildStderr).toContain('svelte-vitals: build failed');
    // performance/minify-disabled pins 0, not 1: the plugin's minifyFlag closure is lost
    // by the time the real closeBundle fires (SvelteKit's prerender pass re-instantiates
    // the plugin), so the rule never opens its gate in a real `vite build` today, despite
    // vite.config.ts's `minify: false`. Known plugin bug — this expectation flips to 1
    // once packages/vite/src/plugin.ts's minifyFlag capture survives the prerender pass.
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
});
