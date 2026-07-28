import { describe, it, expect } from 'vitest';
import { collectSourceFiles } from '../src/source-files.js';
import type { Runtime } from '../src/runtime.js';

/** A Runtime whose glob returns a fixed list, recording the patterns and any file reads. */
function fakeRuntime(files: string[]): { rt: Runtime; patterns: string[]; reads: string[] } {
  const patterns: string[] = [];
  const reads: string[] = [];
  const rt: Runtime = {
    readFile: (path) => {
      reads.push(path);
      return Promise.reject(new Error('not used'));
    },
    exists: () => Promise.resolve(false),
    glob: (pattern) => {
      patterns.push(pattern);
      return Promise.resolve(files);
    },
    join: (...parts) => parts.join('/')
  };
  return { rt, patterns, reads };
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
    // Recorded rather than inferred from a rejection: a swallowed or unawaited read would
    // leave the outer promise resolving normally, so only a call count can prove this.
    const { rt, reads } = fakeRuntime(['src/lib/Card/Card.svelte']);
    await collectSourceFiles(rt, '/project');
    expect(reads).toEqual([]);
  });
});
