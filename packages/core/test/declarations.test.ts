import { describe, it, expect } from 'vitest';
import {
  ancestorDirs,
  baseName,
  classifyUnusedKeys,
  createKeyCompiler,
  isExcluded,
  matchKeys,
  reportAt
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
