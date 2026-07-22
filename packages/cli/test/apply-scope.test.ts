import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

vi.mock('../src/changed-files.js', async (orig) => {
  const actual = await orig<typeof import('../src/changed-files.js')>();
  return { ...actual, getChangedFiles: vi.fn() };
});
vi.mock('../src/baseline.js', async (orig) => {
  const actual = await orig<typeof import('../src/baseline.js')>();
  return { ...actual, checkoutBaseline: vi.fn() };
});

import { applyScope } from '../src/index.js';
import { getChangedFiles } from '../src/changed-files.js';
import { checkoutBaseline } from '../src/baseline.js';
import type { Result } from '@svelte-vitals/core';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');
const mockGet = vi.mocked(getChangedFiles);
const mockCheckout = vi.mocked(checkoutBaseline);

function result(over: Partial<Result> = {}): Result {
  return {
    id: 'seo/title-presence',
    severity: 'critical',
    detection: { presence: 'own', value: 'static' },
    message: 'test finding',
    location: 'src/routes/+page.svelte',
    ...over
  };
}

describe('applyScope', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockCheckout.mockReset();
  });

  it('returns results unchanged when no scoping option is given', async () => {
    const results = [result()];
    const out = await applyScope(results, { cwd: '/proj' });
    expect(out).toBe(results);
  });

  it('filters to changed files for --diff', async () => {
    mockGet.mockReturnValue(new Set(['src/routes/+page.svelte']));
    const out = await applyScope([result(), result({ location: 'src/routes/other.svelte' })], {
      cwd: '/proj',
      diffBase: 'origin/main'
    });
    expect(out).toHaveLength(1);
    expect(mockGet).toHaveBeenCalledWith('/proj', { base: 'origin/main' });
  });

  it('--staged takes precedence and queries staged files', async () => {
    mockGet.mockReturnValue(new Set());
    await applyScope([result()], { cwd: '/proj', staged: true, diffBase: 'origin/main' });
    expect(mockGet).toHaveBeenCalledWith('/proj', { staged: true });
  });

  it('warns via errorLog and keeps all results when git cannot answer --diff', async () => {
    mockGet.mockReturnValue(undefined);
    const errorLog = vi.fn();
    const out = await applyScope([result()], { cwd: '/proj', diffBase: 'origin/main', errorLog });
    expect(out).toHaveLength(1);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('could not determine changed files'));
  });

  it('drops findings already present at the baseline ref', async () => {
    // Point the "baseline checkout" at the same fixture project as `cwd` — baseline
    // analysis then finds the exact same findings as current, so filterToNewFindings
    // removes everything. Mirrors run-baseline.test.ts's proven pattern. The synthetic
    // finding below matches the seo/title-presence the fixture's blog route actually produces
    // (id::route::location is the baseline dedup key — see baseline.ts's findingKey).
    const cleanup = vi.fn();
    mockCheckout.mockReturnValue({ analyzeCwd: fixtureDir, cleanup });
    const out = await applyScope([result({ route: '/blog', location: 'src/routes/blog/+page.svelte' })], {
      cwd: fixtureDir,
      baseline: 'origin/main'
    });
    expect(out).toHaveLength(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('warns via errorLog and keeps all results when the baseline ref cannot be resolved', async () => {
    mockCheckout.mockReturnValue(undefined);
    const errorLog = vi.fn();
    const out = await applyScope([result()], { cwd: '/proj', baseline: 'bogus-ref', errorLog });
    expect(out).toHaveLength(1);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("could not analyze baseline 'bogus-ref'"));
  });

  it('warns via errorLog and keeps all results when baseline analysis itself throws', async () => {
    const cleanup = vi.fn();
    // analyzeCwd points at a non-SvelteKit directory (the fixtures dir itself, one level
    // up) so analyzeProject's detectProject throws ProjectError, exercising the catch branch.
    mockCheckout.mockReturnValue({ analyzeCwd: here, cleanup });
    const errorLog = vi.fn();
    const out = await applyScope([result()], { cwd: fixtureDir, baseline: 'origin/main', errorLog });
    expect(out).toHaveLength(1);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("baseline analysis of 'origin/main' failed"));
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
