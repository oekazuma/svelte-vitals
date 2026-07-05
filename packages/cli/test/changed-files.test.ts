import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filterToChangedFiles, getChangedFiles } from '../src/changed-files.js';
import type { Result } from '@svelte-vitals/core';

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
    r({ id: 'C' }), // project-scoped / passing seed: no location
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
});
