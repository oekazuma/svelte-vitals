import { describe, it, expect } from 'vitest';
import { collectSourceFiles } from '../src/providers/source/components.js';

describe('collectSourceFiles (vite provider)', () => {
  it('returns paths under src/ for the repository it is pointed at', async () => {
    // Point it at this package: packages/vite/src exists and holds .ts files.
    const files = await collectSourceFiles(new URL('..', import.meta.url).pathname);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.startsWith('src/'))).toBe(true);
    expect(files).toEqual(files.slice().sort());
  });

  it('returns an empty list for a directory with no src/', async () => {
    expect(await collectSourceFiles(new URL('.', import.meta.url).pathname)).toEqual([]);
  });
});
