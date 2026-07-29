# architecture/reserved-directory-names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `architecture/reserved-directory-names`, an L3 rule that holds a directory's immediate
subdirectories to a closed set of names the project declares for that position.

**Architecture:** The rule adds two option maps — one keyed on the parent's own glob, one on a root
whose units it governs — and resolves competition between them with the specificity order the shared
declaration module already implements. Everything about matching, exclusion and inert-declaration
classification comes from that module; this plan extends it with four small primitives and then builds
the rule on top.

**Tech Stack:** TypeScript, vitest, the existing `Rule` / `RuleOptionsSpec` interfaces in
`packages/core`.

**Spec:** `docs/superpowers/specs/2026-07-29-reserved-directory-names-design.md`

## Global Constraints

- `packages/core` is runtime-agnostic: **no `node:` imports, no I/O, no runtime-specific globals**
  anywhere under `packages/core/src/`. All I/O arrives through `Runtime`.
- New rules land at severity `info`. This rule is L3 and emits **nothing** until `scopes` or
  `unitScopes` is set.
- Registration happens in **four** places: the import, the `allRules` array, and the re-export block in
  `packages/core/src/rules/index.ts`, plus the duplicate re-export list in
  `packages/core/src/index.ts`. TypeScript does not catch a missed fourth place.
- After adding the rule, regenerate the index pages: `cd packages/cli && node scripts/gen-rules-index.mjs`,
  then format. `packages/cli/test/rules-index.test.mjs` and `packages/cli/test/docs-links.test.ts` fail
  the build if the index is stale or either language's rule page is missing. **Both read the rule list
  from the built `packages/core/dist`, so rebuild core before trusting them.**
- English and Japanese docs ship together and must not diverge in content.
- **Never name other tools** (linters, plugins, competing products) in commits, PR bodies, issues or
  docs.
- `pnpm` is unreliable in this environment. Use `../../node_modules/.bin/vitest` and
  `../../node_modules/.bin/tsc` from inside a package, and `node_modules/.bin/oxlint` /
  `node_modules/.bin/oxfmt` from the repo root. Run `node_modules/.bin/oxfmt --write .` before
  committing and commit what it produces.
- Baseline before starting: core 992 tests, cli 768, vite 196, mcp 25.

---

### Task 1: Shared-module additions

Five primitives the rule needs, plus one premise none of the three directory rules has ever written
down. Two existing functions are refactored onto the new primitives so the logic exists once.

**Files:**

- Modify: `packages/core/src/rules/architecture/declarations.ts`
- Modify: `packages/core/src/rules/architecture/casing.ts`
- Modify: `packages/core/src/runtime.ts`, `packages/core/src/source-files.ts`
- Test: `packages/core/test/declarations.test.ts`

**Interfaces:**

- Consumes: `ancestorDirs`, `baseName`, `CompiledKey`, `createKeyCompiler`, `matchKeys`,
  `classifyUnusedKeys` — all already in `declarations.ts`.
- Produces:
  - `childDirs(dirs: Iterable<string>): Map<string, string[]>` — parent path → its immediate
    subdirectory **paths**, sorted.
  - `childFiles(files: Iterable<string>): Map<string, string[]>` — directory path → its immediate file
    **basenames**, sorted.
  - `splitNames(value: string): string[]` — the `|`-separated tokens of a declaration value, trimmed,
    empties dropped.
  - `moreSpecificGlob(a: string, b: string): boolean` — whether glob `a` outranks glob `b` under the
    same four-step order `matchKeys` uses.
  - `keysMatchingAny(keys: string[], dirs: readonly string[], compile: (globs: string[], bareGuard?: boolean) => CompiledKey[]): Set<string>`
    — which of `keys` match at least one of `dirs`, with the bare-prefix guard applied.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/declarations.test.ts`, and extend its import to include the five new
names:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/declarations.test.ts`
Expected: FAIL — the five names are not exported.

- [ ] **Step 3: Add the primitives**

In `packages/core/src/rules/architecture/declarations.ts`, add after `baseName`:

```ts
/**
 * Immediate subdirectories of every directory in `dirs`, keyed by parent, each list sorted.
 *
 * A caller that enumerates a parent's children exhaustively inherits two properties of the inventory
 * these paths come from, and both matter: a directory holding no file at any depth never appears, and
 * neither does a dot directory. See `collectSourceFiles`.
 */
export function childDirs(dirs: Iterable<string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const dir of dirs) {
    const cut = dir.lastIndexOf('/');
    if (cut === -1) continue; // a top-level directory has no parent inside the inventory
    const parent = dir.slice(0, cut);
    let kids = out.get(parent);
    if (kids === undefined) out.set(parent, (kids = []));
    kids.push(dir);
  }
  for (const kids of out.values()) kids.sort();
  return out;
}

/** Immediate file basenames of every directory holding at least one, keyed by directory, sorted. */
export function childFiles(files: Iterable<string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of files) {
    const cut = file.lastIndexOf('/');
    if (cut === -1) continue; // a file at the root sits in no directory
    const dir = file.slice(0, cut);
    let own = out.get(dir);
    if (own === undefined) out.set(dir, (own = []));
    own.push(file.slice(cut + 1));
  }
  for (const own of out.values()) own.sort();
  return out;
}

/**
 * The `|`-separated tokens of a declaration value, trimmed, with empty tokens dropped.
 *
 * Two rules encode a set inside one `string-map` value this way, and both need the same answer for
 * `'a | b'`, `'a||b'` and `'|'` — the last of which names nothing and must be reported rather than
 * silently governing.
 */
export function splitNames(value: string): string[] {
  const out: string[] = [];
  for (const raw of value.split('|')) {
    const token = raw.trim();
    if (token.length > 0) out.push(token);
  }
  return out;
}
```

Refactor the comparator so the ordering exists once. Replace `moreSpecific` with:

```ts
/** The three fields the ordering reads, so a compiled key and a bare glob can share one comparator. */
interface Shaped {
  key: string;
  segments: number;
  doubleStars: number;
}

/**
 * Whether `a` is a more specific declaration than `b`.
 *
 * Depth first, because constraining depth is the strongest thing a key says; then whole `**`
 * segments, fewer winning, because `**` is the loosest thing a key can contain; only then the string
 * length and lexicographic order that used to decide this alone.
 *
 * Length alone is wrong and shipped wrong once: `src/lib/features/**` is one character LONGER than
 * `src/lib/features/*`, so the broader key won and the narrower declaration silently did nothing.
 *
 * Two consequences worth naming. Because step 1 counts wildcard segments too, `src/*​/*​/*` outranks
 * `src/routes/**` despite naming nothing literal — constraining depth is a form of specificity, but
 * it is the reverse of the CSS-like intuition that more literal text means more specific. And because
 * the last step is lexicographic on the whole key, **two different globs are always separated**; only
 * two identical globs leave this false in both directions, which is what lets a caller comparing keys
 * from two different option maps detect that case and decide it itself.
 */
function moreSpecificShaped(a: Shaped, b: Shaped): boolean {
  if (a.segments !== b.segments) return a.segments > b.segments;
  if (a.doubleStars !== b.doubleStars) return a.doubleStars < b.doubleStars;
  if (a.key.length !== b.key.length) return a.key.length > b.key.length;
  return a.key < b.key;
}

/** As `moreSpecificShaped`, for two globs that have not been compiled. */
export function moreSpecificGlob(a: string, b: string): boolean {
  return moreSpecificShaped({ key: a, ...keyShape(a) }, { key: b, ...keyShape(b) });
}
```

Then change `matchKeys`'s comparison from `moreSpecific(entry, best)` to
`moreSpecificShaped(entry, best)` and delete the old `moreSpecific`.

Finally, add the matching primitive and refactor `classifyUnusedKeys` onto it. Replace that function
with:

```ts
/**
 * Which of `keys` match at least one of `dirs`.
 *
 * The bare-prefix guard applies: without it a key of `src/lib/**` would "match" a `src/lib` in the
 * list, which is the one directory that key is written to reach *under*.
 */
export function keysMatchingAny(
  keys: string[],
  dirs: readonly string[],
  compile: (globs: string[], bareGuard?: boolean) => CompiledKey[]
): Set<string> {
  const hit = new Set<string>();
  if (keys.length === 0 || dirs.length === 0) return hit;
  for (const { key, re, barePrefixRe } of compile(keys, true)) {
    if (dirs.some((d) => !barePrefixRe?.test(d) && re.test(d))) hit.add(key);
  }
  return hit;
}

/**
 * Why each key in `unused` did no work.
 *
 * This is a deliberately deferred second pass. The main pass skips an excluded directory before
 * testing any key against it — which is both the fix for shadowed declarations and a saving on the
 * hot path — and that ordering is exactly what makes it unable to tell "matched nothing" from
 * "matched only excluded directories". Classifying here restores the distinction without giving the
 * saving back: a correct configuration leaves `unused` empty, so this returns immediately and the
 * excluded paths are never tested at all.
 */
export function classifyUnusedKeys(
  unused: string[],
  excludedDirs: string[],
  compile: (globs: string[], bareGuard?: boolean) => CompiledKey[]
): Map<string, UnusedReason> {
  const out = new Map<string, UnusedReason>();
  if (unused.length === 0) return out;
  const shadowed = keysMatchingAny(unused, excludedDirs, compile);
  for (const key of unused) out.set(key, shadowed.has(key) ? 'only-excluded' : 'no-match');
  return out;
}
```

- [ ] **Step 4: Point `parseCasings` at `splitNames`**

In `packages/core/src/rules/architecture/casing.ts`, import `splitNames` from `./declarations.js` and
replace the loop inside `parseCasings`:

```ts
export function parseCasings(value: string): { known: string[]; unknown: string[] } {
  const known: string[] = [];
  const unknown: string[] = [];
  for (const name of splitNames(value)) {
    // `Object.hasOwn`, not `in` and not a `!== undefined` presence test: both of those walk the
    // prototype chain, so a value of 'toString' or 'constructor' would be taken for a known casing
    // and then blow up in `satisfiesCasing`, where the looked-up member has no `.test`.
    if (Object.hasOwn(CASINGS, name)) known.push(name);
    else unknown.push(name);
  }
  return { known, unknown };
}
```

`packages/core/test/casing.test.ts` already covers the whitespace, empty-token and prototype cases, so
it is the proof this refactor is behaviour-preserving. **Do not edit it.**

- [ ] **Step 5: Document the premise all three directory rules rest on**

In `packages/core/src/runtime.ts`, replace the `glob` member's declaration with:

```ts
  /**
   * Paths matching `pattern`, relative to `cwd`.
   *
   * **Dot files and dot directories are excluded**, and an adapter must keep it that way: the
   * directory-shaped Architecture rules derive their directory set from these paths, and one of them
   * enumerates a parent's children exhaustively, so a `.server/` appearing here would be reported as
   * an undeclared name. Both shipped adapters pass `dot: false`.
   */
  glob(pattern: string, cwd: string): Promise<string[]>;
```

In `packages/core/src/source-files.ts`, append to `collectSourceFiles`'s doc comment, before the
closing `*/`:

```
 * Two properties of the result the directory-shaped rules depend on: a directory containing no file
 * at any depth does not appear among these paths' ancestor prefixes and so does not exist as far as
 * those rules are concerned, and dot directories never appear at all (see `Runtime.glob`).
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/core && ../../node_modules/.bin/vitest run`
Expected: PASS. Test count rises by 15 to 1007. **No existing test file may need editing** — if one
does, a refactor in step 3 or 4 changed behaviour and is wrong; revert it and redo it faithfully.

- [ ] **Step 7: Typecheck, lint, commit**

Run: `cd packages/core && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Run (repo root): `node_modules/.bin/oxfmt --write . && node_modules/.bin/oxlint .`

```bash
git add packages/core/src packages/core/test/declarations.test.ts
git commit -m "feat(core): add the child-directory, name-split and glob-comparison primitives"
```

---

### Task 2: The rule's violation path

The rule, its unit predicate, the cross-map precedence, and the per-child findings. The
project-scoped "declarations that check nothing" finding is Task 3.

**Files:**

- Create: `packages/core/src/rules/architecture/reserved-directory-names.ts`
- Modify: `packages/core/src/rules/index.ts` (three places), `packages/core/src/index.ts` (one place)
- Test: `packages/core/test/reserved-directory-names.test.ts` (create)

**Interfaces:**

- Consumes: everything Task 1 produced, plus `ancestorDirs`, `baseName`, `createKeyCompiler`,
  `isExcluded`, `matchKeys`, `reportAt` from `./declarations.js`.
- Produces: `architectureReservedDirectoryNames: Rule`, and `isUnitDir(dir: string, filesIn: Map<string, string[]>): boolean`
  exported from the rule module for direct testing.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/reserved-directory-names.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { architectureReservedDirectoryNames } from '../src/index.js';
import { isUnitDir } from '../src/rules/architecture/reserved-directory-names.js';
import { childFiles } from '../src/rules/architecture/declarations.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const fails = (rs: Result[]) => rs.filter((r) => r.location !== undefined);

const ctx = (sourceFiles: string[], options?: Record<string, unknown>): RuleContext => ({
  sourceFiles,
  heads: [],
  project: defaultProject,
  config: defineConfig(options ? { rules: { 'architecture/reserved-directory-names': { options } } } : {})
});

describe('isUnitDir', () => {
  const filesIn = (files: string[]) => childFiles(files);

  it('is true for a PascalCase directory holding its same-named file, whatever the extension', () => {
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/Card.svelte']))).toBe(true);
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/Card.ts']))).toBe(true);
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/Card.svelte.ts']))).toBe(true);
  });

  it('is false for a PascalCase directory with no same-named file', () => {
    expect(isUnitDir('src/lib/Icons', filesIn(['src/lib/Icons/Star.svelte']))).toBe(false);
  });

  it('is false when the same-named file is not an immediate child', () => {
    // The file that gives a unit its identity sits beside its subdirectories, never inside one.
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/parts/Card.svelte']))).toBe(false);
  });

  it('is false for a directory whose name does not begin A-Z', () => {
    expect(isUnitDir('src/lib/card', filesIn(['src/lib/card/card.ts']))).toBe(false);
  });
});

describe('architecture/reserved-directory-names — inertness', () => {
  it('emits nothing when nothing is declared', async () => {
    expect(await architectureReservedDirectoryNames.check(ctx(['src/lib/Card/helpers/a.ts']))).toEqual([]);
  });

  it('emits nothing when sourceFiles is absent', async () => {
    const c: RuleContext = {
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/reserved-directory-names': { options: { unitScopes: { 'src/**': 'parts' } } } }
      })
    };
    expect(await architectureReservedDirectoryNames.check(c)).toEqual([]);
  });
});

describe('architecture/reserved-directory-names — unitScopes', () => {
  const UNITS = { unitScopes: { 'src/**': 'parts|tests' } };

  it("reports a unit's child whose name is not declared", async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/helpers/a.ts'], UNITS)
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.id).toBe('architecture/reserved-directory-names');
    expect(fails(rs)[0]!.severity).toBe('info');
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/helpers');
    expect(fails(rs)[0]!.location).toBe('src/lib/Card/helpers/a.ts');
    expect(fails(rs)[0]!.message).toContain('src/lib/Card/helpers');
    expect(fails(rs)[0]!.message).toContain('parts, tests');
    expect(fails(rs)[0]!.fix?.description).toContain('Rename');
  });

  it('accepts a declared name and emits no pass result', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/Badge/Badge.svelte'], UNITS)
    );
    expect(rs).toEqual([]);
  });

  it('reports a PascalCase child too — the set is closed, not lowercase-only', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/Badge/Badge.svelte'], UNITS)
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/Badge');
  });

  it('says nothing about a non-unit directory, so one naming mistake stays one finding', async () => {
    // 'Icons' is PascalCase but has no Icons.* file, so it is not a unit here. Its PascalCase
    // children must NOT each be measured against the vocabulary — that cascade is what the unit
    // definition exists to prevent, and the sibling rule reports 'Icons' itself.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Icons/Star/Star.svelte', 'src/lib/Icons/Moon/Moon.svelte'], UNITS)
    );
    expect(rs).toEqual([]);
  });

  it('gives each offending child its own identity', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/one/a.ts', 'src/lib/Card/two/b.ts'], UNITS)
    );
    expect(
      fails(rs)
        .map((r) => r.route)
        .sort()
    ).toEqual(['src/lib/Card/one', 'src/lib/Card/two']);
  });
});

describe('architecture/reserved-directory-names — scopes', () => {
  it("reports a named parent's child whose name is not declared", async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/api/a.ts', 'src/lib/widgets/b.ts'], { scopes: { 'src/lib': 'api|db' } })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/widgets');
  });

  it('does not require the parent to be a unit', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/api/a.ts'], { scopes: { 'src/lib': 'api' } })
    );
    expect(rs).toEqual([]);
  });
});

describe('architecture/reserved-directory-names — precedence across the two maps', () => {
  // The two declarations name DIFFERENT sets, so which one governed is visible in the message.
  const TREE = ['src/lib/Card/Card.svelte', 'src/lib/Card/tests/a.ts'];

  it('lets a narrow scopes key beat a broad unitScopes key', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(TREE, { scopes: { 'src/lib/*': 'parts' }, unitScopes: { 'src/**': 'parts|tests' } })
    );
    // 'src/lib/*' has three segments to 'src/**''s two, so it governs — and it does not list
    // 'tests', so tests/ is reported.
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/tests');
    expect(fails(rs)[0]!.message).toContain('parts');
    expect(fails(rs)[0]!.message).not.toContain('tests,');
  });

  it('lets a narrow unitScopes key beat a broad scopes key', async () => {
    // The reverse direction. Plain kind-precedence would satisfy the test above on its own, so this
    // is what pins that specificity is what decides: here `scopes` would report tests/ if it won.
    //
    // The broad key is `src/lib/**` rather than `src/**` on purpose. `src/**` would also govern
    // `src/lib`, whose only child is `Card` — not a declared name — adding a violation that has
    // nothing to do with the comparison under test. A trailing `/**` never governs its own bare
    // prefix, so `src/lib/**` reaches `src/lib/Card` without reaching `src/lib`.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(TREE, { scopes: { 'src/lib/**': 'parts' }, unitScopes: { 'src/lib/*': 'parts|tests' } })
    );
    expect(rs).toEqual([]);
  });

  it('falls to scopes when the two globs are identical', async () => {
    // Byte-identical globs are the ONLY pair the four steps cannot separate — step 4 is
    // lexicographic on the whole key. A fixture using two different globs of the same length
    // resolves at step 4 instead and never reaches this decision.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(TREE, { scopes: { 'src/lib/*': 'parts' }, unitScopes: { 'src/lib/*': 'parts|tests' } })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/tests');
  });
});

describe('architecture/reserved-directory-names — exclude', () => {
  it('prunes an excluded parent, so its children are not checked', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/helpers/a.ts'], {
        unitScopes: { 'src/**': 'parts' },
        exclude: ['src/lib/Card']
      })
    );
    expect(fails(rs)).toEqual([]);
  });

  it('prunes an excluded child, leaving its siblings checked', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/helpers/a.ts', 'src/lib/Card/misc/b.ts'], {
        unitScopes: { 'src/**': 'parts' },
        exclude: ['**/helpers']
      })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/misc');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/reserved-directory-names.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the rule**

Create `packages/core/src/rules/architecture/reserved-directory-names.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import { listOption, mapOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
import {
  ancestorDirs,
  baseName,
  childDirs,
  childFiles,
  createKeyCompiler,
  isExcluded,
  matchKeys,
  moreSpecificGlob,
  reportAt,
  splitNames
} from './declarations.js';

const ID = 'architecture/reserved-directory-names';
const docsUrl = docsUrlFor(ID);
const recommendation = 'Use one of the names this location declares, or add the new name to the declaration.';

// Inert by default: which names a project reserves is its own decision, and svelte-vitals never
// guesses one.
const OPTIONS: RuleOptionsSpec = {
  scopes: { kind: 'string-map', default: {} },
  unitScopes: { kind: 'string-map', default: {} },
  exclude: { kind: 'string-list', default: [] }
};

/** The part of a filename before its first dot — `Card.svelte.ts` → `Card`. */
function stem(file: string): string {
  const dot = file.indexOf('.');
  return dot === -1 ? file : file.slice(0, dot);
}

/**
 * Whether `dir` is a unit: its name begins A–Z and one of its **immediate** children is a file whose
 * stem equals the directory's name.
 *
 * This is deliberately NOT `architecture/unit-entry-file`'s definition, which asks only about the
 * first character and then reports whether the entry file is there. Borrowing that one would make a
 * PascalCase directory missing its file — a grouping wearing the wrong name, which that rule already
 * reports once — govern its children here, so a directory of PascalCase components would produce a
 * finding per component. One naming mistake would become N findings, none naming the real problem.
 *
 * The stem is taken to the FIRST dot so that `.svelte.ts` qualifies, which means `Card/Card.test.ts`
 * qualifies too and a directory holding only a test counts as a unit. Accepted: the alternative
 * (strip a single extension) rejects a real entry-file shape, and the failure it would prevent is
 * milder than the one it introduces.
 */
export function isUnitDir(dir: string, filesIn: Map<string, string[]>): boolean {
  const name = baseName(dir);
  const first = name.charCodeAt(0);
  if (!(first >= 65 && first <= 90)) return false;
  const own = filesIn.get(dir);
  return own !== undefined && own.some((f) => stem(f) === name);
}

/**
 * architecture/reserved-directory-names — a directory's immediate subdirectories may only take names
 * the project declared for that position (design 2026-07-29). L3: inert until a scope is declared.
 *
 * Two option maps, differing in what their key names. A `scopes` key names the parent directly. A
 * `unitScopes` key names a root, and the rule governs the children of whichever directories beneath
 * it are units — the shape a glob cannot reach, because units nest to arbitrary depth.
 *
 * There are no pass results. `computeScore` seeds every distinct `route` at 100 and averages, and the
 * subject here is a directory with no pre-existing score key, so a pass per directory would add
 * hundreds of 100s from one broad declaration and dilute every real finding.
 */
export const architectureReservedDirectoryNames: Rule = {
  id: ID,
  title: 'Reserved directory names',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    'A closed set of directory names is only worth writing down if it stays closed: one directory outside it and the table stops describing the tree, so every reader has to open a directory to learn what it holds.',
  fix: {
    description:
      'Rename the directory to a declared name, move it under one of them, or add its name to the declaration.'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const files = ctx.sourceFiles;
    if (files === undefined) return [];

    const compiledOverrides = compileOverrides(ctx.config);
    const dirs = new Set<string>();
    for (const f of files) for (const d of ancestorDirs(f)) dirs.add(d);
    const kids = childDirs(dirs);
    const filesIn = childFiles(files);

    const compile = createKeyCompiler();
    // Values are parsed once per distinct string, not once per directory.
    const parsed = new Map<string, string[]>();
    const namesOf = (value: string) => {
      let n = parsed.get(value);
      if (n === undefined) parsed.set(value, (n = splitNames(value)));
      return n;
    };

    const out: Result[] = [];
    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(ID, OPTIONS, ctx.config, { route: dir, file: dir }, compiledOverrides);
      const scopes = mapOption(o, 'scopes');
      const unitScopes = mapOption(o, 'unitScopes');
      if (Object.keys(scopes).length === 0 && Object.keys(unitScopes).length === 0) continue; // inert

      // Exclusion first: an excluded directory is one this rule is forbidden to look at.
      const excluded = compile(listOption(o, 'exclude'));
      if (isExcluded(dir, ancestorDirs(dir), excluded)) continue;

      // A key naming nothing at all is dropped before matching, so a typo cannot win on specificity
      // and then apply an empty set — under which every child would be reported against a
      // requirement naming no name. `unitScopes` keys are eligible only where the directory is a
      // unit, which is that map's whole identification criterion.
      const liveScopes = Object.keys(scopes).filter((k) => namesOf(scopes[k] as string).length > 0);
      const liveUnits = isUnitDir(dir, filesIn)
        ? Object.keys(unitScopes).filter((k) => namesOf(unitScopes[k] as string).length > 0)
        : [];
      const byPosition = matchKeys(dir, compile(liveScopes, true));
      const byUnit = matchKeys(dir, compile(liveUnits, true));

      // Both kinds of key match the same directory — the parent whose children are governed — so
      // their specificity is comparable and it decides, rather than one kind outranking the other.
      // `moreSpecificGlob` is false in both directions only for two identical globs, since its last
      // step is lexicographic on the whole key; that is the one case it cannot settle, and it falls
      // to `scopes` because `scopes` applies to every directory its key matches while `unitScopes`
      // applies only to the ones that are units — so preferring it keeps a single glob's outcome
      // uniform across its matches.
      let governing: string[] | undefined;
      if (byPosition.best !== undefined && byUnit.best !== undefined) {
        governing = moreSpecificGlob(byUnit.best, byPosition.best)
          ? namesOf(unitScopes[byUnit.best] as string)
          : namesOf(scopes[byPosition.best] as string);
      } else if (byPosition.best !== undefined) {
        governing = namesOf(scopes[byPosition.best] as string);
      } else if (byUnit.best !== undefined) {
        governing = namesOf(unitScopes[byUnit.best] as string);
      }
      if (governing === undefined) continue;

      const allowed = new Set(governing);
      for (const child of kids.get(dir) ?? []) {
        if (allowed.has(baseName(child))) continue;
        // The child's own exclusion, resolved separately: an `overrides` entry can prune the child
        // specifically, and the parent's resolved list would not show it. Only reached for a
        // violation candidate, so the cost is per finding rather than per directory.
        const childOptions = resolveRuleOptions(
          ID,
          OPTIONS,
          ctx.config,
          { route: child, file: child },
          compiledOverrides
        );
        if (isExcluded(child, ancestorDirs(child), compile(listOption(childOptions, 'exclude')))) continue;

        const at = reportAt(child, files);
        if (at === undefined) continue; // unreachable: the directory came from a file's prefix
        // `route` is the offending directory, `location` a file inside it. `location` must be a path
        // git lists as changed or `filterToChangedFiles` drops the finding from every `--diff` run,
        // and git never lists a directory; `route` carries the directory so that two findings
        // resolving to the same file keep distinct `findingKey`s (`id::route::location`).
        out.push({
          id: ID,
          category: 'architecture',
          severity: 'info',
          detection: { presence: 'none', value: 'absent' },
          route: child,
          location: at,
          message: `${child} is not one of the names declared here: ${governing.join(', ')}.`,
          recommendation,
          docsUrl,
          fix: {
            description: 'Rename it to a declared name, move it under one of them, or add its name to the declaration.'
          }
        });
      }
    }
    return out;
  }
};
```

- [ ] **Step 4: Register the rule in all four places**

In `packages/core/src/rules/index.ts`: add the import beside the other architecture rules, add
`architectureReservedDirectoryNames,` to the `allRules` array, and add it to the re-export block.

In `packages/core/src/index.ts`: add `architectureReservedDirectoryNames,` to the
`export { … } from './rules/index.js'` list.

- [ ] **Step 5: Confirm the fourth registration site took**

Run: `grep -c architectureReservedDirectoryNames packages/core/src/rules/index.ts packages/core/src/index.ts`
Expected: `packages/core/src/rules/index.ts:3` and `packages/core/src/index.ts:1`. TypeScript does not
catch a miss in the plain re-export list, so this count is the check.

- [ ] **Step 6: Run the tests**

Run: `cd packages/core && ../../node_modules/.bin/vitest run`
Expected: PASS, all of `reserved-directory-names.test.ts` included.

- [ ] **Step 7: Typecheck, lint, commit**

Run: `cd packages/core && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Run (repo root): `node_modules/.bin/oxfmt --write . && node_modules/.bin/oxlint .`

```bash
git add packages/core/src packages/core/test/reserved-directory-names.test.ts
git commit -m "feat(core): add architecture/reserved-directory-names"
```

---

### Task 3: Declarations that do not check what they say

Five reasons in one folded finding. The two options-derived reasons are decided first, because a key
they name has no recorded work by construction and the traversal classification would mislabel it.

**Files:**

- Modify: `packages/core/src/rules/architecture/reserved-directory-names.ts`
- Test: `packages/core/test/reserved-directory-names.test.ts`

**Interfaces:**

- Consumes: `classifyUnusedKeys`, `keysMatchingAny` from `./declarations.js`; everything in Task 2.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/reserved-directory-names.test.ts`:

```ts
const project = (rs: Result[]) => rs.filter((r) => r.route === undefined && r.location === undefined);

describe('architecture/reserved-directory-names — declarations that check nothing', () => {
  it('reports a glob that matched no directory', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], { unitScopes: { 'src/**': 'parts', 'src/nowhere/*': 'parts' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
    expect(project(rs)[0]!.message).toContain('matched no directory');
  });

  it('reports a declaration whose every match is excluded', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/tests/Card/Card.svelte'], {
        unitScopes: { 'src/**/tests/*': 'parts' },
        exclude: ['**/tests']
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('matched only excluded directories');
  });

  it('reports a unitScopes key that matched directories but never a unit', async () => {
    // 'src/lib/*' matches src/lib/grouping, which holds no same-named file and so is not a unit.
    // The unit test IS this map's identification criterion, so the key identified nothing.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/grouping/a.ts'], { unitScopes: { 'src/lib/*': 'parts' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('matched no unit');
  });

  it('does not report a unitScopes key that governed a unit whose children all conform', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/Badge/Badge.svelte'], {
        unitScopes: { 'src/**': 'parts' }
      })
    );
    expect(project(rs)).toEqual([]);
  });

  it('does not report a key that matched but lost the specificity comparison', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/Badge/Badge.svelte'], {
        unitScopes: { 'src/**': 'parts', 'src/lib/*': 'parts' }
      })
    );
    // 'src/**' loses at src/lib/Card, but it identified that directory, so calling it a declaration
    // that checks nothing would be a lie.
    expect(project(rs)).toEqual([]);
  });

  it('reports a value that names nothing at all', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], { unitScopes: { 'src/**': '|' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('names no directory name at all');
  });

  it('reports the same glob declared in both maps', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], { scopes: { 'src/lib/*': 'parts' }, unitScopes: { 'src/lib/*': 'parts' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('declared in both');
  });

  it('reports the same glob when the collision is assembled across config layers', async () => {
    // The likeliest way it arises: these options merge additively, so a base config and an
    // overrides entry can produce the pair without either author seeing both halves. The check
    // reads the per-directory resolution too, which is where an override's contribution appears.
    const rs = await architectureReservedDirectoryNames.check({
      sourceFiles: ['src/lib/Card/Card.svelte'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/reserved-directory-names': { options: { scopes: { 'src/lib/*': 'parts' } } } },
        overrides: [
          {
            files: 'src/**',
            rules: { 'architecture/reserved-directory-names': { options: { unitScopes: { 'src/lib/*': 'parts' } } } }
          }
        ]
      })
    });
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('declared in both');
  });

  it('does not report a key declared only inside an overrides entry as inert', async () => {
    // The inherited limitation: deciding whether an overrides-only key matched anything means
    // intersecting that entry's scope with the directory set.
    const rs = await architectureReservedDirectoryNames.check({
      sourceFiles: ['src/lib/Card/Card.svelte'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        overrides: [
          {
            files: 'src/**',
            rules: {
              'architecture/reserved-directory-names': { options: { unitScopes: { 'src/nowhere/*': 'parts' } } }
            }
          }
        ]
      })
    });
    expect(project(rs)).toEqual([]);
  });

  it('says nothing about a declared name the tree never uses', async () => {
    // The set says what may appear, not what must. A deliberately-held-open slot is a legitimate
    // state, unlike the sibling rule's unknown casing name, which is a typo by definition because
    // that vocabulary belongs to the rule rather than to the project.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/Badge/Badge.svelte'], {
        unitScopes: { 'src/**': 'parts|functions|stores|neverUsed' }
      })
    );
    expect(rs).toEqual([]);
  });

  it('folds several into one finding, so suppressing it is one decision', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], {
        unitScopes: { 'src/**': 'parts', 'src/nowhere/*': 'parts', 'src/elsewhere/*': 'parts' }
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/elsewhere/*'");
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/reserved-directory-names.test.ts`
Expected: FAIL — no project-scoped result is produced.

- [ ] **Step 3: Add the bookkeeping and the finding**

In the rule, extend the import from `./declarations.js` with `classifyUnusedKeys` and `keysMatchingAny`.

Before the directory loop, add:

```ts
const globalOptions = resolveRuleOptions(ID, OPTIONS, ctx.config);
const globalScopes = mapOption(globalOptions, 'scopes');
const globalUnits = mapOption(globalOptions, 'unitScopes');
const globalKeys = new Set([...Object.keys(globalScopes), ...Object.keys(globalUnits)]);
const usedKeys = new Set<string>();
// Collected so the deferred classification can tell an unmatched key from a shadowed one, and a
// `unitScopes` key that never met a unit from either. Neither list is consulted unless some key
// ends the run with no work recorded.
const excludedDirs: string[] = [];
const nonUnitDirs: string[] = [];
// A glob in both maps is a property of the options, not of the tree. Checked against the global
// resolution — which catches it even when no directory is examined — and against each
// per-directory resolution, which is where an `overrides` entry's contribution appears.
const collisions = new Set<string>();
const noteCollisions = (a: Record<string, string>, b: Record<string, string>) => {
  for (const key of Object.keys(a)) if (Object.hasOwn(b, key)) collisions.add(key);
};
noteCollisions(globalScopes, globalUnits);
```

Inside the loop, immediately after `scopes` and `unitScopes` are read and the inert check passes:

```ts
noteCollisions(scopes, unitScopes);
```

Replace the exclusion `continue` with one that records:

```ts
if (isExcluded(dir, ancestorDirs(dir), excluded)) {
  excludedDirs.push(dir);
  continue;
}
```

After `liveUnits` is computed, record the non-unit case and the matches:

```ts
const isUnit = isUnitDir(dir, filesIn);
const liveUnits = isUnit ? Object.keys(unitScopes).filter((k) => namesOf(unitScopes[k] as string).length > 0) : [];
if (!isUnit) nonUnitDirs.push(dir);
const byPosition = matchKeys(dir, compile(liveScopes, true));
const byUnit = matchKeys(dir, compile(liveUnits, true));
// Recorded for every surviving match, whether or not the key won the comparison: in both
// cases the key identified the directory and a check ran.
for (const k of byPosition.matched) if (globalKeys.has(k)) usedKeys.add(k);
for (const k of byUnit.matched) if (globalKeys.has(k)) usedKeys.add(k);
```

At the end of `check`, before `return out`:

```ts
// One finding carrying every declaration that is not checking what it says. `findingKey`
// (`id::route::location`, packages/cli/src/baseline.ts) leaves both fields unset for every
// project-scoped result, so N separate findings would collapse to one baseline entry and
// suppressing one would silently suppress the rest.
//
// The two options-derived reasons are decided FIRST. A key they name has no recorded work by
// construction — a colliding `unitScopes` entry never governs, and a key naming nothing is
// dropped before matching — so feeding either to the traversal classification would label a
// configuration contradiction "matched no directory".
const notes = new Map<string, string>();
for (const key of collisions) {
  notes.set(key, 'declared in both scopes and unitScopes, so the unitScopes entry never applies');
}
for (const key of globalKeys) {
  if (notes.has(key)) continue;
  const value = globalScopes[key] ?? globalUnits[key];
  if (value !== undefined && namesOf(value).length === 0) {
    notes.set(key, 'names no directory name at all, so it checks nothing');
  }
}

const unused = [...globalKeys].filter((k) => !notes.has(k) && !usedKeys.has(k));
// A `unitScopes`-only key is recorded solely by matching a unit, so one that matched a non-unit
// and nothing else identified nothing. That is the same distinction `pascalCaseUnits` draws in
// `architecture/unit-entry-file`, where the casing gate is the identification criterion; here
// the gate is the unit test. Decided before the excluded/unmatched split, so an exclusion is
// never blamed for a key the unit test disqualified.
// This ordering is also what keeps the excluded label honest, and is why no separate
// "matched something surviving" set is needed here. `usedKeys` is narrower than "matched a
// surviving directory" — a `unitScopes` key is never recorded at a non-unit — so feeding such a
// key straight to `classifyUnusedKeys` could blame an exclusion whose removal changes nothing.
// Claiming the non-unit reason first removes the key from that pass entirely.
const unitOnly = unused.filter((k) => Object.hasOwn(globalUnits, k) && !Object.hasOwn(globalScopes, k));
for (const key of keysMatchingAny(unitOnly, nonUnitDirs, compile)) {
  notes.set(key, 'matched directories but never a unit, so it checks nothing');
}
for (const [key, reason] of classifyUnusedKeys(
  unused.filter((k) => !notes.has(k)),
  excludedDirs,
  compile
)) {
  notes.set(key, reason === 'only-excluded' ? 'matched only excluded directories' : 'matched no directory');
}

const reported = [...notes.keys()].sort();
if (reported.length > 0) {
  const message =
    reported.length === 1
      ? `The declaration '${reported[0]}' does not check what it says: ${notes.get(reported[0] as string)}.`
      : `These declarations do not check what they say: ${reported.map((k) => `'${k}' (${notes.get(k)})`).join(', ')}.`;
  out.push({
    id: ID,
    category: 'architecture',
    severity: 'info',
    detection: { presence: 'none', value: 'absent' },
    message,
    recommendation: 'Correct the glob or the names, or remove the declaration.',
    docsUrl
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `cd packages/core && ../../node_modules/.bin/vitest run`
Expected: PASS.

- [ ] **Step 5: Prove the collision check reads the per-directory resolution**

Delete the `noteCollisions(scopes, unitScopes)` line inside the loop, re-run
`test/reserved-directory-names.test.ts`, and confirm **only** the cross-layer test fails — the
global-collision test must still pass, since it is caught by `noteCollisions(globalScopes, globalUnits)`.
Restore the line. Record both outcomes in your report: a check with two detection points needs each
one shown to be load-bearing on its own.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `cd packages/core && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Run (repo root): `node_modules/.bin/oxfmt --write . && node_modules/.bin/oxlint .`

```bash
git add packages/core/src/rules/architecture/reserved-directory-names.ts \
        packages/core/test/reserved-directory-names.test.ts
git commit -m "feat(core): report reserved-directory-names declarations that check nothing"
```

---

### Task 4: Documentation, the example tests, and the changeset

**Files:**

- Create: `docs/src/content/docs/rules/architecture/reserved-directory-names.md`,
  `docs/src/content/docs/ja/rules/architecture/reserved-directory-names.md`,
  `packages/core/test/reserved-directory-names-example.test.ts`, `.changeset/reserved-directory-names.md`
- Modify: `docs/src/content/docs/guides/(setup)/configuration.mdx`,
  `docs/src/content/docs/ja/guides/(setup)/configuration.mdx`
- Modify (generated): the rule-index pages

- [ ] **Step 1: Write the failing example tests**

Create `packages/core/test/reserved-directory-names-example.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { architectureReservedDirectoryNames } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

/** The example from docs/src/content/docs/rules/architecture/reserved-directory-names.md. */
const EXAMPLE = {
  scopes: { 'src/lib': 'api|components|features|effect|db' },
  unitScopes: { 'src/**': 'parts|functions|stores|types|tests|styleGuide' }
};

/** A tree shaped like the convention the example describes. */
const TREE = [
  'src/lib/api/user/fetchUser/fetchUser.ts',
  'src/lib/components/Card/Card.svelte',
  'src/lib/components/Card/parts/Badge/Badge.svelte',
  'src/lib/components/Card/functions/formatTitle/formatTitle.ts',
  'src/lib/components/Card/tests/Card.test.ts',
  'src/lib/components/Card/styleGuide/Card.styleGuide.svelte',
  'src/lib/features/blog/index.ts',
  'src/lib/effect/OnVisible/OnVisible.svelte',
  'src/lib/db/types/user.ts'
];

const run = (sourceFiles: string[], options: Record<string, unknown>) =>
  architectureReservedDirectoryNames.check({
    sourceFiles,
    heads: [],
    project: defaultProject,
    config: defineConfig({ rules: { 'architecture/reserved-directory-names': { options } } })
  } as RuleContext);

describe('the documented example', () => {
  it('is silent on a conforming tree — and silence is proof here, not absence of proof', async () => {
    // For most rules a silent example proves nothing: globs that miss everything are silent too.
    // This rule closes that gap itself — a declaration that identified nothing is reported — so an
    // example producing no result at all has also shown every one of its keys did work.
    expect(await run(TREE, EXAMPLE)).toEqual([]);
  });

  it('reports a name the convention does not admit, under a unit', async () => {
    const rs = await run([...TREE, 'src/lib/components/Card/helpers/a.ts'], EXAMPLE);
    const messages = rs.filter((r) => r.location !== undefined).map((r) => r.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('src/lib/components/Card/helpers');
    expect(messages[0]).toContain('parts, functions, stores, types, tests, styleGuide');
  });

  it('reports a name the convention does not admit, at a named position', async () => {
    const rs = await run([...TREE, 'src/lib/widgets/a.ts'], EXAMPLE);
    const messages = rs.filter((r) => r.location !== undefined).map((r) => r.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('src/lib/widgets');
    expect(messages[0]).toContain('api, components, features, effect, db');
  });

  it('never exercises the precedence comparison, which is why test 1 of the plan carries it', async () => {
    // The `scopes` key names a directory that is not a unit, and no `scopes` key names a unit, so
    // the two declarations never compete on this configuration.
    const rs = await run(TREE, EXAMPLE);
    expect(rs).toEqual([]);
  });
});

describe('the documented exclude example', () => {
  const GENERATED = ['src/lib/components/Card/generated/a.ts'];

  it('reports the generated directory without the exclusion', async () => {
    const rs = await run([...TREE, ...GENERATED], EXAMPLE);
    expect(rs.filter((r) => r.location !== undefined)).toHaveLength(1);
  });

  it('is silent with the exclusion in place', async () => {
    const rs = await run([...TREE, ...GENERATED], { ...EXAMPLE, exclude: ['**/generated'] });
    expect(rs.filter((r) => r.location !== undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/reserved-directory-names-example.test.ts`
Expected: the file runs. **If a test fails, the example changes, not the test.** Fix `EXAMPLE` or
`TREE` so the documented configuration is genuinely correct, and say what you changed in your report.

- [ ] **Step 3: Write the English rule page**

Create `docs/src/content/docs/rules/architecture/reserved-directory-names.md`:

````markdown
---
title: architecture/reserved-directory-names · Reserved directory names
description: A directory's subdirectories should only take names declared for that position.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a directory whose name is not one of the names you declared for its position — a `helpers/`
inside a component unit that may only hold `parts/`, `functions/` and `tests/`.

This rule is **off until you configure it**. It has no default idea of which names your project
reserves.

## Why it matters

A closed set of directory names is only worth writing down if it stays closed. The first directory
outside it costs nothing — it is correctly cased, it sits in a plausible place — but the table stops
describing the tree, and from then on a reader who has met one exception has to open every directory
to learn what it holds.

`architecture/directory-naming` checks a directory's **casing**; this checks its **name**. A
`helpers/` is perfectly camelCase, so no casing declaration objects to it.

## How to fix

Rename the directory to a declared name, move it under one of them, or add its name to the
declaration — deciding to widen the set is a legitimate outcome, as long as it is a decision.

## Configuration

| Option       | Type                                        | Default |
| ------------ | ------------------------------------------- | ------- |
| `scopes`     | map of directory glob → allowed child names | `{}`    |
| `unitScopes` | map of root glob → allowed child names      | `{}`    |
| `exclude`    | list of directory globs                     | `[]`    |

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/reserved-directory-names': {
      options: {
        scopes: { 'src/lib': 'api|components|features|effect|db' },
        unitScopes: { 'src/**': 'parts|functions|stores|types|tests|styleGuide' }
      }
    }
  }
};
```

### The two options differ in what their key names

**A `scopes` key names the parent directly.** `'src/lib'` matches `src/lib`, and the names its
immediate subdirectories may take are the ones you list.

**A `unitScopes` key names a root.** `'src/**'` matches every directory beneath `src`, and the rule
governs the children of whichever of them are **units** — a directory whose name begins with a capital
and which holds a file named after it (`Card/Card.svelte`, `Card/Card.ts`, `Card/Card.svelte.ts`). Use
it for a closed set that hangs off something a glob cannot reach, because units nest to arbitrary
depth.

A `scopes` key is only worth writing where the children are **entirely** drawn from the names you
list. A route directory holds its reserved names beside its route segments, and route segments are
unbounded — one per page — so no declaration belongs there. Writing one anyway reports every segment.

The names in one declaration need not be the names in another. Each declared position has its own
closed set; there is no single table.

### Which declaration wins

When both maps match one directory, the most specific key governs: more path segments first, then
fewer `**` segments, then the longer key, then alphabetically first. That is what lets either map
narrow the other.

Two **identical** globs are the only pair those steps cannot separate, and there `scopes` wins —
because it applies to every directory its key matches, while `unitScopes` applies only to the ones
that are units. Declaring the same glob in both maps is reported: the `unitScopes` entry can never
apply, so it checks nothing.

A **trailing** `/**` means "everything under this directory" and never governs the directory itself.

### `exclude`

**`exclude` removes a directory and everything beneath it.** Use it for a subtree whose names you do
not control:

```js
options: {
  unitScopes: { 'src/**': 'parts|functions|tests' },
  exclude: ['**/generated']
}
```

## Limitations

Only directories under `src/` are considered. File names are not checked. Dot directories never
appear, so they need no excluding.

**A PascalCase directory that holds no file named after it is not a unit here**, and this rule says
nothing about its children. That directory is `architecture/unit-entry-file`'s finding — reported once,
rather than once per child.

The rule says "here, only these names". It cannot say "this name, only here": a `parts/` in the wrong
place is invisible unless that place is itself declared.

**A project that nests units directly inside units should not declare `unitScopes`** — the nested unit
is a child not in the set, and would be reported.

A declaration that is not checking what it says is reported, so a typo cannot leave the rule silently
doing nothing. Five cases land in that finding, each named in the message: the glob matched no
directory; every directory it matched is excluded; it matched directories but never a unit; the value
lists no name at all; the same glob is declared in both maps.

Two things are never reported. A declaration written **only** inside an `overrides` entry is not
checked for inertness, because whether it matched anything depends on which paths the override applies
to. And a declared name that no directory currently uses is not reported — the set says what may
appear, not what must.
````

- [ ] **Step 4: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/architecture/reserved-directory-names.md` as a faithful
translation of step 3. Every table, code block, glob, identifier and option name stays in its original
form; only the prose is translated. Do not add or drop a section. Frontmatter:

```markdown
---
title: architecture/reserved-directory-names · 予約ディレクトリ名
description: ディレクトリの直下に置ける名前は、その位置に宣言した名前だけにすべきです。
---
```

Headings, in this order:

```markdown
## チェック内容

## なぜ重要か

## 修正方法

## 設定

### 2 つのオプションはキーが何を指すかが違う

### どの宣言が優先されるか

### `exclude`

## 制限
```

Follow the register of `docs/src/content/docs/ja/rules/architecture/directory-naming.md`, the closest
sibling, including its `**重大度:** info · **カテゴリ:** architecture` line under the frontmatter.

- [ ] **Step 5: Add the configuration-guide entries**

In `docs/src/content/docs/guides/(setup)/configuration.mdx`, in the list naming rules that take
options, add:

```markdown
- `architecture/reserved-directory-names` — `scopes` (directory glob → allowed child names),
  `unitScopes` (root glob → allowed child names) and `exclude`. Off until one of the two is set.
```

And in `docs/src/content/docs/ja/guides/(setup)/configuration.mdx`:

```markdown
- `architecture/reserved-directory-names` — `scopes`（ディレクトリ glob → 直下に置ける名前）、
  `unitScopes`（起点 glob → ユニット直下に置ける名前）、`exclude`。どちらかを設定するまで無効です。
```

- [ ] **Step 6: Rebuild core and regenerate the index pages**

Run: `cd packages/core && ../../node_modules/.bin/tsup` (if that binary is absent, take the build
script from `packages/core/package.json`)
Run: `cd packages/cli && node scripts/gen-rules-index.mjs`
Run (repo root): `node_modules/.bin/oxfmt --write .`
Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/rules-index.test.mjs test/docs-links.test.ts`
Expected: PASS. These two are what fail CI if the index is stale or a page is missing, and they read
the rule list from the built `dist`, so the rebuild has to come first.

- [ ] **Step 7: Write the changeset**

Create `.changeset/reserved-directory-names.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add `architecture/reserved-directory-names`, which holds a directory's immediate subdirectories to a
closed set of names you declare for that position. Like the other Architecture convention rules it is
off until configured: `scopes` maps a directory glob to the names its children may take, and
`unitScopes` maps a root glob to the names a unit's children may take — a unit being a directory whose
name begins with a capital and which holds a file named after it.

Where `architecture/directory-naming` checks a directory's casing, this checks its name, so it reports
the correctly-cased `helpers/` that no casing declaration objects to.
```

- [ ] **Step 8: Full verification and commit**

Run (repo root): `node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .`
Run per package: `../../node_modules/.bin/vitest run` and `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: clean.

```bash
git add docs .changeset packages/core/test/reserved-directory-names-example.test.ts
git commit -m "docs: document architecture/reserved-directory-names in English and Japanese"
```

---

### Task 5: End-to-end wiring

**Files:**

- Create: `packages/cli/test/fixtures/reserved-names-project/` (5 files)
- Modify: `packages/cli/test/analyze-project.test.ts`, `packages/vite/test/analyze-source-files.test.ts`

- [ ] **Step 1: Create the CLI fixture**

Model it on `packages/cli/test/fixtures/directory-naming-project/`, which has the same shape.

`packages/cli/test/fixtures/reserved-names-project/package.json`:

```json
{
  "name": "reserved-names-project-fixture",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@sveltejs/kit": "^2.0.0",
    "svelte": "^5.0.0"
  }
}
```

`packages/cli/test/fixtures/reserved-names-project/svelte-vitals.config.mjs`:

```js
/** Fixture config declaring a closed set under component units (design 2026-07-29). */
export default {
  rules: {
    'architecture/reserved-directory-names': {
      options: { unitScopes: { 'src/**': 'parts|tests' } }
    }
  }
};
```

`packages/cli/test/fixtures/reserved-names-project/src/app.html`:

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

`packages/cli/test/fixtures/reserved-names-project/src/routes/+page.svelte`:

```svelte
<h1>Home</h1>
```

`packages/cli/test/fixtures/reserved-names-project/src/lib/Card/Card.svelte`:

```svelte
<div>card</div>
```

`packages/cli/test/fixtures/reserved-names-project/src/lib/Card/helpers/format.ts`:

```ts
// 'helpers' is not one of the declared names, so this directory is the finding.
export const format = (s: string) => s;
```

- [ ] **Step 2: Write the failing CLI test**

In `packages/cli/test/analyze-project.test.ts`, add the fixture path beside the others:

```ts
const reservedNamesFixtureDir = join(here, 'fixtures', 'reserved-names-project');
```

and, next to the other rule-wiring tests:

```ts
it('runs architecture/reserved-directory-names over the collected inventory', async () => {
  const { results } = await analyzeProject({ cwd: reservedNamesFixtureDir });
  const found = results.filter((r) => r.id === 'architecture/reserved-directory-names');
  expect(found).toHaveLength(1);
  expect(found[0]!.route).toBe('src/lib/Card/helpers');
  expect(found[0]!.location).toBe('src/lib/Card/helpers/format.ts');
});
```

- [ ] **Step 3: Write the failing vite test**

In `packages/vite/test/analyze-source-files.test.ts`, add a new `describe` with **its own** temp
project. Do not extend a shared `beforeAll` — a directory name chosen for one rule can satisfy
another rule's gate and break its wiring test, which happened when the sibling rule's test was added.

```ts
describe('analyze wires sourceFiles into the reserved-names rule', () => {
  let cwd: string;
  let pages: string;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-reserved-names-'));
    pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    await writeFile(join(pages, 'index.html'), `<html lang="en"><head><title>Home</title></head><body></body></html>`);
    await mkdir(join(cwd, 'src/lib/Card/helpers'), { recursive: true });
    await writeFile(join(cwd, 'src/lib/Card/Card.svelte'), '<div>card</div>');
    await writeFile(join(cwd, 'src/lib/Card/helpers/format.ts'), 'export const format = 1;');
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('reports the undeclared child directory', async () => {
    const r = await analyze(pages, cwd, {
      report: false,
      rules: { 'architecture/reserved-directory-names': { options: { unitScopes: { 'src/**': 'parts|tests' } } } }
    });
    const found = r.results.filter((x) => x.id === 'architecture/reserved-directory-names');
    expect(found).toHaveLength(1);
    expect(found[0]!.route).toBe('src/lib/Card/helpers');
  });

  it('emits nothing from that rule when it is left unconfigured', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(r.results.filter((x) => x.id === 'architecture/reserved-directory-names')).toEqual([]);
  });
});
```

- [ ] **Step 4: Run both, then prove they are load-bearing**

Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/analyze-project.test.ts`
Run: `cd packages/vite && ../../node_modules/.bin/vitest run test/analyze-source-files.test.ts`

Both should pass immediately — the `sourceFiles` wiring already exists and these tests keep it that
way. Prove it: delete `sourceFiles` from the `runRules` call in `packages/cli/src/index.ts`, re-run the
CLI test, see it fail, restore. Do the same for `packages/vite/src/analyze.ts`. Record both in your
report — a wiring test that passes either way is worse than none, because it looks like coverage.

- [ ] **Step 5: Full suite and commit**

Run per package: `../../node_modules/.bin/vitest run`
Expected: PASS in all four.

```bash
git add packages/cli/test packages/vite/test
git commit -m "test: pin the reserved-directory-names wiring from both the CLI and the vite plugin"
```

---

## Final verification

- [ ] `node_modules/.bin/oxlint .` and `node_modules/.bin/oxfmt --check .` clean
- [ ] `../../node_modules/.bin/tsc --noEmit -p tsconfig.json` clean in all four packages
- [ ] `../../node_modules/.bin/vitest run` green in all four packages
- [ ] `cd packages/cli && ../../node_modules/.bin/vitest run test/rules-index.test.mjs test/docs-links.test.ts` green
- [ ] `grep -c architectureReservedDirectoryNames packages/core/src/rules/index.ts packages/core/src/index.ts` returns 3 and 1
- [ ] The changeset exists and names all four packages
