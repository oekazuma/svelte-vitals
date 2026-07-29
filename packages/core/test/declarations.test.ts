import { describe, it, expect } from 'vitest';
import {
  ancestorDirs,
  baseName,
  childDirs,
  childFiles,
  classifyUnusedKeys,
  createKeyCompiler,
  isExcluded,
  keysMatchingAny,
  matchKeys,
  moreSpecificGlob,
  reportAt,
  splitNames
} from '../src/rules/architecture/declarations.js';

describe('ancestorDirs', () => {
  it('lists every ancestor shallowest first, excluding the file itself', () => {
    expect(ancestorDirs('a/b/c.ts')).toEqual(['a', 'a/b']);
  });

  it('returns nothing for a file at the root', () => {
    expect(ancestorDirs('a.ts')).toEqual([]);
  });
});

describe('baseName', () => {
  it('returns the last segment', () => {
    expect(baseName('src/lib/Card')).toBe('Card');
  });

  it('returns the whole string when there is no separator', () => {
    expect(baseName('src')).toBe('src');
  });
});

describe('createKeyCompiler', () => {
  it('returns the same compiled array for the same globs and guard', () => {
    const compile = createKeyCompiler();
    expect(compile(['src/*'])).toBe(compile(['src/*']));
  });

  it('does not share a cache entry between guarded and unguarded compilations', () => {
    const compile = createKeyCompiler();
    expect(compile(['src/**'], true)).not.toBe(compile(['src/**'], false));
  });

  it('compiles a bare prefix only when guarding and only for a trailing double star', () => {
    const compile = createKeyCompiler();
    expect(compile(['src/**'], true)[0]!.barePrefixRe).toBeInstanceOf(RegExp);
    expect(compile(['src/**'], false)[0]!.barePrefixRe).toBeUndefined();
    expect(compile(['src/*'], true)[0]!.barePrefixRe).toBeUndefined();
  });
});

describe('matchKeys', () => {
  const compile = createKeyCompiler();

  it('collects every matching key, not only the winner', () => {
    const m = matchKeys('src/lib/a', compile(['src/**', 'src/lib/*']));
    expect(m.matched.slice().sort()).toEqual(['src/**', 'src/lib/*']);
  });

  it('reports no best when nothing matches', () => {
    expect(matchKeys('src/lib/a', compile(['other/*']))).toEqual({ matched: [] });
  });

  it('skips a key whose bare prefix matches the directory', () => {
    // 'src/lib/**' compiles to a pattern that also matches 'src/lib' itself.
    const m = matchKeys('src/lib', compile(['src/lib/**'], true));
    expect(m.matched).toEqual([]);
  });

  it('compiles the bare prefix as a glob, so a wildcard before the trailing stars still guards', () => {
    const m = matchKeys('src/anything/functions', compile(['src/*/functions/**'], true));
    expect(m.matched).toEqual([]);
  });
});

describe('reportAt', () => {
  it('prefers a direct child over a deeper file', () => {
    expect(reportAt('src/lib/Card', ['src/lib/Card/aaa/deep.ts', 'src/lib/Card/zzz.ts'])).toBe('src/lib/Card/zzz.ts');
  });

  it('falls back to the subtree when there is no direct child', () => {
    expect(reportAt('src/lib/Card', ['src/lib/Card/parts/Badge.ts'])).toBe('src/lib/Card/parts/Badge.ts');
  });

  it('picks the same file whatever order the inventory arrives in', () => {
    // `location` is what a baseline and `--diff` are keyed on, so an adapter's traversal order
    // must not decide it. Both branches take the lexicographically first candidate.
    expect(reportAt('src/lib/Card', ['src/lib/Card/zzz.ts', 'src/lib/Card/bbb.ts'])).toBe('src/lib/Card/bbb.ts');
    expect(reportAt('src/lib/Card', ['src/lib/Card/p/z.ts', 'src/lib/Card/p/a.ts'])).toBe('src/lib/Card/p/a.ts');
  });

  it('returns undefined when nothing lies beneath the directory', () => {
    expect(reportAt('src/lib/Card', ['src/other/a.ts'])).toBeUndefined();
  });

  it('does not mistake a sibling with a shared name prefix for a child', () => {
    expect(reportAt('src/lib/Card', ['src/lib/CardList/a.ts'])).toBeUndefined();
  });
});

describe('matchKeys — specificity', () => {
  const compile = createKeyCompiler();

  it('prefers more path segments', () => {
    const m = matchKeys('src/routes/api/x', compile(['src/routes/**', 'src/routes/api/*']));
    expect(m.best).toBe('src/routes/api/*');
  });

  it('prefers a single star over a double star at the same depth', () => {
    // The regression this metric exists for: 'src/lib/features/**' is the LONGER string,
    // so raw length made the broader key win and the narrower declaration inert.
    const m = matchKeys('src/lib/features/catalog', compile(['src/lib/features/*', 'src/lib/features/**']));
    expect(m.best).toBe('src/lib/features/*');
  });

  it('falls back to the longer key when depth and double stars tie', () => {
    const m = matchKeys('src/lib/apiXY', compile(['src/lib/api*', 'src/lib/*']));
    expect(m.best).toBe('src/lib/api*');
  });

  it('falls back to the lexicographically first key when everything else ties', () => {
    // Both keys match 'src/lib/ab': 'a*' by its prefix, '*b' by its suffix. Both are three
    // segments, neither has a '**', and both are ten characters, so only the final comparison
    // can decide it — and '*' sorts before 'a'. Asserting `matched` as well is what keeps this
    // test honest: if a future change stops one of them matching, the tie disappears and the
    // assertion below would start passing for the wrong reason.
    const m = matchKeys('src/lib/ab', compile(['src/lib/a*', 'src/lib/*b']));
    expect(m.matched.slice().sort()).toEqual(['src/lib/*b', 'src/lib/a*']);
    expect(m.best).toBe('src/lib/*b');
  });

  it('picks the same winner whatever order the keys are supplied in', () => {
    // The comparator is a strict total order, so the linear scan must converge on one winner
    // regardless of input order. Same two tying keys, reversed.
    expect(matchKeys('src/lib/ab', compile(['src/lib/*b', 'src/lib/a*'])).best).toBe('src/lib/*b');
  });

  it('counts only whole double-star segments, not stars inside a segment name', () => {
    // 'src/x**' is one segment containing two stars, not a '**' segment.
    const m = matchKeys('src/xy/z', compile(['src/**', 'src/x**/z']));
    expect(m.best).toBe('src/x**/z');
  });
});

describe('isExcluded', () => {
  const compile = createKeyCompiler();

  it('is true when the directory itself matches', () => {
    expect(isExcluded('src/tests', ['src'], compile(['**/tests']))).toBe(true);
  });

  it('is true when an ancestor matches, so the whole subtree is pruned', () => {
    expect(isExcluded('src/tests/deep', ['src', 'src/tests'], compile(['**/tests']))).toBe(true);
  });

  it('is false when nothing matches', () => {
    expect(isExcluded('src/lib', ['src'], compile(['**/tests']))).toBe(false);
  });
});

describe('classifyUnusedKeys', () => {
  const compile = createKeyCompiler();

  it('does nothing when there is nothing to classify', () => {
    expect(classifyUnusedKeys([], ['src/tests'], compile)).toEqual(new Map());
  });

  it('reports a key that matches an excluded directory as shadowed', () => {
    const out = classifyUnusedKeys(['src/**/tests/fixtures/*'], ['src/lib/tests/fixtures/a'], compile);
    expect(out.get('src/**/tests/fixtures/*')).toBe('only-excluded');
  });

  it('reports a key that matches nothing at all as unmatched', () => {
    const out = classifyUnusedKeys(['src/nowhere/*'], ['src/lib/tests/fixtures/a'], compile);
    expect(out.get('src/nowhere/*')).toBe('no-match');
  });

  it('applies the bare-prefix guard, so a trailing-star key is not matched by its own container', () => {
    // Without the guard, 'src/lib/**' would "match" the excluded 'src/lib' and be mislabelled.
    const out = classifyUnusedKeys(['src/lib/**'], ['src/lib'], compile);
    expect(out.get('src/lib/**')).toBe('no-match');
  });
});

describe('childDirs', () => {
  it('maps each parent to its immediate subdirectories, sorted', () => {
    const map = childDirs(['src', 'src/b', 'src/a', 'src/a/deep']);
    expect(map.get('src')).toEqual(['src/a', 'src/b']);
    expect(map.get('src/a')).toEqual(['src/a/deep']);
  });

  it('has no entry for a directory with no subdirectories', () => {
    expect(childDirs(['src', 'src/a']).get('src/a')).toBeUndefined();
  });

  it('drops a top-level directory, which has no parent inside the inventory', () => {
    expect(childDirs(['src']).size).toBe(0);
  });
});

describe('childFiles', () => {
  it('maps each directory to the basenames of its immediate files, sorted', () => {
    const map = childFiles(['src/lib/b.ts', 'src/lib/a.ts', 'src/lib/deep/c.ts']);
    expect(map.get('src/lib')).toEqual(['a.ts', 'b.ts']);
    expect(map.get('src/lib/deep')).toEqual(['c.ts']);
  });

  it('does not attribute a nested file to an ancestor', () => {
    expect(childFiles(['src/lib/deep/c.ts']).get('src/lib')).toBeUndefined();
  });

  it('ignores a file at the root, which has no directory', () => {
    expect(childFiles(['a.ts']).size).toBe(0);
  });
});

describe('splitNames', () => {
  it('splits on the pipe and trims', () => {
    expect(splitNames('parts|functions')).toEqual(['parts', 'functions']);
    expect(splitNames(' parts | functions ')).toEqual(['parts', 'functions']);
  });

  it('drops empty tokens, so a value naming nothing yields nothing', () => {
    expect(splitNames('parts||')).toEqual(['parts']);
    expect(splitNames('|')).toEqual([]);
    expect(splitNames('   ')).toEqual([]);
  });
});

describe('moreSpecificGlob', () => {
  it('prefers more path segments', () => {
    expect(moreSpecificGlob('src/routes/api/*', 'src/routes/**')).toBe(true);
    expect(moreSpecificGlob('src/routes/**', 'src/routes/api/*')).toBe(false);
  });

  it('prefers fewer double-star segments at equal depth', () => {
    expect(moreSpecificGlob('src/lib/features/*', 'src/lib/features/**')).toBe(true);
  });

  it('prefers the longer key when depth and double stars tie', () => {
    expect(moreSpecificGlob('src/lib/api*', 'src/lib/*')).toBe(true);
  });

  it('is false in both directions for two identical globs', () => {
    // This is the property the rule's cross-map tie-break relies on: identical globs are the only
    // pair the four steps cannot separate, so the caller decides.
    expect(moreSpecificGlob('src/lib/Card', 'src/lib/Card')).toBe(false);
  });

  it('agrees with matchKeys on the same pair', () => {
    const compile = createKeyCompiler();
    const m = matchKeys('src/lib/features/fair', compile(['src/lib/features/*', 'src/lib/features/**']));
    expect(m.best).toBe('src/lib/features/*');
    expect(moreSpecificGlob('src/lib/features/*', 'src/lib/features/**')).toBe(true);
  });
});

describe('keysMatchingAny', () => {
  const compile = createKeyCompiler();

  it('returns the keys that match at least one directory', () => {
    const hit = keysMatchingAny(['src/lib/*', 'src/nowhere/*'], ['src/lib/a'], compile);
    expect([...hit]).toEqual(['src/lib/*']);
  });

  it('applies the bare-prefix guard, so a trailing-star key is not matched by its own container', () => {
    expect(keysMatchingAny(['src/lib/**'], ['src/lib'], compile).size).toBe(0);
  });

  it('returns nothing when there is nothing to test', () => {
    expect(keysMatchingAny([], ['src/lib'], compile).size).toBe(0);
    expect(keysMatchingAny(['src/lib/*'], [], compile).size).toBe(0);
  });
});
