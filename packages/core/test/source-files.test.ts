import { describe, it, expect } from 'vitest';
import { collectSourceFiles } from '../src/source-files.js';
import type { Runtime } from '../src/runtime.js';

/** A Runtime whose glob returns a fixed list and records the pattern it was asked for. */
function fakeRuntime(files: string[]): { rt: Runtime; patterns: string[] } {
  const patterns: string[] = [];
  const rt: Runtime = {
    readFile: () => Promise.reject(new Error('not used')),
    exists: () => Promise.resolve(false),
    glob: (pattern) => {
      patterns.push(pattern);
      return Promise.resolve(files);
    },
    join: (...parts) => parts.join('/')
  };
  return { rt, patterns };
}

describe('collectSourceFiles', () => {
  it('globs every file under src/ exactly once', async () => {
    const { rt, patterns } = fakeRuntime(['src/app.html']);
    await collectSourceFiles(rt, '/project');
    expect(patterns).toEqual(['src/**/*']);
  });

  it('returns the paths sorted', async () => {
    const { rt } = fakeRuntime(['src/lib/b.ts', 'src/app.html', 'src/lib/a.ts']);
    expect(await collectSourceFiles(rt, '/project')).toEqual(['src/app.html', 'src/lib/a.ts', 'src/lib/b.ts']);
  });

  it('returns an empty list when nothing matches', async () => {
    const { rt } = fakeRuntime([]);
    expect(await collectSourceFiles(rt, '/project')).toEqual([]);
  });

  it('does not read any file', async () => {
    // readFile rejects in the fake; reaching it would fail this test.
    const { rt } = fakeRuntime(['src/lib/Card/Card.svelte']);
    await expect(collectSourceFiles(rt, '/project')).resolves.toHaveLength(1);
  });
});
