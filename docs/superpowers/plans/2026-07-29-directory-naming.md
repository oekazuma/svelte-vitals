# architecture/directory-naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `architecture/directory-naming`, an L3 rule that checks directory-name casing per
location, and correct two defects it exposes in `architecture/unit-entry-file`.

**Architecture:** The glob machinery `architecture/unit-entry-file` grew is extracted into a module
shared by the Architecture rules, then corrected in two ways (a specificity metric that no longer
inverts under `*` versus `**`, and bookkeeping that runs after `exclude` so a shadowed declaration is
reported). The new rule adds a casing vocabulary and a SvelteKit route-segment decoder on top of that
shared base, and consumes the same `RuleContext.sourceFiles` inventory the two existing directory
rules use.

**Tech Stack:** TypeScript, vitest, the existing `Rule` / `RuleOptionsSpec` interfaces in
`packages/core`.

**Spec:** `docs/superpowers/specs/2026-07-29-directory-naming-design.md`

## Global Constraints

- `packages/core` is runtime-agnostic: **no `node:` imports, no I/O, no runtime-specific globals**
  anywhere under `packages/core/src/`. All I/O arrives through `Runtime`.
- New rules land at severity `info`. This rule is L3 and emits **nothing** until `directories` is set.
- Registration happens in **four** places: the import, the `allRules` array, and the re-export block in
  `packages/core/src/rules/index.ts`, plus the duplicate re-export list in
  `packages/core/src/index.ts`. TypeScript does not catch a missed fourth place.
- After adding the rule, regenerate the index pages:
  `cd packages/cli && node scripts/gen-rules-index.mjs`, then format. `packages/cli/test/rules-index.test.mjs`
  fails the build if they are stale, and `packages/cli/test/docs-links.test.ts` fails if either the
  English or the Japanese rule page is missing.
- English and Japanese docs ship together.
- **Never name other tools** (linters, plugins, competing products) in commits, PR bodies, issues or
  docs. Refer to "the project's filename linter" or similar.
- Verify with `pnpm lint`, `pnpm typecheck`, `pnpm test`. If `pnpm` is unusable, the direct
  equivalents are `node_modules/.bin/oxlint .`, `node_modules/.bin/oxfmt --check .`, and, per package,
  `../../node_modules/.bin/vitest run` and `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`.
- Baseline before starting: core 908 tests, cli 767, vite 194, mcp 25.

---

### Task 1: Extract the shared declaration module (no behaviour change)

Pure extraction. Every existing test must pass **unchanged** — that is the whole verification. Do not
alter the tie-break, the bookkeeping order, or anything else here; Tasks 2 and 3 do that deliberately.

`isPascalCase` stays in `unit-entry-file.ts`. It is a first-character test that means something
specific to that rule, and the spec records that the two rules deliberately disagree about what
"PascalCase" means.

**Files:**

- Create: `packages/core/src/rules/architecture/declarations.ts`
- Modify: `packages/core/src/rules/architecture/unit-entry-file.ts`
- Test: `packages/core/test/declarations.test.ts` (create)

**Interfaces:**

- Consumes: `routeGlobToRegExp` from `packages/core/src/config-apply.ts`.
- Produces: `ancestorDirs(file: string): string[]`, `baseName(dir: string): string`,
  `interface CompiledKey { key: string; re: RegExp; barePrefixRe?: RegExp }`,
  `createKeyCompiler(): (globs: string[], bareGuard?: boolean) => CompiledKey[]`,
  `matchKeys(dir: string, compiled: CompiledKey[]): { matched: string[]; best?: string }`,
  `reportAt(dir: string, files: string[]): string | undefined`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/declarations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  ancestorDirs,
  baseName,
  createKeyCompiler,
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/declarations.test.ts`
Expected: FAIL — cannot resolve `../src/rules/architecture/declarations.js`.

- [ ] **Step 3: Create the shared module**

Create `packages/core/src/rules/architecture/declarations.ts`. The bodies are moved verbatim from
`unit-entry-file.ts`; only the compiler changes shape, from a closure over a local `Map` to a factory
that returns one, so each rule gets its own cache.

```ts
/**
 * Glob-declaration machinery shared by the Architecture rules that let a project declare a
 * convention over directory globs — `architecture/unit-entry-file` (design 2026-07-28) and
 * `architecture/directory-naming` (design 2026-07-29).
 *
 * Extracted rather than copied on purpose. The trailing-double-star guard below produced three
 * successive false positives in the first rule that needed it, and a second copy is how a fourth
 * one arrives. Everything here is about *which declaration governs a directory*; what a rule then
 * does with that directory stays in the rule.
 */
import { routeGlobToRegExp } from '../../config-apply.js';

/** Every ancestor directory of `file`, shallowest first (`a/b/c.ts` → ['a', 'a/b']). */
export function ancestorDirs(file: string): string[] {
  const segments = file.split('/');
  const out: string[] = [];
  for (let i = 1; i < segments.length; i++) out.push(segments.slice(0, i).join('/'));
  return out;
}

/** The basename of a directory path. */
export function baseName(dir: string): string {
  const cut = dir.lastIndexOf('/');
  return cut === -1 ? dir : dir.slice(cut + 1);
}

/**
 * A compiled declaration key. `barePrefixRe` is set only when the caller asked for the guard and
 * the key ends in a trailing double-star segment — see `matchKeys`. It is a compiled RegExp, not
 * the bare glob string: the prefix is itself a glob whenever the key carries a wildcard before that
 * trailing segment, so no real directory can ever equal it as a plain string, and a string
 * comparison against it never fires.
 */
export interface CompiledKey {
  key: string;
  re: RegExp;
  barePrefixRe?: RegExp;
}

/**
 * A memoised compiler. A project has a handful of distinct declarations and thousands of
 * directories, so the same glob list is compiled once per rule run. `bareGuard` is part of the
 * cache key, so the same globs compiled both ways do not collide.
 */
export function createKeyCompiler(): (globs: string[], bareGuard?: boolean) => CompiledKey[] {
  const cache = new Map<string, CompiledKey[]>();
  return (globs: string[], bareGuard = false): CompiledKey[] => {
    const cacheKey = JSON.stringify([globs, bareGuard]);
    let entry = cache.get(cacheKey);
    if (entry === undefined) {
      entry = globs.map((key) => ({
        key,
        re: routeGlobToRegExp(key),
        ...(bareGuard && key.endsWith('/**') ? { barePrefixRe: routeGlobToRegExp(key.slice(0, -3)) } : {})
      }));
      cache.set(cacheKey, entry);
    }
    return entry;
  };
}

/**
 * Every declaration key matching `dir`, and the one that governs it.
 *
 * `matched` carries ALL of them, not just the winner: a key that matched a directory but lost the
 * tie-break has still done work, and reporting it as a declaration that checks nothing would be a
 * lie.
 *
 * An entry whose `barePrefixRe` matches `dir` is skipped entirely, not merely denied the win. A
 * trailing `/**` compiles to `(/.*)?`, which also matches the bare prefix itself, so
 * `{ 'src/lib/functions/**': ... }` would otherwise also govern `src/lib/functions` — the container
 * the key was written to reach *under*. The prefix is compiled rather than compared as a string
 * because it is itself a glob when the key carries a wildcard before the trailing double-star
 * segment, and no literal directory string can ever equal a glob.
 */
export function matchKeys(dir: string, compiled: CompiledKey[]): { matched: string[]; best?: string } {
  const matched: string[] = [];
  let best: string | undefined;
  for (const { key, re, barePrefixRe } of compiled) {
    if (barePrefixRe?.test(dir)) continue;
    if (!re.test(dir)) continue;
    matched.push(key);
    if (best === undefined || key.length > best.length || (key.length === best.length && key < best)) best = key;
  }
  return best === undefined ? { matched } : { matched, best };
}

/**
 * The file a finding about `dir` should report at, or `undefined` when nothing lies beneath it.
 *
 * A finding is never keyed on the directory itself: `filterToChangedFiles` keeps only locations git
 * lists as changed, and git never lists a directory, so a directory-keyed finding disappears from
 * every `--diff` run.
 *
 * A direct child is preferred so the finding sits next to the directory it is about, falling back to
 * the subtree for a directory holding only subdirectories. Both branches take the lexicographically
 * first candidate: the caller's inventory is sorted today, but `location` is what a baseline entry
 * and a `--diff` run are keyed on, so letting an adapter's traversal order decide it would move
 * findings silently rather than fail.
 */
export function reportAt(dir: string, files: string[]): string | undefined {
  const prefix = `${dir}/`;
  const under = files.filter((f) => f.startsWith(prefix)).sort();
  return under.find((f) => !f.slice(prefix.length).includes('/')) ?? under[0];
}
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/declarations.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Point `unit-entry-file.ts` at the shared module**

In `packages/core/src/rules/architecture/unit-entry-file.ts`:

1. Delete the local `ancestorDirs`, `baseName`, the `CompiledKey` interface with its long comment,
   and `matchKeys` with its long comment. **Keep `isPascalCase`.**

   Also replace the inline location-selection block near the end of `check` — the one computing
   `prefix`, `under` and `at` with its "Prefer a direct child" comment — with a `reportAt` call:

```ts
const at = reportAt(dir, files);
if (at === undefined) continue; // unreachable: the directory came from a file's prefix
```

That block and the new rule need the identical three lines, and the `.sort()` in it is a fix that
landed during review of the inventory work — kept in one place, it cannot be restored in one rule
and lost in the other. 2. Replace the import block's `routeGlobToRegExp` usage. The file's imports become:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import { listOption, mapOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
import { ancestorDirs, baseName, createKeyCompiler, matchKeys, reportAt } from './declarations.js';
```

3. Replace the local `cache` + `compile` definitions inside `check` with:

```ts
// One cache per run. `bareGuard` is true for `units` and `pascalCaseUnits` alike (see
// `matchKeys` in ./declarations.ts for why both need it, and why `exclude` must never set it).
const compile = createKeyCompiler();
```

- [ ] **Step 6: Run the whole core suite to verify nothing changed**

Run: `cd packages/core && ../../node_modules/.bin/vitest run`
Expected: PASS — 920 tests (908 baseline + 12 new). **No existing test file may need editing.** If one
does, the extraction changed behaviour and is wrong; revert and redo it verbatim.

- [ ] **Step 7: Typecheck and lint**

Run: `cd packages/core && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Run (repo root): `node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/architecture/declarations.ts \
        packages/core/src/rules/architecture/unit-entry-file.ts \
        packages/core/test/declarations.test.ts
git commit -m "refactor(core): extract the glob-declaration machinery shared by the architecture rules"
```

---

### Task 2: Correct the specificity metric

Raw key length inverts specificity whenever `*` and `**` sit at the same position:
`src/lib/features/**` is one character longer than `src/lib/features/*`, so the broader key wins and
the narrower declaration silently does nothing.

**Files:**

- Modify: `packages/core/src/rules/architecture/declarations.ts`
- Test: `packages/core/test/declarations.test.ts`, `packages/core/test/unit-entry-file.test.ts`

**Interfaces:**

- Consumes: `CompiledKey`, `matchKeys` from Task 1.
- Produces: `CompiledKey` gains `segments: number` and `doubleStars: number`. `matchKeys` keeps its
  signature; only its ordering changes.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/declarations.test.ts`:

```ts
describe('matchKeys — specificity', () => {
  const compile = createKeyCompiler();

  it('prefers more path segments', () => {
    const m = matchKeys('src/routes/api/x', compile(['src/routes/**', 'src/routes/api/*']));
    expect(m.best).toBe('src/routes/api/*');
  });

  it('prefers a single star over a double star at the same depth', () => {
    // The regression this metric exists for: 'src/lib/features/**' is the LONGER string,
    // so raw length made the broader key win and the narrower declaration inert.
    const m = matchKeys('src/lib/features/fair', compile(['src/lib/features/*', 'src/lib/features/**']));
    expect(m.best).toBe('src/lib/features/*');
  });

  it('falls back to the longer key when depth and double stars tie', () => {
    const m = matchKeys('src/lib/apiXY', compile(['src/lib/api*', 'src/lib/*']));
    expect(m.best).toBe('src/lib/api*');
  });

  it('falls back to the lexicographically first key when everything else ties', () => {
    const m = matchKeys('src/lib/ab', compile(['src/lib/b*', 'src/lib/a*']));
    expect(m.best).toBe('src/lib/a*');
  });

  it('counts only whole double-star segments, not stars inside a segment name', () => {
    // 'src/x**' is one segment containing two stars, not a '**' segment.
    const m = matchKeys('src/xy/z', compile(['src/**', 'src/x**/z']));
    expect(m.best).toBe('src/x**/z');
  });
});
```

Append to `packages/core/test/unit-entry-file.test.ts`:

```ts
describe('architecture/unit-entry-file — specificity', () => {
  it("keeps the documented example's outcome under the segment-count metric", async () => {
    // The rule page's own example. Every key here has the narrower glob as the longer string too,
    // so the metric change must be a no-op for it — that is what makes the change safe to ship.
    const EXAMPLE = {
      units: {
        'src/lib/api/**/*': '.ts',
        'src/**/functions/*': '.ts',
        'src/**/functions/*/*': '.ts',
        'src/**/stores/*': '.svelte.ts'
      }
    };
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/functions/getFoo/helper/helper.ts', 'src/lib/functions/getFoo/getFoo.ts'], EXAMPLE)
    );
    // Both units conform: getFoo/ via 'functions/*', helper/ via 'functions/*/*'.
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(2);
  });

  it('lets a single-star declaration narrow a double-star one at the same depth', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/widgets/Card/Card.svelte'], {
        units: { 'src/lib/widgets/*': '.ts' },
        pascalCaseUnits: { 'src/lib/widgets/**': '.svelte' }
      })
    );
    // 'src/lib/widgets/Card' is governed by the units key (4 segments, no double star), which
    // wants Card/Card.ts. Under raw length the pascalCaseUnits key would have won and passed.
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('src/lib/widgets/Card/Card.ts');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/declarations.test.ts test/unit-entry-file.test.ts`
Expected: FAIL — "prefers a single star over a double star at the same depth" reports
`src/lib/features/**`, and the widgets test finds 0 failures instead of 1.

- [ ] **Step 3: Add the shape fields and the comparator**

In `packages/core/src/rules/architecture/declarations.ts`, extend `CompiledKey`:

```ts
export interface CompiledKey {
  key: string;
  re: RegExp;
  barePrefixRe?: RegExp;
  /** Path segments in the key, wildcards included. More segments means more specific. */
  segments: number;
  /** How many of those segments are exactly `**`. Fewer means more specific. */
  doubleStars: number;
}
```

Add above `createKeyCompiler`:

```ts
/** Segment count and whole-`**`-segment count, computed once at compile time. */
function keyShape(key: string): { segments: number; doubleStars: number } {
  const parts = key.split('/');
  let doubleStars = 0;
  for (const p of parts) if (p === '**') doubleStars++;
  return { segments: parts.length, doubleStars };
}
```

In `createKeyCompiler`, spread the shape into each entry:

```ts
entry = globs.map((key) => ({
  key,
  re: routeGlobToRegExp(key),
  ...keyShape(key),
  ...(bareGuard && key.endsWith('/**') ? { barePrefixRe: routeGlobToRegExp(key.slice(0, -3)) } : {})
}));
```

Replace the tie-break inside `matchKeys`. Track the winning entry, not just its key:

```ts
export function matchKeys(dir: string, compiled: CompiledKey[]): { matched: string[]; best?: string } {
  const matched: string[] = [];
  let best: CompiledKey | undefined;
  for (const entry of compiled) {
    if (entry.barePrefixRe?.test(dir)) continue;
    if (!entry.re.test(dir)) continue;
    matched.push(entry.key);
    if (best === undefined || moreSpecific(entry, best)) best = entry;
  }
  return best === undefined ? { matched } : { matched, best: best.key };
}
```

And add the comparator with its rationale:

```ts
/**
 * Whether `a` is a more specific declaration than `b`.
 *
 * Depth first, because constraining depth is the strongest thing a key says; then whole `**`
 * segments, fewer winning, because `**` is the loosest thing a key can contain; only then the
 * string length and lexicographic order that used to decide this alone.
 *
 * Length alone is wrong and shipped wrong once: `src/lib/features/**` is one character LONGER than
 * `src/lib/features/*`, so the broader key won and the narrower declaration silently did nothing.
 *
 * One consequence, deliberate: because rule 1 counts wildcard segments too, `src/*​/*​/*` outranks
 * `src/routes/**` despite naming nothing literal. Constraining depth is a form of specificity, so
 * this is defensible, but it is the reverse of the CSS-like intuition that more literal text means
 * more specific. The rule pages say so.
 */
function moreSpecific(a: CompiledKey, b: CompiledKey): boolean {
  if (a.segments !== b.segments) return a.segments > b.segments;
  if (a.doubleStars !== b.doubleStars) return a.doubleStars < b.doubleStars;
  if (a.key.length !== b.key.length) return a.key.length > b.key.length;
  return a.key < b.key;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/core && ../../node_modules/.bin/vitest run`
Expected: PASS — 927 tests. If any pre-existing `unit-entry-file` test now fails, stop: the metric
changed an outcome the spec said it would not, and that needs reporting rather than a test edit.

- [ ] **Step 5: Update the English rule page**

In `docs/src/content/docs/rules/architecture/unit-entry-file.md`, replace:

```markdown
A directory matched by `units` takes that declaration; `pascalCaseUnits` applies only to the rest. When
several `units` globs match, the longest wins, and the alphabetically first among equal-length ties.
```

with:

```markdown
A directory matched by `units` takes that declaration; `pascalCaseUnits` applies only to the rest. When
several globs match one directory, the most specific wins: more path segments first, then fewer `**`
segments, then the longer key, then the alphabetically first. Segment count includes wildcards, so a
key made only of wildcards can outrank one naming a real directory if it is deeper — write the depth
you mean.
```

- [ ] **Step 6: Update the Japanese rule page**

In `docs/src/content/docs/ja/rules/architecture/unit-entry-file.md`, replace:

```markdown
`units` にマッチしたディレクトリはその宣言に従い、`pascalCaseUnits` は残りにだけ適用されます。複数の
`units` glob がマッチした場合は最も長いキーが優先され、同じ長さなら辞書順で先のものが優先されます。
```

with:

```markdown
`units` にマッチしたディレクトリはその宣言に従い、`pascalCaseUnits` は残りにだけ適用されます。1 つの
ディレクトリに複数の glob がマッチした場合は、より特異なものが優先されます。パスのセグメント数が多い
ほうが先、同数なら `**` セグメントが少ないほう、それも同じならキーが長いほう、最後に辞書順です。
セグメント数はワイルドカードも数えるため、実在のディレクトリ名を含むキーより、ワイルドカードだけで
深いキーのほうが勝つことがあります。意図した深さを書いてください。
```

- [ ] **Step 7: Verify docs and formatting**

Run (repo root): `node_modules/.bin/oxfmt --write . && node_modules/.bin/oxlint .`
Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/docs-links.test.ts test/rules-index.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/architecture/declarations.ts \
        packages/core/test/declarations.test.ts \
        packages/core/test/unit-entry-file.test.ts \
        docs/src/content/docs/rules/architecture/unit-entry-file.md \
        docs/src/content/docs/ja/rules/architecture/unit-entry-file.md
git commit -m "fix(core): order declaration keys by depth, not by string length"
```

---

### Task 3: Report declarations that `exclude` shadows completely

Bookkeeping currently runs before the `exclude` check, so a key whose every match is excluded looks
used and is never reported. An excluded directory is one the rule was _forbidden_ to look at, so such
a key evaluates nothing, ever.

The reordering costs the ability to say _which_ silent failure a key hit, because the main pass no
longer tests keys against excluded directories. A deferred second pass buys it back, and runs only
when some key ended with no work recorded.

**Files:**

- Modify: `packages/core/src/rules/architecture/declarations.ts`
- Modify: `packages/core/src/rules/architecture/unit-entry-file.ts`
- Test: `packages/core/test/declarations.test.ts`, `packages/core/test/unit-entry-file.test.ts`

**Interfaces:**

- Consumes: `CompiledKey`, `createKeyCompiler`, Task 1 and 2.
- Produces: `isExcluded(dir: string, ancestors: string[], excluded: CompiledKey[]): boolean`,
  `type UnusedReason = 'no-match' | 'only-excluded'`,
  `classifyUnusedKeys(unused: string[], excludedDirs: string[], compile: (globs: string[], bareGuard?: boolean) => CompiledKey[]): Map<string, UnusedReason>`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/declarations.test.ts`:

```ts
import { classifyUnusedKeys, isExcluded } from '../src/rules/architecture/declarations.js';

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
```

Append to `packages/core/test/unit-entry-file.test.ts`:

```ts
describe('architecture/unit-entry-file — declarations shadowed by exclude', () => {
  it('reports a units key whose every match is excluded', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/tests/fixtures/getFoo/index.ts'], {
        units: { 'src/**/tests/fixtures/*': '.ts' },
        exclude: ['**/tests']
      })
    );
    const project = rs.filter((r) => r.route === undefined);
    expect(project).toHaveLength(1);
    expect(project[0]!.message).toContain('src/**/tests/fixtures/*');
    expect(project[0]!.message).toContain('matched only excluded directories');
  });

  it('distinguishes a shadowed declaration from one that matched nothing', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/tests/fixtures/getFoo/index.ts'], {
        units: { 'src/**/tests/fixtures/*': '.ts', 'src/nowhere/*': '.ts' },
        exclude: ['**/tests']
      })
    );
    const message = rs.find((r) => r.route === undefined)!.message;
    expect(message).toContain("'src/**/tests/fixtures/*' (matched only excluded directories)");
    expect(message).toContain("'src/nowhere/*' (matched no directory)");
  });

  it('still counts a key that matched but lost the tie-break', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/functions/getFoo/getFoo.ts'], {
        units: { 'src/**/functions/*': '.ts', 'src/**': '.ts' }
      })
    );
    // 'src/**' loses to 'src/**/functions/*' on src/lib/functions/getFoo, but it governs
    // src/lib and src/lib/functions, so it has done work either way and must not be reported.
    expect(rs.filter((r) => r.route === undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/declarations.test.ts test/unit-entry-file.test.ts`
Expected: FAIL — `classifyUnusedKeys` and `isExcluded` do not exist, and the shadowed-declaration
tests find zero project-scoped results.

- [ ] **Step 3: Add the two helpers to the shared module**

Append to `packages/core/src/rules/architecture/declarations.ts`:

```ts
/** Whether `dir` or any of its `ancestors` matches an `exclude` glob — the subtree is pruned. */
export function isExcluded(dir: string, ancestors: string[], excluded: CompiledKey[]): boolean {
  return excluded.some(({ re }) => re.test(dir) || ancestors.some((a) => re.test(a)));
}

/** Why a declaration ended a run without checking anything. */
export type UnusedReason = 'no-match' | 'only-excluded';

/**
 * Why each key in `unused` did no work.
 *
 * This is a deliberately deferred second pass. The main pass skips an excluded directory before
 * testing any key against it — which is both the fix for shadowed declarations and a saving on the
 * hot path — and that ordering is exactly what makes it unable to tell "matched nothing" from
 * "matched only excluded directories". Classifying here restores the distinction without giving the
 * saving back: a correct configuration leaves `unused` empty, so this returns immediately and the
 * excluded paths are never tested at all.
 *
 * The bare-prefix guard applies here too. Without it a key of `src/lib/**` would "match" an excluded
 * `src/lib` and be labelled shadowed when it in fact matched nothing.
 */
export function classifyUnusedKeys(
  unused: string[],
  excludedDirs: string[],
  compile: (globs: string[], bareGuard?: boolean) => CompiledKey[]
): Map<string, UnusedReason> {
  const out = new Map<string, UnusedReason>();
  if (unused.length === 0) return out;
  for (const { key, re, barePrefixRe } of compile(unused, true)) {
    const shadowed = excludedDirs.some((d) => !barePrefixRe?.test(d) && re.test(d));
    out.set(key, shadowed ? 'only-excluded' : 'no-match');
  }
  return out;
}
```

- [ ] **Step 4: Reorder `unit-entry-file`'s loop and use the classification**

In `packages/core/src/rules/architecture/unit-entry-file.ts`:

1. Extend the import:

```ts
import {
  ancestorDirs,
  baseName,
  classifyUnusedKeys,
  createKeyCompiler,
  isExcluded,
  matchKeys
} from './declarations.js';
```

2. Declare the collector next to `usedKeys`:

```ts
const usedKeys = new Set<string>();
// Paths skipped as excluded, kept only so an unused key can be told apart from a shadowed one
// at the end of the run. Never consulted unless some key ends with no work recorded.
const excludedDirs: string[] = [];
```

3. Inside the directory loop, move the exclusion block **above** the two `matchKeys` calls, so the
   body reads:

```ts
const units = mapOption(o, 'units');
const pascalUnits = mapOption(o, 'pascalCaseUnits');
if (Object.keys(units).length === 0 && Object.keys(pascalUnits).length === 0) continue; // inert

// `exclude` outranks both declarations and prunes the whole subtree: a directory is exempt
// when it or any ancestor matches. Tested BEFORE any key is matched against this directory.
// An excluded directory is one the rule is forbidden to look at, so a key whose every match
// lands here has evaluated nothing and must not be recorded as having done work — that is a
// declaration silently cancelled by an exclusion, which is precisely what the
// project-scoped finding below exists to surface.
const excluded = compile(listOption(o, 'exclude'));
const ancestors = ancestorDirs(dir);
if (isExcluded(dir, ancestors, excluded)) {
  excludedDirs.push(dir);
  continue;
}

const byPath = matchKeys(dir, compile(Object.keys(units), true));
const byCasing = matchKeys(dir, compile(Object.keys(pascalUnits), true));

// `units`: recorded for every surviving match, before the casing gate below decides whether
// `pascalCaseUnits` gets to set `ext` here, and whether or not the key won the tie-break. A
// key that only ever matches directories a `units` key already won for has still identified
// them, so recording it after the tie-break would falsely call it inert.
for (const k of byPath.matched) if (globalKeys.has(k)) usedKeys.add(k);

// `pascalCaseUnits` is different in kind, not degree: for `units` the casing gate plays no
// role at all, so recording every surviving match is correct. For `pascalCaseUnits` the
// casing gate IS the identification criterion — a directory is never a pascalCaseUnits unit
// unless its basename is PascalCase — so a key that matched only non-PascalCase directories
// has identified nothing. A key like `'src/lib/components'` (missing the trailing `/**` a
// project meant to write) can match one real, lowercase directory; treating that as "used"
// would hide exactly the typo this finding exists to surface.
if (isPascalCase(baseName(dir))) {
  for (const k of byCasing.matched) if (globalKeys.has(k)) usedKeys.add(k);
}
```

Delete the old exclusion block that sat after the bookkeeping.

4. Replace the message construction at the end of `check`:

```ts
const inertKeys = [...globalKeys].filter((key) => !usedKeys.has(key)).sort();
if (inertKeys.length > 0) {
  const reasons = classifyUnusedKeys(inertKeys, excludedDirs, compile);
  const why = (k: string) =>
    reasons.get(k) === 'only-excluded' ? 'matched only excluded directories' : 'matched no directory';
  const message =
    inertKeys.length === 1
      ? `The declaration '${inertKeys[0]}' ${why(inertKeys[0] as string)}, so it checks nothing.`
      : `These declarations check nothing: ${inertKeys.map((k) => `'${k}' (${why(k)})`).join(', ')}.`;
  out.push({
    id: 'architecture/unit-entry-file',
    category: 'architecture',
    severity: 'info',
    detection: { presence: 'none', value: 'absent' },
    message,
    recommendation: 'Correct the glob, or remove the declaration.',
    docsUrl
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/core && ../../node_modules/.bin/vitest run`

Expected: PASS, with **one known exception you must handle**. The single-key wording is unchanged
(`The declaration 'X' matched no directory, so it checks nothing.`), so single-key assertions still
hold. The **multi-key** wording changes from

```text
These declarations matched no directory, so they check nothing: 'X', 'Y'.
```

to

```text
These declarations check nothing: 'X' (matched no directory), 'Y' (matched no directory).
```

Any existing test asserting the old multi-key sentence must be updated to the new one. Update it to
assert the per-key annotations, not a shorter substring — the annotation is the point of the change.
Nothing else in the suite may need editing; if it does, stop and report rather than adjusting it.

- [ ] **Step 6: Update both rule pages**

In `docs/src/content/docs/rules/architecture/unit-entry-file.md`, after the paragraph beginning
"A `units` or `pascalCaseUnits` declaration that checks no directory is reported", add:

```markdown
A declaration whose every match is removed by `exclude` is reported the same way, and says so —
`matched only excluded directories` rather than `matched no directory`. The two have different
remedies: one is a typo in the glob, the other a contradiction between two options you can both see.
```

In `docs/src/content/docs/ja/rules/architecture/unit-entry-file.md`, after the corresponding
paragraph, add:

```markdown
マッチしたディレクトリがすべて `exclude` で除外されている宣言も同じように報告され、その旨が
メッセージに出ます（`matched no directory` ではなく `matched only excluded directories`）。手当てが
違うためです。前者は glob の書き間違いで、後者は目に見える 2 つのオプションどうしの矛盾です。
```

- [ ] **Step 7: Verify**

Run (repo root): `node_modules/.bin/oxfmt --write . && node_modules/.bin/oxlint .`
Run: `cd packages/core && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/docs-links.test.ts`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/architecture/declarations.ts \
        packages/core/src/rules/architecture/unit-entry-file.ts \
        packages/core/test/declarations.test.ts \
        packages/core/test/unit-entry-file.test.ts \
        docs/src/content/docs/rules/architecture/unit-entry-file.md \
        docs/src/content/docs/ja/rules/architecture/unit-entry-file.md
git commit -m "fix(core): report a declaration whose every match exclude removes"
```

---

### Task 4: The casing vocabulary and the route-segment decoder

Two pure functions, no rule yet. They carry every edge case the spec enumerates, so they get their
own module and their own tests.

**Files:**

- Create: `packages/core/src/rules/architecture/casing.ts`
- Test: `packages/core/test/casing.test.ts` (create)

**Interfaces:**

- Produces: `CASINGS: Record<string, RegExp>`,
  `parseCasings(value: string): { known: string[]; unknown: string[] }`,
  `decodeSegment(name: string): string | undefined`,
  `satisfiesCasing(name: string, allowed: string[]): boolean`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/casing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CASINGS, decodeSegment, parseCasings, satisfiesCasing } from '../src/rules/architecture/casing.js';

describe('CASINGS', () => {
  it('names exactly the four documented casings', () => {
    expect(Object.keys(CASINGS).sort()).toEqual(['PascalCase', 'camelCase', 'kebab-case', 'snake_case']);
  });

  it('tests the whole string, not just the first character', () => {
    expect(CASINGS['camelCase']!.test('recommendHalls')).toBe(true);
    expect(CASINGS['camelCase']!.test('recommend-halls')).toBe(false);
    expect(CASINGS['camelCase']!.test('fair_summary')).toBe(false);
    expect(CASINGS['kebab-case']!.test('recommend-halls')).toBe(true);
    expect(CASINGS['kebab-case']!.test('recommendHalls')).toBe(false);
    expect(CASINGS['PascalCase']!.test('SeoContents')).toBe(true);
    expect(CASINGS['PascalCase']!.test('SEOContents')).toBe(true);
    expect(CASINGS['snake_case']!.test('fair_summary')).toBe(true);
  });

  it('lets one lowercase word satisfy three of the four at once', () => {
    for (const name of ['camelCase', 'kebab-case', 'snake_case']) {
      expect(CASINGS[name]!.test('fair')).toBe(true);
    }
    expect(CASINGS['PascalCase']!.test('fair')).toBe(false);
  });
});

describe('parseCasings', () => {
  it('splits a single name', () => {
    expect(parseCasings('camelCase')).toEqual({ known: ['camelCase'], unknown: [] });
  });

  it('splits several names on the pipe', () => {
    expect(parseCasings('camelCase|PascalCase')).toEqual({ known: ['camelCase', 'PascalCase'], unknown: [] });
  });

  it('separates unknown names from known ones', () => {
    expect(parseCasings('camelCase|kebabCase')).toEqual({ known: ['camelCase'], unknown: ['kebabCase'] });
  });

  it('reports a wholly unknown value as having no known name', () => {
    expect(parseCasings('camelcase')).toEqual({ known: [], unknown: ['camelcase'] });
  });

  it('ignores surrounding whitespace and empty segments', () => {
    expect(parseCasings(' camelCase | PascalCase ')).toEqual({ known: ['camelCase', 'PascalCase'], unknown: [] });
    expect(parseCasings('camelCase||')).toEqual({ known: ['camelCase'], unknown: [] });
  });
});

describe('decodeSegment', () => {
  it('unwraps every route-syntax shape SvelteKit gives a whole segment', () => {
    expect(decodeSegment('[hallId]')).toBe('hallId');
    expect(decodeSegment('[hallId=integer]')).toBe('hallId');
    expect(decodeSegment('[...rest]')).toBe('rest');
    expect(decodeSegment('[[optional]]')).toBe('optional');
    expect(decodeSegment('[[lang=locale]]')).toBe('lang');
    expect(decodeSegment('(app)')).toBe('app');
  });

  it('leaves a plain name alone', () => {
    expect(decodeSegment('hallList')).toBe('hallList');
    expect(decodeSegment('recommend-halls')).toBe('recommend-halls');
  });

  it('skips a compound segment, where no single identifier is named', () => {
    expect(decodeSegment('[foo]-[bar]')).toBeUndefined();
    expect(decodeSegment('x[y]z')).toBeUndefined();
    expect(decodeSegment('[]')).toBeUndefined();
    expect(decodeSegment('()')).toBeUndefined();
  });
});

describe('satisfiesCasing', () => {
  it('accepts a name matching any one of the allowed casings', () => {
    expect(satisfiesCasing('SeoContents', ['camelCase', 'PascalCase'])).toBe(true);
    expect(satisfiesCasing('fairSearch', ['camelCase', 'PascalCase'])).toBe(true);
  });

  it('rejects a name matching none of them', () => {
    expect(satisfiesCasing('recommend-halls', ['camelCase', 'PascalCase'])).toBe(false);
  });

  it('accepts a name with no letter in it, whatever is allowed', () => {
    // '2024' carries no casing, so no casing claim can be made about it. A year-archive route
    // cannot be renamed without changing its URL, so reporting it would not be actionable.
    expect(satisfiesCasing('2024', ['camelCase', 'PascalCase'])).toBe(true);
    expect(satisfiesCasing('404', ['PascalCase'])).toBe(true);
  });

  it('still judges a name that mixes digits and letters', () => {
    expect(satisfiesCasing('2024archive', ['camelCase'])).toBe(false);
    expect(satisfiesCasing('v2', ['camelCase'])).toBe(true);
  });

  it('rejects a name carrying a character none of the four admits', () => {
    expect(satisfiesCasing('foo.bar', ['camelCase', 'PascalCase', 'kebab-case', 'snake_case'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/casing.test.ts`
Expected: FAIL — cannot resolve `../src/rules/architecture/casing.js`.

- [ ] **Step 3: Write the module**

Create `packages/core/src/rules/architecture/casing.ts`:

```ts
/**
 * The casing vocabulary and the SvelteKit route-segment decoder used by
 * `architecture/directory-naming` (design 2026-07-29).
 *
 * Each pattern tests the WHOLE name rather than its first character. That is what lets a project
 * distinguish `recommend-halls` from `recommendHalls`; a first-character test — which is what
 * `architecture/unit-entry-file` uses for its own, different question — cannot. The two rules mean
 * different things by "PascalCase" on purpose, and each rule page says which.
 */
export const CASINGS: Record<string, RegExp> = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  'kebab-case': /^[a-z0-9]+(-[a-z0-9]+)*$/,
  snake_case: /^[a-z0-9]+(_[a-z0-9]+)*$/
};

/**
 * Split an option value into the casing names this rule knows and the ones it does not.
 *
 * `validateRuleOptions` checks only that a `string-map` value is a non-empty string — it has no
 * notion of a closed vocabulary — so a mistyped name has to be caught here and reported. A value
 * naming NO known casing is dropped from matching entirely by the caller, so a dead declaration
 * cannot shadow a live one; a value naming some is operative under those.
 */
export function parseCasings(value: string): { known: string[]; unknown: string[] } {
  const known: string[] = [];
  const unknown: string[] = [];
  for (const raw of value.split('|')) {
    const name = raw.trim();
    if (name.length === 0) continue;
    // Presence test rather than `in`, so a name like 'toString' cannot be mistaken for a casing.
    if (CASINGS[name] !== undefined) known.push(name);
    else unknown.push(name);
  }
  return { known, unknown };
}

/**
 * The identifier inside a SvelteKit route-syntax directory name, or `undefined` when the name does
 * not carry exactly one.
 *
 * Checking `[hallId=integer]` literally against a casing would make any declaration reaching into
 * `src/routes/` unusable, so the name is decoded first. The doubled-bracket form has to be
 * recognised before the single-bracket one, or `[[optional]]` decodes to `[optional]` and is thrown
 * away by the final test.
 *
 * That final test is what handles the compound segments SvelteKit allows: `[foo]-[bar]` decodes to
 * `foo]-[bar` and `x[y]z` to itself, both keep a bracket, and neither names one identifier a casing
 * claim could honestly be made about.
 *
 * Decoding keys off the shape of the name alone and is not restricted to `src/routes/`. A directory
 * named `[foo]` outside the routes tree does not occur in practice, so restricting it would add a
 * condition that prevents nothing.
 */
export function decodeSegment(name: string): string | undefined {
  let inner = name;
  if (inner.length > 2 && inner.startsWith('(') && inner.endsWith(')')) inner = inner.slice(1, -1);
  else if (inner.length > 4 && inner.startsWith('[[') && inner.endsWith(']]')) inner = inner.slice(2, -2);
  else if (inner.length > 2 && inner.startsWith('[') && inner.endsWith(']')) inner = inner.slice(1, -1);
  if (inner.startsWith('...')) inner = inner.slice(3);
  const eq = inner.indexOf('=');
  if (eq !== -1) inner = inner.slice(0, eq);
  if (inner.length === 0 || /[[\]()]/.test(inner)) return undefined;
  return inner;
}

/**
 * Whether `name` satisfies any one of `allowed`.
 *
 * A name with no ASCII letter in it satisfies everything. `2024`, `404` and `123` carry no casing at
 * all, so there is no casing claim to make — the same reason a compound route segment is skipped.
 * The patterns alone would not do this: they require a leading letter, so `2024` would fail
 * `camelCase` and a year-archive route would be reported for a name the project cannot change
 * without changing its URL. The line is "contains no letter", not "starts with a digit":
 * `2024archive` does contain letters, is camelCase by no reading, and can be renamed.
 */
export function satisfiesCasing(name: string, allowed: string[]): boolean {
  if (!/[a-zA-Z]/.test(name)) return true;
  return allowed.some((c) => CASINGS[c]?.test(name) === true);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/casing.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rules/architecture/casing.ts packages/core/test/casing.test.ts
git commit -m "feat(core): add the casing vocabulary and the route-segment decoder"
```

---

### Task 5: The `architecture/directory-naming` rule

**Files:**

- Create: `packages/core/src/rules/architecture/directory-naming.ts`
- Modify: `packages/core/src/rules/index.ts` (three places), `packages/core/src/index.ts` (one place)
- Test: `packages/core/test/directory-naming.test.ts` (create)

**Interfaces:**

- Consumes: everything produced by Tasks 1–4.
- Produces: `architectureDirectoryNaming: Rule`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/directory-naming.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { architectureDirectoryNaming } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const fails = (rs: Result[]) => rs.filter((r) => r.location !== undefined);
const project = (rs: Result[]) => rs.filter((r) => r.route === undefined && r.location === undefined);

const ctx = (sourceFiles: string[], options?: Record<string, unknown>): RuleContext => ({
  sourceFiles,
  heads: [],
  project: defaultProject,
  config: defineConfig(options ? { rules: { 'architecture/directory-naming': { options } } } : {})
});

describe('architecture/directory-naming — inertness', () => {
  it('emits nothing when no declaration is given', async () => {
    expect(await architectureDirectoryNaming.check(ctx(['src/lib/Bad_Name/a.ts']))).toEqual([]);
  });

  it('emits nothing when sourceFiles is absent', async () => {
    const c: RuleContext = {
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/directory-naming': { options: { directories: { 'src/**': 'camelCase' } } } }
      })
    };
    expect(await architectureDirectoryNaming.check(c)).toEqual([]);
  });
});

describe('architecture/directory-naming — violations', () => {
  const CAMEL = { directories: { 'src/lib/**': 'camelCase' } };

  it('reports a directory that does not match the declared casing', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/Fair/a.ts'], CAMEL));
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.id).toBe('architecture/directory-naming');
    expect(fails(rs)[0]!.category).toBe('architecture');
    expect(fails(rs)[0]!.severity).toBe('info');
    expect(fails(rs)[0]!.location).toBe('src/lib/Fair/a.ts');
    expect(fails(rs)[0]!.message).toContain('src/lib/Fair');
    expect(fails(rs)[0]!.message).toContain('camelCase');
    expect(fails(rs)[0]!.fix?.description).toContain('Rename');
  });

  it('emits no pass result for a conforming directory', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/fair/a.ts'], CAMEL));
    expect(rs).toEqual([]);
  });

  it('lists every allowed casing in the message', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/some_thing/a.ts'], { directories: { 'src/lib/**': 'camelCase|PascalCase' } })
    );
    expect(fails(rs)[0]!.message).toContain('camelCase or PascalCase');
  });

  it('accepts either casing when the value names both', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/Card/a.ts', 'src/lib/fairSearch/b.ts'], { directories: { 'src/lib/**': 'camelCase|PascalCase' } })
    );
    expect(rs).toEqual([]);
  });

  it('prefers a direct child over a deeper file as the location', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/Fair/aaa/deep.ts', 'src/lib/Fair/zzz.ts'], CAMEL));
    expect(fails(rs)[0]!.location).toBe('src/lib/Fair/zzz.ts');
  });

  it('picks the same location whatever order sourceFiles arrives in', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/Fair/zzz.ts', 'src/lib/Fair/bbb.ts'], CAMEL));
    expect(fails(rs)[0]!.location).toBe('src/lib/Fair/bbb.ts');
  });

  it('never checks the bare prefix of a trailing-double-star key', async () => {
    // 'src/routes' and 'src/lib' are names SvelteKit chooses; the project cannot rename them.
    // Under PascalCase the container would be reported if the guard were missing, so the count
    // and the reported directory together prove the guard fired.
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/routes/hallList/+page.svelte'], { directories: { 'src/routes/**': 'PascalCase' } })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('src/routes/hallList');
    expect(fails(rs).some((r) => r.message.startsWith('src/routes must'))).toBe(false);
  });
});

describe('architecture/directory-naming — route syntax', () => {
  const CAMEL = { directories: { 'src/routes/**': 'camelCase' } };

  it('checks the identifier inside a parameter directory', async () => {
    const ok = await architectureDirectoryNaming.check(ctx(['src/routes/[hallId=integer]/+page.svelte'], CAMEL));
    expect(ok).toEqual([]);
    const bad = await architectureDirectoryNaming.check(ctx(['src/routes/[Hall_Id]/+page.svelte'], CAMEL));
    expect(fails(bad)).toHaveLength(1);
  });

  it('checks the identifier inside a group directory', async () => {
    expect(await architectureDirectoryNaming.check(ctx(['src/routes/(app)/+page.svelte'], CAMEL))).toEqual([]);
  });

  it('skips a compound segment entirely', async () => {
    expect(await architectureDirectoryNaming.check(ctx(['src/routes/[a]-[b]/+page.svelte'], CAMEL))).toEqual([]);
  });

  it('skips a directory whose name carries no letter', async () => {
    expect(await architectureDirectoryNaming.check(ctx(['src/routes/blog/2024/+page.svelte'], CAMEL))).toEqual([]);
  });
});

describe('architecture/directory-naming — exclude', () => {
  it('prunes the directory and everything beneath it', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/tests/Bad_Name/a.ts'], { directories: { 'src/lib/**': 'camelCase' }, exclude: ['**/tests'] })
    );
    expect(fails(rs)).toEqual([]);
  });
});

describe('architecture/directory-naming — declarations that do not check what they say', () => {
  it('reports a glob that matched no directory', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/fair/a.ts'], { directories: { 'src/lib/**': 'camelCase', 'src/nowhere/*': 'camelCase' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
    expect(project(rs)[0]!.message).toContain('matched no directory');
  });

  it('reports a declaration whose every match is excluded', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/tests/fixtures/fair/a.ts'], {
        directories: { 'src/**/tests/fixtures/*': 'camelCase' },
        exclude: ['**/tests']
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('matched only excluded directories');
  });

  it('keeps a key that matched only skipped directories out of the finding', async () => {
    // '[a]-[b]' is skipped as a compound segment, but the key still identified the directory.
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/routes/[a]-[b]/+page.svelte'], { directories: { 'src/routes/*': 'camelCase' } })
    );
    expect(project(rs)).toEqual([]);
  });

  it('keeps a key that matched but lost the tie-break out of the finding', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/fair/a.ts'], { directories: { 'src/**': 'camelCase', 'src/lib/*': 'camelCase' } })
    );
    expect(project(rs)).toEqual([]);
  });

  it('folds several into one finding, so suppressing it is one decision', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/fair/a.ts'], {
        directories: { 'src/lib/**': 'camelCase', 'src/nowhere/*': 'camelCase', 'src/elsewhere/*': 'camelCase' }
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/elsewhere/*'");
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
  });
});

describe('architecture/directory-naming — the casing vocabulary', () => {
  it('drops a wholly mistyped value from matching, so a broader valid key still governs', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/api/Hall/a.ts'], { directories: { 'src/lib/api/*': 'camelcase', 'src/**': 'camelCase' } })
    );
    // 'src/lib/api/*' would win on specificity, but it names no known casing and is dropped,
    // so 'src/**' governs src/lib/api/Hall and reports it.
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('src/lib/api/Hall');
  });

  it('reports a wholly mistyped value as checking nothing', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/api/hall/a.ts'], { directories: { 'src/lib/api/*': 'camelcase' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("unknown casing name 'camelcase'");
    expect(project(rs)[0]!.message).toContain('checks nothing');
  });

  it('keeps a partly mistyped value operative and reports it without "checks nothing"', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/Fair/a.ts'], { directories: { 'src/lib/**': 'camelCase|kebabCase' } })
    );
    // camelCase still governs, so the violation is still reported...
    expect(fails(rs)).toHaveLength(1);
    // ...and the typo is surfaced without claiming the declaration is inert.
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("unknown casing name 'kebabCase'");
    expect(project(rs)[0]!.message).not.toContain('checks nothing');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/directory-naming.test.ts`
Expected: FAIL — `architectureDirectoryNaming` is not exported.

- [ ] **Step 3: Write the rule**

Create `packages/core/src/rules/architecture/directory-naming.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import { listOption, mapOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
import {
  ancestorDirs,
  baseName,
  classifyUnusedKeys,
  createKeyCompiler,
  isExcluded,
  matchKeys,
  reportAt
} from './declarations.js';
import { decodeSegment, parseCasings, satisfiesCasing } from './casing.js';

const docsUrl = docsUrlFor('architecture/directory-naming');
const recommendation = 'Name each directory in the casing its location declares, or narrow the declaration.';

// Inert by default: with nothing declared there is no convention to check, and svelte-vitals never
// guesses what a project's directory names are supposed to mean.
const OPTIONS: RuleOptionsSpec = {
  directories: { kind: 'string-map', default: {} },
  exclude: { kind: 'string-list', default: [] }
};

/**
 * architecture/directory-naming — a directory must be named in the casing its location declares
 * (design 2026-07-29). L3: the declarations come from the project's own `directories` and `exclude`
 * options and are never inferred, so the rule is inert until then.
 *
 * Violations report at a file inside the directory rather than at the directory, because
 * `filterToChangedFiles` keeps only locations git lists as changed and git never lists a directory.
 *
 * There are no pass results. `architecture/unit-entry-file` emits one per conforming unit and can
 * afford to, because it keys the pass on the unit's entry file — a `.svelte` path already present as
 * a score key. This rule's subject is the directory itself, with no such pre-existing key, and
 * `computeScore` seeds every distinct `route` at 100 and averages: a pass per directory would add
 * hundreds of 100s from one `'src/routes/**'` declaration and dilute every real finding.
 */
export const architectureDirectoryNaming: Rule = {
  id: 'architecture/directory-naming',
  title: 'Directory naming',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    'A directory whose name breaks the convention its location declares stops carrying the meaning the convention gave it, and every reader — human or agent — has to open the directory to learn what it is.',
  fix: {
    description: 'Rename the directory to the declared casing, or narrow the declaration that governs it.'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const files = ctx.sourceFiles;
    if (files === undefined) return [];

    const compiledOverrides = compileOverrides(ctx.config);
    const dirs = new Set<string>();
    for (const f of files) for (const d of ancestorDirs(f)) dirs.add(d);

    const compile = createKeyCompiler();
    // Values are parsed once per distinct string, not once per directory.
    const parsed = new Map<string, { known: string[]; unknown: string[] }>();
    const casingsOf = (value: string) => {
      let p = parsed.get(value);
      if (p === undefined) parsed.set(value, (p = parseCasings(value)));
      return p;
    };

    const out: Result[] = [];
    const globalOptions = resolveRuleOptions('architecture/directory-naming', OPTIONS, ctx.config);
    const globalMap = mapOption(globalOptions, 'directories');
    const globalKeys = new Set(Object.keys(globalMap));
    const usedKeys = new Set<string>();
    // Collected only so an unmatched key can be told from a shadowed one at the end. Never
    // consulted unless some key finishes the run with no work recorded.
    const excludedDirs: string[] = [];

    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(
        'architecture/directory-naming',
        OPTIONS,
        ctx.config,
        { route: dir, file: dir },
        compiledOverrides
      );
      const declared = mapOption(o, 'directories');
      if (Object.keys(declared).length === 0) continue; // inert

      // Exclusion first: an excluded directory is one this rule is forbidden to look at, so a key
      // whose every match lands here has evaluated nothing and must not be recorded as work.
      const excluded = compile(listOption(o, 'exclude'));
      if (isExcluded(dir, ancestorDirs(dir), excluded)) {
        excludedDirs.push(dir);
        continue;
      }

      // A key naming no known casing at all is dropped before matching, so it never governs a
      // directory and never wins a tie-break. Left in, a typo would win on specificity, have no
      // casing to apply, and take the whole subtree out of the check — a dead key silently
      // cancelling a live one.
      const live = Object.keys(declared).filter((k) => casingsOf(declared[k] as string).known.length > 0);
      const m = matchKeys(dir, compile(live, true));
      // Recorded for every surviving match, before the two skips below and whether or not the key
      // won the tie-break: in both cases the key identified the directory and a check ran.
      for (const k of m.matched) if (globalKeys.has(k)) usedKeys.add(k);
      if (m.best === undefined) continue;

      const decoded = decodeSegment(baseName(dir));
      if (decoded === undefined) continue; // a compound route segment names no single identifier
      const allowed = casingsOf(declared[m.best] as string).known;
      if (satisfiesCasing(decoded, allowed)) continue;

      const at = reportAt(dir, files);
      if (at === undefined) continue; // unreachable: the directory came from a file's prefix
      out.push({
        id: 'architecture/directory-naming',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        route: at,
        location: at,
        message: `${dir} must be ${allowed.join(' or ')}.`,
        recommendation,
        docsUrl,
        fix: { description: 'Rename the directory, or narrow the declaration that governs it.' }
      });
    }

    // One finding carrying every declaration that is not checking what it says. `findingKey`
    // (`id::route::location`, packages/cli/src/baseline.ts) leaves both fields unset for every
    // project-scoped result, so N separate findings would collapse to one baseline entry and
    // suppressing one would silently suppress the rest.
    //
    // The vocabulary reason is decided FIRST. A key naming no known casing was dropped before
    // matching and so has no recorded work by construction; feeding it to the excluded-directory
    // classification would label a value typo "matched no directory", or worse, "matched only
    // excluded directories".
    const notes = new Map<string, string>();
    for (const key of globalKeys) {
      const { known, unknown } = casingsOf(globalMap[key] as string);
      if (unknown.length === 0) continue;
      const names = unknown.map((u) => `'${u}'`).join(', ');
      notes.set(
        key,
        known.length === 0
          ? `unknown casing name ${names}, so it checks nothing`
          : `unknown casing name ${names}; the rest of the value still applies`
      );
    }
    const unclassified = [...globalKeys].filter(
      (key) => !notes.has(key) && !usedKeys.has(key) && casingsOf(globalMap[key] as string).known.length > 0
    );
    const reasons = classifyUnusedKeys(unclassified, excludedDirs, compile);
    for (const [key, reason] of reasons) {
      notes.set(key, reason === 'only-excluded' ? 'matched only excluded directories' : 'matched no directory');
    }

    const reported = [...notes.keys()].sort();
    if (reported.length > 0) {
      const message =
        reported.length === 1
          ? `The declaration '${reported[0]}' does not check what it says: ${notes.get(reported[0] as string)}.`
          : `These declarations do not check what they say: ${reported.map((k) => `'${k}' (${notes.get(k)})`).join(', ')}.`;
      out.push({
        id: 'architecture/directory-naming',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message,
        recommendation: 'Correct the glob or the casing name, or remove the declaration.',
        docsUrl
      });
    }
    return out;
  }
};
```

- [ ] **Step 4: Register the rule in all four places**

In `packages/core/src/rules/index.ts`:

1. After the `architectureUnitEntryFile` import (line ~65), add:

```ts
import { architectureDirectoryNaming } from './architecture/directory-naming.js';
```

2. In the `allRules` array, after `architectureUnitEntryFile,` add:

```ts
  architectureDirectoryNaming,
```

3. In the re-export block, after `architectureUnitEntryFile,` add:

```ts
  architectureDirectoryNaming,
```

In `packages/core/src/index.ts`, in the `export { ... } from './rules/index.js'` list, after
`architectureUnitEntryFile,` add:

```ts
  architectureDirectoryNaming,
```

- [ ] **Step 5: Confirm the fourth registration site took**

Run: `grep -c architectureDirectoryNaming packages/core/src/rules/index.ts packages/core/src/index.ts`
Expected: `packages/core/src/rules/index.ts:3` and `packages/core/src/index.ts:1`. TypeScript does not
catch a missed entry in the plain re-export list, so this count is the check.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/core && ../../node_modules/.bin/vitest run`
Expected: PASS. All of `directory-naming.test.ts` passes.

- [ ] **Step 7: Typecheck and lint**

Run: `cd packages/core && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Run (repo root): `node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/architecture/directory-naming.ts \
        packages/core/src/rules/index.ts packages/core/src/index.ts \
        packages/core/test/directory-naming.test.ts
git commit -m "feat(core): add architecture/directory-naming"
```

---

### Task 6: Documentation, the documented-example tests, and the changeset

The example in the rule page is load-bearing, not decoration. Two tests hold it to that: one asserts
it examines directories and leaves no declaration reported, and one asserts the `exclude` example
actually removes a finding — which the first structurally cannot check, because an unmatched
`exclude` glob is never reported.

**Files:**

- Create: `docs/src/content/docs/rules/architecture/directory-naming.md`
- Create: `docs/src/content/docs/ja/rules/architecture/directory-naming.md`
- Create: `packages/core/test/directory-naming-example.test.ts`
- Create: `.changeset/directory-naming.md`
- Modify: `docs/src/content/docs/guides/(setup)/configuration.mdx`,
  `docs/src/content/docs/ja/guides/(setup)/configuration.mdx`
- Modify (generated): the rules index pages

- [ ] **Step 1: Write the failing example tests**

Create `packages/core/test/directory-naming-example.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { architectureDirectoryNaming } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

/** The `directories` example from docs/src/content/docs/rules/architecture/directory-naming.md. */
const EXAMPLE = {
  directories: {
    'src/routes/**': 'camelCase|PascalCase',
    'src/routes/svelteApi/*': 'kebab-case',
    'src/lib/features/*': 'camelCase',
    'src/lib/api/*': 'camelCase'
  }
};

/** A tree shaped like the convention the example describes. */
const TREE = [
  'src/routes/+page.svelte',
  'src/routes/search/hallList/+page.svelte',
  'src/routes/[hallId=integer]/components/SeoContents/SeoContents.svelte',
  'src/routes/svelteApi/recommend-halls/+server.ts',
  'src/routes/svelteApi/set-cookie/fetchSetCookie/fetchSetCookie.ts',
  'src/lib/features/fair/index.ts',
  'src/lib/api/searchHalls/index.ts'
];

const run = (sourceFiles: string[], options: Record<string, unknown>) =>
  architectureDirectoryNaming.check({
    sourceFiles,
    heads: [],
    project: defaultProject,
    config: defineConfig({ rules: { 'architecture/directory-naming': { options } } })
  } as RuleContext);

describe('the documented directories example', () => {
  it('is silent on a conforming tree', async () => {
    expect(await run(TREE, EXAMPLE)).toEqual([]);
  });

  it('leaves no declaration reported — every key in it does work', async () => {
    // Silence alone proves nothing: an example whose globs all miss is silent too. This is the
    // assertion that tells a working example from a broken one.
    const rs = await run(TREE, EXAMPLE);
    expect(rs.filter((r) => r.location === undefined)).toEqual([]);
  });

  it('reports the deviations the convention forbids', async () => {
    const rs = await run(
      [
        ...TREE,
        'src/routes/svelteApi/setCookie/+server.ts', // endpoint segment must be kebab-case
        'src/lib/features/FetchOnMount/index.ts' // feature root must be camelCase
      ],
      EXAMPLE
    );
    const messages = rs.filter((r) => r.location !== undefined).map((r) => r.message);
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.includes('src/routes/svelteApi/setCookie') && m.includes('kebab-case'))).toBe(true);
    expect(messages.some((m) => m.includes('src/lib/features/FetchOnMount') && m.includes('camelCase'))).toBe(true);
  });

  it('narrows the routes declaration with the endpoint one rather than being overridden by it', async () => {
    // 'src/routes/svelteApi/*' has four segments to 'src/routes/**''s three, so it wins. Proven by
    // a camelCase endpoint segment being reported: it satisfies the broader declaration, so it can
    // only fail if the narrower one is what governs it.
    const rs = await run([...TREE, 'src/routes/svelteApi/setCookie/+server.ts'], EXAMPLE);
    const messages = rs.filter((r) => r.location !== undefined).map((r) => r.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('src/routes/svelteApi/setCookie must be kebab-case');
  });

  it('lets a function unit one level below an endpoint fall back to the broader declaration', async () => {
    // 'src/routes/svelteApi/*' is one segment too shallow to reach fetchSetCookie/, so the
    // camelCase|PascalCase declaration governs it — which is what the convention wants.
    const rs = await run(TREE, EXAMPLE);
    expect(rs.filter((r) => r.message.includes('fetchSetCookie'))).toEqual([]);
  });
});

describe('the documented exclude example', () => {
  const GENERATED = ['src/lib/generated/api_client/index.ts'];

  it('removes a finding that appears without it', async () => {
    const without = await run([...TREE, ...GENERATED], {
      directories: { ...EXAMPLE.directories, 'src/lib/**': 'camelCase' }
    });
    expect(without.filter((r) => r.location !== undefined)).toHaveLength(1);
  });

  it('is silent with the exclusion in place', async () => {
    const withExclude = await run([...TREE, ...GENERATED], {
      directories: { ...EXAMPLE.directories, 'src/lib/**': 'camelCase' },
      exclude: ['src/lib/generated']
    });
    expect(withExclude.filter((r) => r.location !== undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/directory-naming-example.test.ts`
Expected: the file runs. Any failure here means the example in Step 3 must be written to match
reality, not the other way round — fix the example, or the tree, and record why in the rule page.

- [ ] **Step 3: Write the English rule page**

Create `docs/src/content/docs/rules/architecture/directory-naming.md`:

````markdown
---
title: architecture/directory-naming · Directory naming
description: A directory should be named in the casing its location declares.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a directory whose name does not match the casing you have declared for its location —
`FetchOnMount/` where the features root is camelCase, `setCookie/` where endpoint segments are
kebab-case.

This rule is **off until you configure it**. It has no default idea of what your directory names
should look like, because that is your project's convention, not ours.

## Why it matters

A directory name is the cheapest signal a tree has. When the convention holds, `parts/` and `Card/`
tell a reader — human or agent — what they are without opening anything. One directory that breaks it
costs nothing today and makes the signal unreliable forever after, because a reader who has met one
exception has to check every case from then on.

## How to fix

Rename the directory, or narrow the declaration that swept it in.

## Configuration

| Option        | Type                               | Default |
| ------------- | ---------------------------------- | ------- |
| `directories` | map of directory glob → casing set | `{}`    |
| `exclude`     | list of directory globs            | `[]`    |

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/directory-naming': {
      options: {
        directories: {
          'src/routes/**': 'camelCase|PascalCase',
          'src/routes/svelteApi/*': 'kebab-case',
          'src/lib/features/*': 'camelCase',
          'src/lib/api/*': 'camelCase'
        }
      }
    }
  }
};
```

### The casing names

Four are recognised, and each tests the **whole** name rather than its first character:

| Name         | Accepts                    | Example           |
| ------------ | -------------------------- | ----------------- |
| `camelCase`  | `^[a-z][a-zA-Z0-9]*$`      | `hallList`        |
| `PascalCase` | `^[A-Z][a-zA-Z0-9]*$`      | `SeoContents`     |
| `kebab-case` | `^[a-z0-9]+(-[a-z0-9]+)*$` | `recommend-halls` |
| `snake_case` | `^[a-z0-9]+(_[a-z0-9]+)*$` | `fair_summary`    |

A value may name several, joined by `|`, for a location that legitimately holds more than one kind of
directory — a route's `components/` holds PascalCase component units and camelCase groupings side by
side.

`architecture/unit-entry-file` uses a **looser** definition of PascalCase — it asks only whether the
first character is A–Z, because it is asking whether a directory looks like a unit, not whether its
name conforms. The two rules mean different things by the word on purpose.

**One lowercase word satisfies `camelCase`, `kebab-case` and `snake_case` at once.** `fair` matches
all three, because there is nothing in the name to disagree with. This rule only fires on a name that
carries the evidence of a casing it fails: a capital, a hyphen, an underscore, a leading digit, or a
character none of the four admits.

**A name with no letter in it is never reported.** `2024` and `404` carry no casing, and a
year-archive route cannot be renamed without changing its URL.

### Route directories

A directory whose name is SvelteKit route syntax is decoded before the casing test, so a declaration
reaching into `src/routes/` is usable:

| Directory          | Checked as |
| ------------------ | ---------- |
| `[hallId]`         | `hallId`   |
| `[hallId=integer]` | `hallId`   |
| `[...rest]`        | `rest`     |
| `[[optional]]`     | `optional` |
| `(app)`            | `app`      |

A compound segment such as `[foo]-[bar]` names no single identifier and is skipped.

One consequence: a declaration covering `src/routes/` governs parameter and group names under the
same casing as static segments. A project wanting kebab-case URL segments but camelCase parameters in
one subtree should declare the narrower static-segment globs instead.

### Which declaration wins

When several globs match one directory, the most specific wins: more path segments first, then fewer
`**` segments, then the longer key, then the alphabetically first. That is what lets
`'src/routes/svelteApi/*'` narrow `'src/routes/**'`.

Segment count includes wildcards, so a key made only of wildcards can outrank one naming a real
directory if it is deeper. Write the depth you mean.

A **trailing** `/**` means "everything under this directory" and never governs the directory itself —
which matters here, because the containers those keys name are `src/routes`, `src/lib` and `src`, and
SvelteKit chooses those names, not you.

### `exclude`

**`exclude` removes a directory and everything beneath it.** Use it for a subtree whose names you do
not control — generated code, a vendored tree:

```js
options: {
  directories: { 'src/lib/**': 'camelCase' },
  exclude: ['src/lib/generated']
}
```

If a broad declaration sweeps in a subtree that you _do_ control, narrow the glob instead of excluding
it: an exclusion takes everything below it out of the check as well.

## Limitations

Only directories under `src/` are considered, so anything outside it is never checked and does not
need excluding. File names are not checked at all.

A declaration that is not checking what it says is reported, so a typo cannot leave the rule silently
doing nothing. Four cases land in that finding, each named in the message:

| The declaration                      | Reported as                                       |
| ------------------------------------ | ------------------------------------------------- |
| matched no directory                 | `matched no directory`                            |
| had every match removed by `exclude` | `matched only excluded directories`               |
| names no casing this rule knows      | `unknown casing name '…', so it checks nothing`   |
| names some casing this rule knows    | `unknown casing name '…'; the rest still applies` |

The last is the one worth watching for: the declaration keeps working under its valid names and
quietly enforces less than you wrote.

A declaration naming **no** known casing is dropped before matching, so it cannot shadow a broader
valid declaration that would otherwise govern the same directory.

Two things are deliberately never reported. A declaration written **only** inside an `overrides`
entry is not checked this way, because whether it matched anything depends on which paths the
override applies to. And an `exclude` glob that matches nothing is not reported: an exclusion that
removes nothing has no effect on the report. That does mean a mistyped `exclude` glob is silent when
the subtree it meant to remove had no findings anyway.

A mis-cased directory that is also a declared unit missing its entry file draws a finding from
`architecture/unit-entry-file` as well. Neither suppresses the other — they are different claims and
both are true.
````

- [ ] **Step 4: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/architecture/directory-naming.md` as a faithful translation of
Step 3. Every table, code block, glob, identifier and casing name stays in its original form; only the
prose is translated. Do not add or drop a section — `packages/cli/test/docs-links.test.ts` checks the
pair exists, and the repository convention is that the two trees say the same things.

Frontmatter:

```markdown
---
title: architecture/directory-naming · ディレクトリの命名
description: ディレクトリは、その場所に宣言した記法で名付けるべきです。
---
```

Headings, in this order, matching Step 3 one for one:

```markdown
## チェック内容

## なぜ重要か

## 修正方法

## 設定

### 記法の名前

### ルートディレクトリ

### どの宣言が優先されるか

### `exclude`

## 制限
```

Follow the tone of `docs/src/content/docs/ja/rules/architecture/unit-entry-file.md`, which is the
closest sibling: plain declarative sentences, `**強調**` reserved for the one claim per section that
carries the weight, and the same `**重大度:** info · **カテゴリ:** architecture` line under the
frontmatter.

- [ ] **Step 5: Run the example tests**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/directory-naming-example.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Add the configuration guide bullets**

In `docs/src/content/docs/guides/(setup)/configuration.mdx`, find the list of rules that take options
(it already names `architecture/unit-entry-file` and `architecture/private-scope-import`) and add an
entry in the same shape:

```markdown
- `architecture/directory-naming` — `directories` (directory glob → casing set) and `exclude`
  (directory globs). Off until `directories` is set.
```

Add the equivalent to `docs/src/content/docs/ja/guides/(setup)/configuration.mdx`:

```markdown
- `architecture/directory-naming` — `directories`（ディレクトリ glob → 記法の集合）と `exclude`
  （ディレクトリ glob）。`directories` を設定するまで無効です。
```

- [ ] **Step 7: Regenerate the rule index pages**

Run: `cd packages/cli && node scripts/gen-rules-index.mjs`
Run (repo root): `node_modules/.bin/oxfmt --write .`
Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/rules-index.test.mjs test/docs-links.test.ts`
Expected: PASS. These two tests are what fail CI if the index is stale or a page is missing.

- [ ] **Step 8: Write the changeset**

Create `.changeset/directory-naming.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add `architecture/directory-naming`, which checks that a directory is named in the casing its
location declares. Like the other Architecture convention rules it is off until configured: set
`directories` to a map of directory glob to casing set (`camelCase`, `PascalCase`, `kebab-case`,
`snake_case`, or several joined by `|`). SvelteKit route syntax is decoded before the check, so
`[hallId=integer]` is judged as `hallId` and `(app)` as `app`.

`architecture/unit-entry-file` gains two corrections from the machinery the two rules now share.
Declaration keys are ordered by path depth rather than string length, so a `*` key can narrow a `**`
key at the same depth — previously the broader key won, because it was the longer string, and the
narrower declaration silently did nothing. And a declaration whose every match is removed by
`exclude` is now reported as checking nothing, instead of counting as used.
```

- [ ] **Step 9: Full verification**

Run (repo root): `node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .`
Run per package: `../../node_modules/.bin/vitest run` and `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: clean, with core above 950 tests.

- [ ] **Step 10: Commit**

```bash
git add docs .changeset packages/core/test/directory-naming-example.test.ts
git commit -m "docs: document architecture/directory-naming in English and Japanese"
```

---

### Task 7: End-to-end wiring

The rule reads `sourceFiles`, which both the CLI and the vite plugin build. Neither wiring is covered
for this rule, and a provider-level test would pass with the rule never running at all.

**Files:**

- Create: `packages/cli/test/fixtures/directory-naming-project/` (5 files)
- Modify: `packages/cli/test/analyze-project.test.ts`
- Modify: `packages/vite/test/analyze-source-files.test.ts`

- [ ] **Step 1: Create the CLI fixture**

Create these five files.

`packages/cli/test/fixtures/directory-naming-project/package.json`:

```json
{
  "name": "directory-naming-project-fixture",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@sveltejs/kit": "^2.0.0",
    "svelte": "^5.0.0"
  }
}
```

`packages/cli/test/fixtures/directory-naming-project/svelte-vitals.config.mjs`:

```js
/** Fixture config declaring a directory casing convention (design 2026-07-29). */
export default {
  rules: {
    'architecture/directory-naming': {
      options: { directories: { 'src/lib/**': 'camelCase' } }
    }
  }
};
```

`packages/cli/test/fixtures/directory-naming-project/src/app.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    %sveltekit.head%
  </head>
  <body>
    %sveltekit.body%
  </body>
</html>
```

`packages/cli/test/fixtures/directory-naming-project/src/routes/+page.svelte`:

```svelte
<h1>Home</h1>
```

`packages/cli/test/fixtures/directory-naming-project/src/lib/Fair_Summary/index.ts`:

```ts
// A directory the declaration requires to be camelCase.
export const summary = 'fair';
```

- [ ] **Step 2: Write the failing CLI test**

In `packages/cli/test/analyze-project.test.ts`, add the fixture path beside the others:

```ts
const directoryNamingFixtureDir = join(here, 'fixtures', 'directory-naming-project');
```

and add, next to the existing unit-entry-file wiring tests:

```ts
it('runs architecture/directory-naming over the collected inventory', async () => {
  const { results } = await analyzeProject({ cwd: directoryNamingFixtureDir });
  const found = results.filter((r) => r.id === 'architecture/directory-naming');
  expect(found).toHaveLength(1);
  expect(found[0]!.location).toBe('src/lib/Fair_Summary/index.ts');
  expect(found[0]!.message).toContain('camelCase');
});
```

- [ ] **Step 3: Write the failing vite test**

In `packages/vite/test/analyze-source-files.test.ts`, inside the existing
`describe('analyze wires sourceFiles into the rule context')`, add to `beforeAll`:

```ts
await mkdir(join(cwd, 'src/lib/Fair_Summary'), { recursive: true });
await writeFile(join(cwd, 'src/lib/Fair_Summary/index.ts'), 'export const summary = 1;');
```

and add the test:

```ts
it('runs the casing rule over the same inventory', async () => {
  const r = await analyze(pages, cwd, {
    report: false,
    rules: { 'architecture/directory-naming': { options: { directories: { 'src/lib/**': 'camelCase' } } } }
  });
  const found = r.results.filter((x) => x.id === 'architecture/directory-naming');
  expect(found).toHaveLength(1);
  expect(found[0]!.location).toBe('src/lib/Fair_Summary/index.ts');
});
```

- [ ] **Step 4: Run both tests to verify they fail**

Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/analyze-project.test.ts`
Run: `cd packages/vite && ../../node_modules/.bin/vitest run test/analyze-source-files.test.ts`
Expected: FAIL only if the wiring is broken. **If they pass immediately, that is the correct
outcome** — `sourceFiles` already reaches both contexts, and these tests exist to keep it that way.
Confirm they are load-bearing by deleting `sourceFiles` from the `runRules` call in
`packages/vite/src/analyze.ts`, re-running, seeing the failure, and restoring it.

- [ ] **Step 5: Run the full suite**

Run per package: `../../node_modules/.bin/vitest run`
Expected: PASS in all four packages.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/test packages/vite/test
git commit -m "test: pin the directory-naming wiring from both the CLI and the vite plugin"
```

---

## Final verification

- [ ] `node_modules/.bin/oxlint .` and `node_modules/.bin/oxfmt --check .` clean
- [ ] `../../node_modules/.bin/tsc --noEmit -p tsconfig.json` clean in all four packages
- [ ] `../../node_modules/.bin/vitest run` green in all four packages
- [ ] `cd packages/cli && ../../node_modules/.bin/vitest run test/rules-index.test.mjs test/docs-links.test.ts` green
- [ ] `grep -c architectureDirectoryNaming packages/core/src/rules/index.ts packages/core/src/index.ts` returns 3 and 1
- [ ] The changeset exists and names all four packages
