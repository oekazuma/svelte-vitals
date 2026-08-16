import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filterToChangedFiles, getChangedFiles } from '../src/changed-files.js';
import { defineConfig, type Result } from '@svelte-vitals/core';
import { architectureUnitEntryFile, defaultProject, type RuleContext } from '@svelte-vitals/core/internal';

const r = (over: Partial<Result>): Result => ({
  id: 'X',
  severity: 'warning',
  detection: { presence: 'none', value: 'absent' },
  message: 'm',
  ...over
});

describe('filterToChangedFiles', () => {
  const results: Result[] = [
    r({ id: 'A', location: 'src/lib/Changed.svelte' }),
    r({ id: 'B', location: 'src/lib/Untouched.svelte' }),
    r({ id: 'C' }), // project-scoped: no location
    r({ id: 'D', location: 'src/routes/+page.svelte' })
  ];

  it('keeps only findings located in a changed file', () => {
    const changed = new Set(['src/lib/Changed.svelte', 'src/routes/+page.svelte']);
    expect(filterToChangedFiles(results, changed).map((x) => x.id)).toEqual(['A', 'D']);
  });

  it('drops location-less findings (project-scoped / seeds)', () => {
    expect(filterToChangedFiles(results, new Set(['src/lib/Changed.svelte'])).map((x) => x.id)).toEqual(['A']);
  });

  it('returns nothing when no result is in the changed set', () => {
    expect(filterToChangedFiles(results, new Set(['src/other.svelte']))).toEqual([]);
  });
});

describe('filterToChangedFiles + architecture/unit-entry-file — spec testing item 7', () => {
  // The rule's pass carries `location` (its entry file) and no `route`, precisely so a
  // `--diff` run can keep it for a changed entry file and drop it for an unchanged one.
  // This is the unit-entry-file carve-out (design 2026-08-08-pass-result-location-design.md,
  // maintainer ruling): a route-less PASS is kept regardless of `isPenalized`, preserving
  // PR #337's shipped decision. This test's assertion is unchanged by that design.
  it('keeps a conforming pass when its entry file changed, and drops it when it did not', async () => {
    const ctx: RuleContext = {
      sourceFiles: ['src/lib/api/api.ts', 'src/lib/db/db.ts'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/unit-entry-file': { options: { units: { 'src/lib/*': '.ts' } } } }
      })
    };
    const rs = await architectureUnitEntryFile.check(ctx);
    expect(rs).toHaveLength(2);

    const changed = new Set(['src/lib/api/api.ts']); // only api.ts changed; db.ts did not
    const kept = filterToChangedFiles(rs, changed);
    expect(kept.map((r) => r.location)).toEqual(['src/lib/api/api.ts']);
  });
});

describe('filterToChangedFiles — PASS results (design 2026-08-08-pass-result-location-design.md)', () => {
  // spec testing item 3, "after": every PASS result now carries `location` (option (a)), so a
  // route-CARRYING pass (the common case — e.g. any headTagRule-backed rule, or seo/title-length)
  // must be dropped even when located in the changed set, or a single incidental passing check
  // on a changed file promotes its whole category from absent to a fabricated 100 in `--diff`'s
  // score. Before this fix (when only headTagRule/title-presence carried `location` on PASS),
  // this was a live, undetected leak for those eleven rule ids; this test pins the fixed behavior.
  it('drops a route-carrying PASS in a changed file, even though its location matches', () => {
    const pass = r({
      id: 'seo/title-presence',
      route: '/blog',
      location: 'src/routes/blog/+page.svelte',
      detection: { presence: 'own', value: 'static' }
    });
    expect(filterToChangedFiles([pass], new Set(['src/routes/blog/+page.svelte']))).toEqual([]);
  });

  it('keeps a penalized (route-carrying) finding in a changed file, unchanged from before', () => {
    const failing = r({
      id: 'seo/title-presence',
      route: '/blog',
      location: 'src/routes/blog/+page.svelte',
      detection: { presence: 'none', value: 'absent' }
    });
    expect(filterToChangedFiles([failing], new Set(['src/routes/blog/+page.svelte']))).toEqual([failing]);
  });
});

describe('getChangedFiles', () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  function git(args: string[], cwd: string): void {
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  }

  function makeRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-changed-files-'));
    dirs.push(dir);
    git(['init'], dir);
    git(['config', 'user.email', 'test@example.com'], dir);
    git(['config', 'user.name', 'Test'], dir);
    return dir;
  }

  it('reports cwd-relative paths for tracked changes when the project is a subdirectory of the repo', () => {
    const repo = makeRepo();
    const projectDir = join(repo, 'apps/web');
    mkdirSync(join(projectDir, 'src/routes'), { recursive: true });
    const pagePath = join(projectDir, 'src/routes/+page.svelte');
    writeFileSync(pagePath, '<h1>hello</h1>\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'init'], repo);

    // Modify a tracked file without committing.
    writeFileSync(pagePath, '<h1>changed</h1>\n');

    const changed = getChangedFiles(projectDir, { base: 'HEAD' });
    expect(changed).toEqual(new Set(['src/routes/+page.svelte']));
  });

  it('reports cwd-relative paths for staged changes when the project is a subdirectory of the repo', () => {
    const repo = makeRepo();
    const projectDir = join(repo, 'apps/web');
    mkdirSync(join(projectDir, 'src/routes'), { recursive: true });
    const pagePath = join(projectDir, 'src/routes/+page.svelte');
    writeFileSync(pagePath, '<h1>hello</h1>\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'init'], repo);

    writeFileSync(pagePath, '<h1>changed</h1>\n');
    git(['add', '.'], repo);

    const changed = getChangedFiles(projectDir, { staged: true });
    expect(changed).toEqual(new Set(['src/routes/+page.svelte']));
  });

  it('reports cwd-relative paths for untracked (new) files via the ls-files path', () => {
    const repo = makeRepo();
    const projectDir = join(repo, 'apps/web');
    mkdirSync(join(projectDir, 'src/routes'), { recursive: true });
    // A committed file so HEAD exists for the merge-base diff.
    writeFileSync(join(projectDir, 'src/routes/+layout.svelte'), '<slot />\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'init'], repo);

    // A brand-new, untracked file.
    writeFileSync(join(projectDir, 'src/routes/+page.svelte'), '<h1>new</h1>\n');

    const changed = getChangedFiles(projectDir, { base: 'HEAD' });
    expect(changed).toEqual(new Set(['src/routes/+page.svelte']));
  });

  it('still works when run from the repo root (no subdirectory)', () => {
    const repo = makeRepo();
    mkdirSync(join(repo, 'src/routes'), { recursive: true });
    const pagePath = join(repo, 'src/routes/+page.svelte');
    writeFileSync(pagePath, '<h1>hello</h1>\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'init'], repo);

    writeFileSync(pagePath, '<h1>changed</h1>\n');

    const changed = getChangedFiles(repo, { base: 'HEAD' });
    expect(changed).toEqual(new Set(['src/routes/+page.svelte']));
  });

  // Regression: default core.quotePath octal-escapes non-ASCII paths in git output
  // (e.g. `"src/routes/\343\203\226..."`), which never matches raw-UTF-8 Result.location.
  // `-z` returns raw NUL-separated paths, sidestepping the quoting entirely.

  it('reports the raw path for a non-ASCII tracked change', () => {
    const repo = makeRepo();
    mkdirSync(join(repo, 'src/routes/ブログ'), { recursive: true });
    const pagePath = join(repo, 'src/routes/ブログ/+page.svelte');
    writeFileSync(pagePath, '<h1>hello</h1>\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'init'], repo);

    writeFileSync(pagePath, '<h1>changed</h1>\n');

    const changed = getChangedFiles(repo, { base: 'HEAD' });
    expect(changed).toEqual(new Set(['src/routes/ブログ/+page.svelte']));
  });

  it('reports the raw path for a non-ASCII staged change', () => {
    const repo = makeRepo();
    mkdirSync(join(repo, 'src/routes/ブログ'), { recursive: true });
    const pagePath = join(repo, 'src/routes/ブログ/+page.svelte');
    writeFileSync(pagePath, '<h1>hello</h1>\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'init'], repo);

    writeFileSync(pagePath, '<h1>changed</h1>\n');
    git(['add', '.'], repo);

    const changed = getChangedFiles(repo, { staged: true });
    expect(changed).toEqual(new Set(['src/routes/ブログ/+page.svelte']));
  });

  it('reports the raw path for a non-ASCII untracked file via the ls-files path', () => {
    const repo = makeRepo();
    mkdirSync(join(repo, 'src/routes'), { recursive: true });
    // A committed file so HEAD exists for the merge-base diff.
    writeFileSync(join(repo, 'src/routes/+layout.svelte'), '<slot />\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'init'], repo);

    mkdirSync(join(repo, 'src/routes/café'), { recursive: true });
    writeFileSync(join(repo, 'src/routes/café/+page.svelte'), '<h1>new</h1>\n');

    const changed = getChangedFiles(repo, { base: 'HEAD' });
    expect(changed).toEqual(new Set(['src/routes/café/+page.svelte']));
  });
});
