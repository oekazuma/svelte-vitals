import { describe, it, expect } from 'vitest';
import { filterToChangedFiles } from '../src/changed-files.js';
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
