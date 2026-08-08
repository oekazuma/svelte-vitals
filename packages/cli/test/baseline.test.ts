import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkoutBaseline, filterToNewFindings, findingKey } from '../src/baseline.js';
import type { Result } from '@svelte-vitals/core';

const r = (over: Partial<Result>): Result => ({
  id: 'X',
  severity: 'warning',
  detection: { presence: 'none', value: 'absent' },
  message: 'm',
  ...over
});

describe('findingKey', () => {
  it('combines id, route, and location', () => {
    expect(findingKey(r({ id: 'seo/title-presence', route: '/blog', location: 'src/routes/blog/+page.svelte' }))).toBe(
      'seo/title-presence::/blog::src/routes/blog/+page.svelte'
    );
  });

  it('treats missing route/location as empty segments', () => {
    expect(findingKey(r({ id: 'PROJ001' }))).toBe('PROJ001::::');
  });

  it('ignores line — two findings differing only by line share a key', () => {
    const a = findingKey(r({ id: 'seo/title-presence', location: 'a.svelte', line: 3 }));
    const b = findingKey(r({ id: 'seo/title-presence', location: 'a.svelte', line: 42 }));
    expect(a).toBe(b);
  });
});

describe('filterToNewFindings', () => {
  it('removes findings present (by key) in the baseline', () => {
    const current: Result[] = [
      r({ id: 'A', location: 'x.svelte' }),
      r({ id: 'B', location: 'y.svelte' }),
      r({ id: 'C' })
    ];
    const baseline: Result[] = [r({ id: 'A', location: 'x.svelte' })];
    expect(filterToNewFindings(current, baseline).map((x) => x.id)).toEqual(['B', 'C']);
  });

  it('keeps everything when the baseline has no findings', () => {
    const current: Result[] = [r({ id: 'A', location: 'x.svelte' })];
    expect(filterToNewFindings(current, [])).toEqual(current);
  });

  it('drops everything when current and baseline are identical', () => {
    const current: Result[] = [r({ id: 'A', location: 'x.svelte' }), r({ id: 'B' })];
    expect(filterToNewFindings(current, current)).toEqual([]);
  });

  it('a line-only difference on an existing finding is still treated as pre-existing (not new)', () => {
    const current: Result[] = [r({ id: 'A', location: 'x.svelte', line: 99 })];
    const baseline: Result[] = [r({ id: 'A', location: 'x.svelte', line: 1 })];
    expect(filterToNewFindings(current, baseline)).toEqual([]);
  });
});

// Characterization tests for docs/superpowers/specs/2026-08-08-pass-result-location-design.md's
// "findingKey / filterToNewFindings" section (the Sequencing note's standalone fix). PASS_DETECTION
// mirrors packages/core/src/rules/seo/detection.ts's PASS constant; MISSING_DETECTION mirrors a
// headTagRule/lengthRule "not found" branch.
const PASS_DETECTION = { presence: 'own', value: 'static' } as const;
const MISSING_DETECTION = { presence: 'none', value: 'absent' } as const;

describe('filterToNewFindings — PASS/PENALIZED location collision', () => {
  it('item 4: unlocated-PASS rule shape (e.g. seo/title-length) — a regression still surfaces, before and after the fix', () => {
    // Baseline PASS carries no location (key `id::route::`); current PENALIZED does
    // (key `id::route::file`) — keys already differ today.
    const baseline: Result[] = [r({ id: 'seo/title-length', route: '/blog', detection: PASS_DETECTION })];
    const current: Result[] = [
      r({
        id: 'seo/title-length',
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        detection: MISSING_DETECTION
      })
    ];
    expect(filterToNewFindings(current, baseline).map((x) => x.id)).toEqual(['seo/title-length']);
  });

  it('item 5/6 (THE bug): headTagRule-backed shape (e.g. seo/title-presence) — a regression at the same location must surface', () => {
    // head-tag-rule.ts:53-66 sets `location` unconditionally on both the PASS and
    // PENALIZED branches, so baseline PASS and current PENALIZED key identically
    // (`id::route::file`) under today's unfiltered findingKey comparison.
    const baseline: Result[] = [
      r({
        id: 'seo/title-presence',
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        detection: PASS_DETECTION
      })
    ];
    const current: Result[] = [
      r({
        id: 'seo/title-presence',
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        detection: MISSING_DETECTION
      })
    ];
    expect(filterToNewFindings(current, baseline).map((x) => x.id)).toEqual(['seo/title-presence']);
  });

  it('case 1: unchanged, still passing — not reported', () => {
    const baseline: Result[] = [
      r({
        id: 'seo/title-presence',
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        detection: PASS_DETECTION
      })
    ];
    const current: Result[] = [
      r({
        id: 'seo/title-presence',
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        detection: PASS_DETECTION
      })
    ];
    expect(filterToNewFindings(current, baseline)).toEqual([]);
  });

  it('case 2: improved route (baseline PENALIZED, current PASS) — the PASS is dropped, not reported as new (deliberate: no PASS ever reaches the output)', () => {
    // Unlocated-PASS shape: baseline PENALIZED key `id::route::file`, current PASS key
    // `id::route::` — different keys, so before this fix the unfiltered comparison let the
    // PASS through. After the fix, the current side's penalized-only pre-filter drops it
    // regardless of key.
    const baseline: Result[] = [
      r({
        id: 'seo/title-length',
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        detection: MISSING_DETECTION
      })
    ];
    const current: Result[] = [r({ id: 'seo/title-length', route: '/blog', detection: PASS_DETECTION })];
    expect(filterToNewFindings(current, baseline)).toEqual([]);
  });
});

describe('checkoutBaseline', () => {
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
    const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-baseline-repo-'));
    dirs.push(dir);
    git(['init'], dir);
    git(['config', 'user.email', 'test@example.com'], dir);
    git(['config', 'user.name', 'Test'], dir);
    return dir;
  }

  it('checks out the ref content into a fresh worktree and cleans it up after', () => {
    const repo = makeRepo();
    const markerPath = join(repo, 'marker.txt');
    writeFileSync(markerPath, 'old\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'first'], repo);
    const oldRef = git(['rev-parse', 'HEAD'], repo).trim();

    writeFileSync(markerPath, 'new\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'second'], repo);

    const checkout = checkoutBaseline(repo, oldRef);
    expect(checkout).toBeDefined();
    if (checkout === undefined) return;

    const content = readFileSync(join(checkout.analyzeCwd, 'marker.txt'), 'utf8');
    expect(content).toBe('old\n');

    const worktreeDir = checkout.analyzeCwd;
    checkout.cleanup();
    expect(existsSync(worktreeDir)).toBe(false);
  });

  it('resolves a subdirectory analyzeCwd for a monorepo-style project', () => {
    const repo = makeRepo();
    mkdirSync(join(repo, 'apps/web/src'), { recursive: true });
    writeFileSync(join(repo, 'apps/web/src/marker.txt'), 'hello\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'init'], repo);

    const checkout = checkoutBaseline(join(repo, 'apps/web'), 'HEAD');
    expect(checkout).toBeDefined();
    if (checkout === undefined) return;

    expect(checkout.analyzeCwd.endsWith(join('apps', 'web'))).toBe(true);
    expect(existsSync(join(checkout.analyzeCwd, 'src/marker.txt'))).toBe(true);
    checkout.cleanup();
  });

  it('returns undefined for a bad ref', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'a.txt'), 'x\n');
    git(['add', '.'], repo);
    git(['commit', '-m', 'init'], repo);

    expect(checkoutBaseline(repo, 'not-a-real-ref')).toBeUndefined();
  });

  it('returns undefined outside a git repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-baseline-norepo-'));
    dirs.push(dir);
    expect(checkoutBaseline(dir, 'HEAD')).toBeUndefined();
  });
});
