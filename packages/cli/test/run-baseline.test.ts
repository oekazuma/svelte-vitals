import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Mock the baseline git layer so run()'s --baseline gating is testable without a real
// worktree checkout, following run-diff.test.ts's pattern for the analogous --diff layer.
vi.mock('../src/baseline.js', async (orig) => {
  const actual = await orig<typeof import('../src/baseline.js')>();
  return { ...actual, checkoutBaseline: vi.fn() };
});
vi.mock('../src/changed-files.js', async (orig) => {
  const actual = await orig<typeof import('../src/changed-files.js')>();
  return { ...actual, getChangedFiles: vi.fn() };
});

import { run } from '../src/index.js';
import { checkoutBaseline } from '../src/baseline.js';
import { getChangedFiles } from '../src/changed-files.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');
const configFileFixtureDir = join(here, 'fixtures', 'config-file-project');
const CLEAN_ENV: NodeJS.ProcessEnv = {};
const mockCheckout = vi.mocked(checkoutBaseline);
const mockGet = vi.mocked(getChangedFiles);

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, log: (l: string) => out.push(l), errorLog: (l: string) => err.push(l) };
}

describe('run() --baseline gating', () => {
  beforeEach(() => {
    mockCheckout.mockReset();
    mockGet.mockReset();
  });

  it('removes findings that were already present at the baseline ref', async () => {
    const cleanup = vi.fn();
    mockCheckout.mockReturnValue({ analyzeCwd: fixtureDir, cleanup });
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      baseline: 'origin/main',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    // Baseline == current project, so every current finding is "already present" -> removed.
    expect(cap.out.join('\n')).not.toContain('seo/title-presence');
    expect(code).toBe(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('warns and reports all findings when checkoutBaseline cannot answer', async () => {
    mockCheckout.mockReturnValue(undefined);
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      baseline: 'origin/main',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(cap.err.join('\n')).toContain("could not analyze baseline 'origin/main'");
    expect(cap.out.join('\n')).toContain('seo/title-presence');
    expect(code).toBe(1);
  });

  it('analyzes the baseline under the same rule selection, so a force-enabled finding is not new', async () => {
    // `config-file-project` sets `seo/title-presence: 'off'`, so the rule only produces its
    // finding because --rules force-enables it. A baseline analyzed without that selection keeps
    // the file's `'off'`, finds nothing, and every pre-existing finding is reported as new.
    const cleanup = vi.fn();
    mockCheckout.mockReturnValue({ analyzeCwd: configFileFixtureDir, cleanup });
    const cap = capture();
    const code = await run({
      cwd: configFileFixtureDir,
      baseline: 'origin/main',
      allowRules: ['seo/title-presence'],
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(cap.out.join('\n')).not.toContain('seo/title-presence');
    expect(code).toBe(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('applies --diff and --baseline together, in order (--diff narrows first, --baseline narrows further)', async () => {
    // --diff keeps only the blog route's finding(s); --baseline (mocked against the
    // same project) then removes everything, since the "baseline" == current findings.
    mockGet.mockReturnValue(new Set(['src/routes/blog/+page.svelte']));
    const cleanup = vi.fn();
    mockCheckout.mockReturnValue({ analyzeCwd: fixtureDir, cleanup });
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      diffBase: 'main',
      baseline: 'origin/main',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(mockGet).toHaveBeenCalledWith(fixtureDir, { base: 'main' });
    expect(mockCheckout).toHaveBeenCalledWith(fixtureDir, 'origin/main');
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(code).toBe(0); // both filters applied -> nothing left to fail on
  });
});

/**
 * Plan 046 regression: `--baseline` used to let `analyzeProject` re-load
 * `svelte-vitals.config.*` from inside the temporary worktree, which has no
 * `node_modules` in its ancestry (git worktrees only ever contain tracked
 * content). These tests exercise the real `checkoutBaseline` (a real git repo
 * + a real `git worktree add`) rather than the mock above, so the worktree's
 * missing `node_modules` is genuine, not simulated.
 */
describe('run() --baseline against a real git worktree (plan 046)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  function git(args: string[], cwd: string): string {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  }

  function makeRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-baseline-config-'));
    dirs.push(dir);
    git(['init'], dir);
    git(['config', 'user.email', 'test@example.com'], dir);
    git(['config', 'user.name', 'Test'], dir);
    return dir;
  }

  const PACKAGE_JSON = JSON.stringify({
    name: 'fixture',
    private: true,
    type: 'module',
    devDependencies: { '@sveltejs/kit': '^2.0.0', svelte: '^5.0.0' }
  });
  const APP_HTML =
    '<!doctype html>\n<html lang="en">\n  <head>\n    %sveltekit.head%\n  </head>\n  <body>\n    %sveltekit.body%\n  </body>\n</html>\n';
  const NO_TITLE_PAGE = '<h1>No title here</h1>\n';

  // All issues across both `routes[].issues` and `siteIssues`, keyed by nothing in
  // particular — callers filter by `id`/`location` themselves.
  function allIssues(json: {
    routes: { issues: { id: string; location?: string }[] }[];
    siteIssues: { id: string; location?: string }[];
  }) {
    return [...json.routes.flatMap((r) => r.issues), ...json.siteIssues];
  }

  it('analyzes the baseline under the current checkout config instead of failing to load one inside the worktree', async () => {
    const repo = makeRepo();
    const actual = await vi.importActual<typeof import('../src/baseline.js')>('../src/baseline.js');
    mockCheckout.mockImplementation(actual.checkoutBaseline);

    mkdirSync(join(repo, 'src/routes'), { recursive: true });
    writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
    writeFileSync(join(repo, 'package.json'), PACKAGE_JSON);
    writeFileSync(join(repo, 'src/app.html'), APP_HTML);
    writeFileSync(join(repo, 'src/routes/+page.svelte'), NO_TITLE_PAGE); // finding F, route '/'
    // Committed config imports a runtime dependency, the way the install wizard's
    // .ts scaffold's `import { defineConfig } from 'svelte-vitals'` does.
    writeFileSync(join(repo, 'svelte-vitals.config.mjs'), "import 'fake-pkg';\nexport default {};\n");
    git(['add', '.'], repo);
    git(['commit', '-m', 'A'], repo);

    // Untracked, like a real project's node_modules — present on disk for the real cwd's
    // config load, but absent from the worktree checkoutBaseline creates (git worktrees
    // only ever contain tracked content).
    mkdirSync(join(repo, 'node_modules/fake-pkg'), { recursive: true });
    writeFileSync(
      join(repo, 'node_modules/fake-pkg/package.json'),
      JSON.stringify({ name: 'fake-pkg', version: '1.0.0', type: 'module', main: 'index.js' })
    );
    writeFileSync(join(repo, 'node_modules/fake-pkg/index.js'), 'export const marker = true;\n');

    // Uncommitted working-tree change: a second route with no title (finding G).
    mkdirSync(join(repo, 'src/routes/other'), { recursive: true });
    writeFileSync(join(repo, 'src/routes/other/+page.svelte'), NO_TITLE_PAGE);

    const cap = capture();
    const code = await run({
      cwd: repo,
      baseline: 'HEAD',
      reporter: 'json',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });

    const json = JSON.parse(cap.out.join('\n'));
    const issues = allIssues(json);
    expect(issues.some((i) => i.id === 'seo/title-presence' && i.location === 'src/routes/other/+page.svelte')).toBe(
      true
    ); // G: new, not in the baseline
    expect(issues.some((i) => i.id === 'seo/title-presence' && i.location === 'src/routes/+page.svelte')).toBe(false); // F: present at the baseline ref too, filtered out
    expect(cap.err.join('\n')).not.toContain('baseline analysis');
    expect(cap.err.join('\n')).not.toContain('failed');
    expect(code).toBe(1); // G still reported as a critical finding
  });

  it('runs the baseline under the current checkout config, not the ref config, so a config-only edit is not "introduced"', async () => {
    const repo = makeRepo();
    const actual = await vi.importActual<typeof import('../src/baseline.js')>('../src/baseline.js');
    mockCheckout.mockImplementation(actual.checkoutBaseline);

    mkdirSync(join(repo, 'src/routes'), { recursive: true });
    writeFileSync(join(repo, 'package.json'), PACKAGE_JSON);
    writeFileSync(join(repo, 'src/app.html'), APP_HTML);
    writeFileSync(join(repo, 'src/routes/+page.svelte'), NO_TITLE_PAGE); // finding F, route '/'
    // At the baseline ref, the rule is off — no finding, from either side, if the ref's
    // config were consulted for its own analysis.
    writeFileSync(
      join(repo, 'svelte-vitals.config.mjs'),
      "export default { rules: { 'seo/title-presence': 'off' } };\n"
    );
    git(['add', '.'], repo);
    git(['commit', '-m', 'A'], repo);

    // Uncommitted: the rule is re-enabled, no code change to the route itself.
    writeFileSync(join(repo, 'svelte-vitals.config.mjs'), 'export default {};\n');

    const cap = capture();
    const code = await run({
      cwd: repo,
      baseline: 'HEAD',
      reporter: 'json',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });

    const json = JSON.parse(cap.out.join('\n'));
    // Current-config-governs-both-sides: the rule is enabled on both sides, F exists at the
    // baseline too (unchanged file), so it is not "new" and must not be reported.
    expect(allIssues(json).some((i) => i.id === 'seo/title-presence')).toBe(false);
    expect(cap.err.join('\n')).not.toContain('baseline analysis');
    expect(code).toBe(0);
  });
});
