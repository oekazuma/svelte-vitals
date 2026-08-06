# architecture/reserved-name-placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `architecture/reserved-name-placement` — a reserved directory name may appear only in the
places declared for it (charter mechanism M4, L3).

**Architecture:** A single new rule file in `packages/core/src/rules/architecture/`, built on the shared
`declarations.ts` helpers the three sibling directory rules already use. Three `string-map` options map a
reserved **name** to a `|`-separated list of globs; all three globs are matched against the same directory —
the reserved-name directory's **parent** — and differ only in what else they require of it (nothing / the
parent is a capitalised unit / the parent is a unit of either case). A name's permitted positions are the
**union** across the three maps.

**Tech Stack:** TypeScript, vitest, the `packages/core` runtime-agnostic rule engine.

Design: `docs/superpowers/specs/2026-08-06-reserved-name-placement-design.md` (approved 2026-08-06 after ten
adversarial review passes). Read it before Task 1 — every numbered Testing item below cites it.

## Global Constraints

- **Core purity.** `packages/core` has no `node:` imports, no I/O, no runtime-specific globals. All I/O is
  injected through `Runtime`. Every file this plan touches is inside `packages/core` except the docs.
- **Rule id:** `architecture/reserved-name-placement`. **Category:** `architecture`. **Scope:** `component`.
  **Severity:** `info`.
- **Option names, exactly:** `placements`, `capitalisedUnitPlacements`, `anyCaseUnitPlacements`, `exclude`.
  The first three are `string-map` with `default: {}`; `exclude` is `string-list` with `default: []`.
  Never name an option `unitPlacements` — the design rejects the unmarked word deliberately.
- **Registration touches four places** and TypeScript checks only three: the import, the `allRules` array and
  the re-export block in `packages/core/src/rules/index.ts`, plus the duplicate plain re-export list in
  `packages/core/src/index.ts`. Grep for `architectureReservedDirectoryNames` after adding to confirm all four.
- **Docs ship in both languages:** `docs/src/content/docs/rules/architecture/reserved-name-placement.md` and
  `docs/src/content/docs/ja/rules/architecture/reserved-name-placement.md`.
  `packages/cli/test/docs-links.test.ts` fails the build without both.
- **Never name another tool, linter, plugin, product or automated reviewer** in code comments, commit
  messages, docs, or the PR body. PR bodies are written in English.
- **No pass results.** `computeScore` seeds every distinct `route` at 100 and averages; a directory has no
  pre-existing score key, so passes would dilute every real finding.
- **Verify commands:** `pnpm --filter @svelte-vitals/core test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`.

---

## File Structure

| File                                                                          | Responsibility                                                                                                                                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/rules/architecture/reserved-directory-names.ts`            | **Modify.** Gains one exported predicate, `isAnyCaseUnitDir`, beside the existing `isUnitDir`. The unit definition lives here already and both rules must share one. |
| `packages/core/src/rules/architecture/reserved-name-placement.ts`             | **Create.** The whole rule: options spec, traversal, findings, dead-declaration diagnostics.                                                                         |
| `packages/core/test/reserved-name-placement.test.ts`                          | **Create.** The fifteen Testing items from the design.                                                                                                               |
| `packages/core/src/rules/index.ts`                                            | **Modify.** Import, `allRules` entry, re-export.                                                                                                                     |
| `packages/core/src/index.ts`                                                  | **Modify.** Duplicate re-export list (unchecked by TypeScript).                                                                                                      |
| `docs/src/content/docs/rules/architecture/reserved-name-placement.md` + `ja/` | **Create.** Rule pages.                                                                                                                                              |
| `.changeset/<name>.md`                                                        | **Create.** Minor bump for `@svelte-vitals/core` and `svelte-vitals`.                                                                                                |

---

## Task 1: The any-case unit predicate

**Files:**

- Modify: `packages/core/src/rules/architecture/reserved-directory-names.ts` (beside `isUnitDir`, line ~59)
- Test: `packages/core/test/reserved-directory-names.test.ts` (append)

**Interfaces:**

- Consumes: `baseName`, `stem` (module-local) from the same file.
- Produces: `export function isAnyCaseUnitDir(dir: string, filesIn: Map<string, string[]>): boolean` — the
  same test as `isUnitDir` without the A–Z requirement. Task 3 imports it.

**Why here and not in `declarations.ts`:** `isUnitDir` already lives in `reserved-directory-names.ts` and
Task 3 imports it from there. Splitting the pair across two modules would leave the definition of "unit" in
two places, which is the mismatch this rule exists to avoid.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/reserved-directory-names.test.ts`:

```ts
describe('isAnyCaseUnitDir', () => {
  const filesIn = new Map<string, string[]>([
    ['src/lib/Card', ['Card.svelte']],
    ['src/lib/formatDate', ['formatDate.ts']],
    ['src/lib/counter', ['counter.svelte.ts']],
    ['src/lib/helpers', ['format.ts']],
    ['src/lib/empty', []]
  ]);

  it('accepts a capitalised unit, exactly as isUnitDir does', () => {
    expect(isAnyCaseUnitDir('src/lib/Card', filesIn)).toBe(true);
    expect(isUnitDir('src/lib/Card', filesIn)).toBe(true);
  });

  it('accepts a lowercase unit that isUnitDir rejects', () => {
    expect(isAnyCaseUnitDir('src/lib/formatDate', filesIn)).toBe(true);
    expect(isUnitDir('src/lib/formatDate', filesIn)).toBe(false);
    expect(isAnyCaseUnitDir('src/lib/counter', filesIn)).toBe(true);
    expect(isUnitDir('src/lib/counter', filesIn)).toBe(false);
  });

  it('still requires the entry file, so the letter test is the only difference', () => {
    expect(isAnyCaseUnitDir('src/lib/helpers', filesIn)).toBe(false);
    expect(isAnyCaseUnitDir('src/lib/empty', filesIn)).toBe(false);
    expect(isAnyCaseUnitDir('src/lib/unknown', filesIn)).toBe(false);
  });
});
```

Add `isAnyCaseUnitDir` to the existing import from `../src/rules/architecture/reserved-directory-names.js`
at the top of that test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-directory-names`
Expected: FAIL — `isAnyCaseUnitDir is not a function` (or a TypeScript import error).

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/rules/architecture/reserved-directory-names.ts`, immediately after `isUnitDir`:

```ts
/**
 * `isUnitDir` without the letter test: one of `dir`'s immediate children is a file whose stem equals
 * the directory's name, whatever case the name begins with.
 *
 * The split is the letter test alone, and deliberately not the entry file's extension. That every
 * capitalised unit holds a `.svelte` and every lowercase one a `.ts` is a property of a convention,
 * not something a rule should encode.
 */
export function isAnyCaseUnitDir(dir: string, filesIn: Map<string, string[]>): boolean {
  const name = baseName(dir);
  const own = filesIn.get(dir);
  return own !== undefined && own.some((f) => stem(f) === name);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-directory-names`
Expected: PASS, including every pre-existing test in that file.

- [ ] **Step 5: Verify the predicate is load-bearing**

Temporarily delete the `own !== undefined &&` clause and re-run. The "still requires the entry file" test
must fail. Restore it. If it passes without the clause, the fixture is wrong — fix the fixture, not the test.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/architecture/reserved-directory-names.ts packages/core/test/reserved-directory-names.test.ts
git commit -m "feat(core): add an any-case unit predicate beside isUnitDir"
```

---

## Task 2: The rule with `placements` only

**Files:**

- Create: `packages/core/src/rules/architecture/reserved-name-placement.ts`
- Create: `packages/core/test/reserved-name-placement.test.ts`

**Interfaces:**

- Consumes: `ancestorDirs`, `baseName`, `childFiles`, `createKeyCompiler`, `isExcluded`, `matchKeys`,
  `reportAt`, `splitNames` from `./declarations.js`; `compileOverrides` from `../../config-apply.js`;
  `isMentionedAnywhere`, `listOption`, `mapOption`, `resolveRuleOptions`, `type RuleOptionsSpec` from
  `../../rule-options.js`; `docsUrlFor`, `type Rule`, `type RuleContext` from `../../rule.js`;
  `type Result` from `../../types.js`.
- Produces: `export const architectureReservedNamePlacement: Rule` — Task 6 registers this exact name.

This task delivers Testing items **4, 5, 12, 13, 15**. The two unit maps arrive in Task 3; declare all four
options now so the shape is fixed, but only `placements` is consulted.

**The traversal, stated once because every later task extends it:** iterate the **reserved-name directory**,
not the parent. Options resolve at that directory (the design pins this: an override naming a directory must
not govern findings reported outside it). Its parent is what the globs are matched against.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/reserved-name-placement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { architectureReservedNamePlacement } from '../src/rules/architecture/reserved-name-placement.js';
import type { Config } from '../src/config.js';
import type { RuleContext } from '../src/rule.js';

const ID = 'architecture/reserved-name-placement';

/** A context carrying only what this rule reads: `sourceFiles` and `config`. */
function ctx(files: string[], options: Record<string, unknown>, extra: Partial<Config> = {}): RuleContext {
  const config = { rules: { [ID]: { options } }, ...extra } as unknown as Config;
  return { sourceFiles: files, config } as unknown as RuleContext;
}

async function run(files: string[], options: Record<string, unknown>, extra: Partial<Config> = {}) {
  return await architectureReservedNamePlacement.check(ctx(files, options, extra));
}

describe('architecture/reserved-name-placement', () => {
  // Testing item 4
  it('never reports a name that is in no map, on a run that is otherwise reporting', async () => {
    const results = await run(['src/routes/about/e2e/a.ts', 'src/routes/about/utils/b.ts', 'src/lib/e2e/c.ts'], {
      placements: { e2e: 'src/routes/**' }
    });
    expect(results.map((r) => r.route)).toEqual(['src/lib/e2e']);
  });

  // Testing item 5
  it('reports a declared name in an undeclared position, with route on the directory and location on a file inside it', async () => {
    const results = await run(['src/lib/e2e/a.ts'], { placements: { e2e: 'src/routes/**' } });
    expect(results).toHaveLength(1);
    expect(results[0]?.route).toBe('src/lib/e2e');
    expect(results[0]?.location).toBe('src/lib/e2e/a.ts');
    expect(results[0]?.severity).toBe('info');
    expect(results[0]?.category).toBe('architecture');
  });

  // Testing item 12
  it('exclude removes a subtree that reports without it', async () => {
    const files = ['src/lib/legacy/e2e/a.ts'];
    const without = await run(files, { placements: { e2e: 'src/routes/**' } });
    expect(without).toHaveLength(1);
    const withExclude = await run(files, {
      placements: { e2e: 'src/routes/**' },
      exclude: ['src/lib/legacy/**']
    });
    expect(withExclude).toEqual([]);
  });

  // Testing item 13
  it('reports nothing when no map is declared, on a tree that would otherwise produce findings', async () => {
    const results = await run(['src/lib/e2e/a.ts'], {});
    expect(results).toEqual([]);
  });

  // Testing item 15
  it('distinguishes a bare prefix from a /** suffix as the family compiler defines', async () => {
    const files = ['src/routes/e2e/a.ts'];
    const bare = await run(files, { placements: { e2e: 'src/routes' } });
    expect(bare).toEqual([]);
    const suffixed = await run(files, { placements: { e2e: 'src/routes/**' } });
    expect(suffixed).toHaveLength(1);
    expect(suffixed[0]?.route).toBe('src/routes/e2e');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-name-placement`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/rules/architecture/reserved-name-placement.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import {
  isMentionedAnywhere,
  listOption,
  mapOption,
  resolveRuleOptions,
  type RuleOptionsSpec
} from '../../rule-options.js';
import {
  ancestorDirs,
  baseName,
  childFiles,
  createKeyCompiler,
  isExcluded,
  matchKeys,
  reportAt,
  splitNames
} from './declarations.js';

const ID = 'architecture/reserved-name-placement';
const docsUrl = docsUrlFor(ID);
const recommendation = 'Move it to one of the places declared for this name, or declare this place for it.';

// Inert by default: which names a project reserves, and where each may sit, is its own decision.
const OPTIONS: RuleOptionsSpec = {
  placements: { kind: 'string-map', default: {} },
  capitalisedUnitPlacements: { kind: 'string-map', default: {} },
  anyCaseUnitPlacements: { kind: 'string-map', default: {} },
  exclude: { kind: 'string-list', default: [] }
};

/** The directory holding `dir`, or undefined when `dir` sits at the root. */
function parentOf(dir: string): string | undefined {
  const cut = dir.lastIndexOf('/');
  return cut === -1 ? undefined : dir.slice(0, cut);
}

/**
 * architecture/reserved-name-placement — a reserved directory name may appear only in the places
 * declared for it (design 2026-08-06). L3: inert until a placement is declared.
 *
 * The sibling `architecture/reserved-directory-names` says "at this position, only these names"; it
 * cannot say "this name, only at these positions", which for a name appearing in several kinds of
 * place is what a convention actually states.
 *
 * All three maps match the same directory — the reserved-name directory's parent — and differ only in
 * what else they require of it: nothing, that it is a capitalised unit, that it is a unit of either
 * case. A name's permitted positions are the UNION of its entries across the three, because a real
 * convention permits one name under a unit, under a grouping and under a route directory at once.
 *
 * There are no pass results, for the reason the sibling records: `computeScore` seeds every distinct
 * `route` at 100 and averages, and a directory has no pre-existing score key.
 */
export const architectureReservedNamePlacement: Rule = {
  id: ID,
  title: 'Reserved name placement',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    'A name reserved for one kind of place stops carrying that meaning the moment it appears somewhere else: a reader who has met one exception has to open the directory to learn what it holds.',
  fix: {
    description:
      'Move the directory to one of the places declared for its name, rename it, or declare this place for the name.'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const files = ctx.sourceFiles;
    if (files === undefined) return []; // --route runs build no inventory

    // No config layer mentions this rule, so nothing below can find a declaration. Without this, an
    // unconfigured project resolves options once per directory and throws every result away.
    if (!isMentionedAnywhere(ctx.config, ID)) return [];

    const compiledOverrides = compileOverrides(ctx.config);
    const dirs = new Set<string>();
    for (const f of files) for (const d of ancestorDirs(f)) dirs.add(d);
    const filesIn = childFiles(files);

    const compile = createKeyCompiler();
    // Values are parsed once per distinct string, not once per directory.
    const parsed = new Map<string, string[]>();
    const globsOf = (value: string) => {
      let g = parsed.get(value);
      if (g === undefined) parsed.set(value, (g = splitNames(value)));
      return g;
    };

    const out: Result[] = [];

    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(ID, OPTIONS, ctx.config, { route: dir, file: dir }, compiledOverrides);
      const placements = mapOption(o, 'placements');
      if (Object.keys(placements).length === 0) continue; // inert

      const name = baseName(dir);
      const value = placements[name];
      if (value === undefined) continue; // a name nobody declared a place for has no place to violate

      const excluded = compile(listOption(o, 'exclude'));
      if (isExcluded(dir, ancestorDirs(dir), excluded)) continue;

      const parent = parentOf(dir);
      if (parent === undefined) continue;

      if (matchKeys(parent, compile(globsOf(value), true)).matched.length > 0) continue;

      const at = reportAt(dir, files);
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
        route: dir,
        location: at,
        message: `${dir} is not one of the places declared for '${name}'.`,
        recommendation,
        docsUrl,
        fix: {
          description:
            'Move the directory to one of the places declared for its name, rename it, or declare this place for the name.'
        }
      });
    }

    return out;
  }
};
```

`filesIn` is unused in this task and consumed in Task 3 — leave the line in place; if lint objects, add the
`filesIn` use in Task 3 within the same session rather than deleting it here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-name-placement`
Expected: PASS, 5 tests.

- [ ] **Step 5: Verify each guard is load-bearing**

One at a time, break the guard and confirm exactly the expected test fails, then restore:

| Break                                                         | Test that must fail                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `if (value === undefined) continue;` → `if (false) continue;` | item 4                                                                                                                    |
| `route: dir` → `route: parent`                                | item 5                                                                                                                    |
| drop the `isExcluded` block                                   | item 12                                                                                                                   |
| `isMentionedAnywhere` early return removed                    | item 13 (only if `rules` is absent — if it still passes, the fixture needs a config with no `rules` key; fix the fixture) |
| `compile(globsOf(value), true)` → `compile(globsOf(value))`   | item 15                                                                                                                   |

If any break causes **no** failure, the test is vacuous. Fix the test before proceeding.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/architecture/reserved-name-placement.ts packages/core/test/reserved-name-placement.test.ts
git commit -m "feat(core): add architecture/reserved-name-placement with parent-glob placements"
```

---

## Task 3: The two unit maps and the union

**Files:**

- Modify: `packages/core/src/rules/architecture/reserved-name-placement.ts`
- Modify: `packages/core/test/reserved-name-placement.test.ts`

**Interfaces:**

- Consumes: `isUnitDir`, `isAnyCaseUnitDir` from `./reserved-directory-names.js` (Task 1).
- Produces: nothing new externally; the rule now honours all three maps.

This task delivers Testing items **1, 2, 3, 6, 7**.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe` in `packages/core/test/reserved-name-placement.test.ts`:

```ts
// A tree with one capitalised unit, one lowercase unit and one same-case non-unit of each kind.
const UNIT_TREE = [
  'src/lib/Card/Card.svelte',
  'src/lib/Card/parts/a.svelte',
  'src/lib/Card/tests/a.ts',
  'src/lib/formatDate/formatDate.ts',
  'src/lib/formatDate/parts/b.svelte',
  'src/lib/formatDate/tests/b.ts',
  'src/lib/Icons/other.svelte',
  'src/lib/Icons/parts/c.svelte',
  'src/lib/helpers/format.ts',
  'src/lib/helpers/tests/d.ts'
];

// Testing item 1
it('reports a capitalised-unit-only name under a lowercase unit and is silent under a capitalised one', async () => {
  const results = await run(UNIT_TREE, { capitalisedUnitPlacements: { parts: 'src/**' } });
  expect(results.map((r) => r.route)).toEqual(['src/lib/Icons/parts', 'src/lib/formatDate/parts']);
});

// Testing item 2
it('is silent for an any-case name under both kinds of unit, in one run', async () => {
  const results = await run(UNIT_TREE, { anyCaseUnitPlacements: { tests: 'src/**' } });
  expect(results.map((r) => r.route)).toEqual(['src/lib/helpers/tests']);
});

// Testing item 7
it('requires the entry file in both predicates, not just the letter', async () => {
  const cap = await run(UNIT_TREE, { capitalisedUnitPlacements: { parts: 'src/**' } });
  expect(cap.map((r) => r.route)).toContain('src/lib/Icons/parts'); // Icons/ holds no Icons.*
  const any = await run(UNIT_TREE, { anyCaseUnitPlacements: { tests: 'src/**' } });
  expect(any.map((r) => r.route)).toContain('src/lib/helpers/tests'); // helpers/ holds no helpers.*
});

// Testing item 3
it('is silent in every declared position of a name declared in more than one map, in one run', async () => {
  const results = await run(
    [
      'src/lib/Card/Card.svelte',
      'src/lib/Card/functions/a.ts',
      'src/lib/features/checkout/functions/b.ts',
      'src/routes/about/functions/c.ts',
      'src/lib/orphan/functions/d.ts'
    ],
    {
      capitalisedUnitPlacements: { functions: 'src/**' },
      placements: { functions: 'src/lib/features/*|src/routes/**' }
    }
  );
  expect(results.map((r) => r.route)).toEqual(['src/lib/orphan/functions']);
});

// Testing item 6
it('honours each unit map glob, and matches it against the unit itself rather than an ancestor', async () => {
  // Both halves of "the glob is honoured": a unit outside the glob reports, under both maps.
  const outside = await run(
    [
      'src/lib/Card/Card.svelte',
      'src/lib/Card/parts/a.svelte',
      'src/app/Panel/Panel.svelte',
      'src/app/Panel/parts/b.svelte',
      'src/app/formatDate/formatDate.ts',
      'src/app/formatDate/tests/c.ts'
    ],
    {
      capitalisedUnitPlacements: { parts: 'src/lib/**' },
      anyCaseUnitPlacements: { tests: 'src/lib/**' }
    }
  );
  expect(outside.map((r) => r.route)).toEqual(['src/app/Panel/parts', 'src/app/formatDate/tests']);

  // The match subject: a unit AT src/lib/Card is permitted by `src/lib/**` and reported by `src/lib`.
  const tree = ['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'];
  expect(await run(tree, { capitalisedUnitPlacements: { parts: 'src/lib/**' } })).toEqual([]);
  const bare = await run(tree, { capitalisedUnitPlacements: { parts: 'src/lib' } });
  expect(bare.map((r) => r.route)).toEqual(['src/lib/Card/parts']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-name-placement`
Expected: FAIL — the unit maps are declared but never read, so every new test reports nothing (or reports
everything).

- [ ] **Step 3: Write the implementation**

Add the import at the top of `reserved-name-placement.ts`:

```ts
import { isAnyCaseUnitDir, isUnitDir } from './reserved-directory-names.js';
```

Replace the body of the `for (const dir of [...dirs].sort())` loop, from the `const placements` line through
the `matchKeys(...)` early-continue, with:

```ts
const o = resolveRuleOptions(ID, OPTIONS, ctx.config, { route: dir, file: dir }, compiledOverrides);
const placements = mapOption(o, 'placements');
const capUnits = mapOption(o, 'capitalisedUnitPlacements');
const anyUnits = mapOption(o, 'anyCaseUnitPlacements');
if (Object.keys(placements).length === 0 && Object.keys(capUnits).length === 0 && Object.keys(anyUnits).length === 0) {
  continue; // inert
}

const name = baseName(dir);
const inPlacements = Object.hasOwn(placements, name);
const inCapUnits = Object.hasOwn(capUnits, name);
const inAnyUnits = Object.hasOwn(anyUnits, name);
if (!inPlacements && !inCapUnits && !inAnyUnits) continue;

const excluded = compile(listOption(o, 'exclude'));
if (isExcluded(dir, ancestorDirs(dir), excluded)) continue;

const parent = parentOf(dir);
if (parent === undefined) continue;

// The union: any one map permitting the position is enough. All three globs are matched against
// the same directory — this parent — and differ only in what else they require of it.
const matches = (value: string | undefined) =>
  value !== undefined && matchKeys(parent, compile(globsOf(value), true)).matched.length > 0;
const permitted =
  matches(placements[name]) ||
  (isUnitDir(parent, filesIn) && matches(capUnits[name])) ||
  (isAnyCaseUnitDir(parent, filesIn) && matches(anyUnits[name]));
if (permitted) continue;
```

Update the finding's `message` to name every map the name was declared in — unchanged text is fine, but the
existing `'${name}'` phrasing already reads correctly for all three.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-name-placement`
Expected: PASS, 10 tests.

- [ ] **Step 5: Verify each guard is load-bearing**

| Break                                                                                   | Test that must fail                                 |
| --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `isUnitDir(parent, filesIn) &&` removed from the union                                  | item 1 (`src/lib/formatDate/parts` stops reporting) |
| `isAnyCaseUnitDir` → `isUnitDir` in the third clause                                    | item 2                                              |
| `matches(capUnits[name])` → `isUnitDir(parent, filesIn)` (predicate only, glob ignored) | item 6                                              |
| the union `                                                                             |                                                     | `chain replaced by a first-match-wins`if/else` | item 3 |
| both predicates replaced by a first-character test                                      | item 7                                              |

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/architecture/reserved-name-placement.ts packages/core/test/reserved-name-placement.test.ts
git commit -m "feat(core): honour both unit maps and union a name's declared positions"
```

---

## Task 4: The name-level empty-value drop, and `overrides` scoping

**Files:**

- Modify: `packages/core/src/rules/architecture/reserved-name-placement.ts`
- Modify: `packages/core/test/reserved-name-placement.test.ts`

**Interfaces:** no external change.

This task delivers Testing items **8** (the silence half) and **14**.

**The rule to implement, exactly:** a value that splits to nothing ungoverns that **name** in **every map**
of the same resolved option set — not just the map holding the empty value. M3's maps compete to allow child
names, so dropping one empty value there is under-reporting. M4's maps union to permit positions, so dropping
only the empty value would _shrink_ a governed name's permitted set and report a typo as violations.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe`:

```ts
// Testing item 8 — the silence half. The reported half arrives in Task 5.
it('lets an empty value in one map ungovern the name in every map', async () => {
  const tree = [
    'src/lib/Card/Card.svelte',
    'src/lib/Card/functions/a.ts',
    'src/lib/features/checkout/functions/b.ts',
    'src/lib/orphan/functions/c.ts'
  ];
  // Without the empty value, the orphan reports.
  const governed = await run(tree, { anyCaseUnitPlacements: { functions: 'src/**' } });
  expect(governed.map((r) => r.route)).toEqual(['src/lib/orphan/functions']);

  // With it, `functions` is ungoverned everywhere — a value-level drop would report the two
  // positions the emptied `placements` entry used to cover.
  const dropped = await run(tree, {
    anyCaseUnitPlacements: { functions: 'src/**' },
    placements: { functions: '|' }
  });
  expect(dropped.filter((r) => r.route !== undefined)).toEqual([]);
});

// Testing item 14 — the override glob must match the reserved-name directory and NOT its parent,
// or the two resolution subjects agree on every assertion and this proves nothing.
it('scopes the empty-value drop to the resolved option set an overrides layer produces', async () => {
  const results = await run(
    ['src/lib/orphan/parts/a.svelte', 'src/parts/b.svelte'],
    { placements: { parts: 'src/lib/Card' } },
    {
      overrides: [{ files: 'src/**/parts', rules: { [ID]: { options: { placements: { parts: '|' } } } } }]
    } as never
  );
  // 'src/**/parts' reaches src/lib/orphan/parts (silenced) and misses src/parts (still reporting).
  expect(results.filter((r) => r.route !== undefined).map((r) => r.route)).toEqual(['src/parts']);
});
```

If `Config`'s override entry shape differs from `{ files, rules }`, read
`packages/core/src/config-apply.ts` and `packages/core/test/reserved-directory-names.test.ts:215-268` for the
committed shape and use that verbatim. Do not invent a shape.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-name-placement`
Expected: FAIL — an empty `placements` value currently makes `matches()` false, so the name reports.

- [ ] **Step 3: Write the implementation**

In the loop, immediately after the `if (!inPlacements && !inCapUnits && !inAnyUnits) continue;` line:

```ts
// A value that splits to nothing ungoverns the NAME, in every map of this resolved option set.
// Dropping only the empty value would shrink the union and turn a typo into false positives at
// every position the emptied entry covered — the opposite direction from the sibling rule,
// whose maps compete rather than union.
const emptyValue = (present: boolean, value: string | undefined) => present && globsOf(value ?? '').length === 0;
if (
  emptyValue(inPlacements, placements[name]) ||
  emptyValue(inCapUnits, capUnits[name]) ||
  emptyValue(inAnyUnits, anyUnits[name])
) {
  continue;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-name-placement`
Expected: PASS, 12 tests.

- [ ] **Step 5: Verify each guard is load-bearing**

| Break                                                                                                   | Test that must fail |
| ------------------------------------------------------------------------------------------------------- | ------------------- |
| the empty-value block checks only `placements` **and** the `matches()` union is left to handle the rest | item 8              |
| `resolveRuleOptions(..., { route: dir, file: dir }, ...)` → `{ route: parent, file: parent }`           | item 14             |
| `compiledOverrides` argument dropped                                                                    | item 14             |

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/architecture/reserved-name-placement.ts packages/core/test/reserved-name-placement.test.ts
git commit -m "feat(core): drop an emptied name across every map of one resolved option set"
```

---

## Task 5: The dead-declaration diagnostics

**Files:**

- Modify: `packages/core/src/rules/architecture/reserved-name-placement.ts`
- Modify: `packages/core/test/reserved-name-placement.test.ts`

**Interfaces:**

- Consumes: `classifyUnusedKeys`, `keysMatchingAny` from `./declarations.js`.

This task delivers Testing items **8** (the reported half), **9**, **10**, **11**.

**Three constraints, all load-bearing:**

1. **One aggregated, project-scoped finding**, never one per declaration. `findingKey` is
   `id::route::location` and a project-scoped result leaves both unset, so N findings collapse to one
   baseline entry and suppressing one silently suppresses the rest.
2. **The diagnostic unit is one `|`-separated alternative, not the name.** A typo among good alternatives
   shrinks the permitted set while "some glob for this name matched" stays true. Five of the eight names in
   the design's example encoding carry multi-glob values.
3. **A unit-map alternative that matched directories but never a unit is its own note**, as the sibling
   tri-states its unit keys. `UnusedReason` is already two-state (`'no-match'` / `'only-excluded'`), so the
   per-alternative classification is three-way.

**Only globally resolved values are classified.** An alternative that exists solely inside an `overrides`
layer is not diagnosed — a layer governing a subtree cannot be judged dead against the whole tree.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe`:

```ts
const projectScoped = (results: Awaited<ReturnType<typeof run>>) =>
  results.filter((r) => r.route === undefined && r.location === undefined);

// Testing item 8 — the reported half.
it('reports an emptied declaration rather than dropping it in silence', async () => {
  const results = await run(['src/routes/about/e2e/a.ts'], { placements: { e2e: '|' } });
  expect(results.filter((r) => r.route !== undefined)).toEqual([]);
  expect(projectScoped(results)).toHaveLength(1);
  expect(projectScoped(results)[0]?.message).toContain('e2e');
});

// Testing item 9
it('carries every bad declaration in one project-scoped finding, not one each', async () => {
  const results = await run(['src/routes/about/e2e/a.ts'], {
    placements: { e2e: '|', stores: '|', types: 'src/nowhere/**' }
  });
  const notes = projectScoped(results);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.route).toBeUndefined();
  expect(notes[0]?.location).toBeUndefined();
  for (const name of ['e2e', 'stores', 'types']) expect(notes[0]?.message).toContain(name);
});

// Testing item 10
it('classifies a dead glob per alternative, not per name', async () => {
  const results = await run(['src/routes/about/e2e/a.ts'], {
    placements: { e2e: 'src/route/**|src/routes/**' }
  });
  expect(results.filter((r) => r.route !== undefined)).toEqual([]); // the good alternative works
  const notes = projectScoped(results);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.message).toContain('src/route/**');
  expect(notes[0]?.message).not.toContain('src/routes/**');
});

// Testing item 11
it('reports a unit-map glob that matched directories but never a unit', async () => {
  const results = await run(['src/lib/features/checkout/parts/a.svelte', 'src/lib/features/checkout/x.ts'], {
    capitalisedUnitPlacements: { parts: 'src/lib/features/*' }
  });
  const notes = projectScoped(results);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.message).toContain('never a unit');
});

it('classifies an alternative whose every match was excluded as excluded, not as unmatched', async () => {
  const results = await run(['src/lib/legacy/Card/Card.svelte', 'src/lib/legacy/Card/parts/a.svelte'], {
    capitalisedUnitPlacements: { parts: 'src/lib/legacy/**' },
    exclude: ['src/lib/legacy/**']
  });
  const notes = projectScoped(results);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.message).toContain('excluded');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-name-placement`
Expected: FAIL — no project-scoped finding is produced at all.

- [ ] **Step 3: Write the implementation**

Extend the import from `./declarations.js` with `classifyUnusedKeys` and `keysMatchingAny`.

Before the loop, add the bookkeeping:

```ts
// An alternative is identified by the map it came from, the name, and the glob — the same glob
// under two names is two declarations, and under two maps two more, because the predicate that
// qualifies it differs.
type MapName = 'placements' | 'capitalisedUnitPlacements' | 'anyCaseUnitPlacements';
const label = (map: MapName, name: string, glob: string) => `${map}.${name} → ${glob}`;

const globalOptions = resolveRuleOptions(ID, OPTIONS, ctx.config);
const globalMaps: Record<MapName, Record<string, string>> = {
  placements: mapOption(globalOptions, 'placements'),
  capitalisedUnitPlacements: mapOption(globalOptions, 'capitalisedUnitPlacements'),
  anyCaseUnitPlacements: mapOption(globalOptions, 'anyCaseUnitPlacements')
};
// Only globally resolved alternatives are classified: a value arriving solely from an `overrides`
// layer governs a subtree and cannot be judged dead against the whole tree.
const globalAlternatives = new Map<string, { map: MapName; name: string; glob: string }>();
const emptyNames = new Map<string, string>(); // label -> note, for values that split to nothing
for (const map of Object.keys(globalMaps) as MapName[]) {
  for (const [name, value] of Object.entries(globalMaps[map])) {
    const globs = globsOf(value);
    if (globs.length === 0) {
      emptyNames.set(`${map}.${name}`, 'names no position at all');
      continue;
    }
    for (const glob of globs) globalAlternatives.set(label(map, name, glob), { map, name, glob });
  }
}

const usedAlternatives = new Set<string>();
const excludedDirs: string[] = [];
// Parents a unit-map alternative matched while the parent was not a unit of that map's kind.
const nonUnitParents: Record<'capitalisedUnitPlacements' | 'anyCaseUnitPlacements', string[]> = {
  capitalisedUnitPlacements: [],
  anyCaseUnitPlacements: []
};
```

Inside the loop, replace the `isExcluded` early-continue with one that records, and replace the `permitted`
computation with one that records usage:

```ts
if (isExcluded(dir, ancestorDirs(dir), excluded)) {
  excludedDirs.push(dir);
  continue;
}

const parent = parentOf(dir);
if (parent === undefined) continue;

const record = (map: MapName, value: string | undefined, qualifies: boolean) => {
  if (value === undefined) return false;
  const { matched } = matchKeys(parent, compile(globsOf(value), true));
  if (matched.length === 0) return false;
  if (!qualifies) {
    if (map !== 'placements') nonUnitParents[map].push(parent);
    return false;
  }
  for (const glob of matched) usedAlternatives.add(label(map, name, glob));
  return true;
};

// Every map is consulted, not short-circuited: an alternative that matched has done work and
// reporting it as a declaration that checks nothing would be a lie.
const byPlacement = record('placements', placements[name], true);
const byCapUnit = record('capitalisedUnitPlacements', capUnits[name], isUnitDir(parent, filesIn));
const byAnyUnit = record('anyCaseUnitPlacements', anyUnits[name], isAnyCaseUnitDir(parent, filesIn));
if (byPlacement || byCapUnit || byAnyUnit) continue;
```

After the loop, before `return out;`:

```ts
// One finding carrying every declaration that is not checking what it says. `findingKey`
// (`id::route::location`) leaves both fields unset for every project-scoped result, so N separate
// findings would collapse to one baseline entry and suppressing one would silently suppress the rest.
const notes = new Map<string, string>(emptyNames);

const unusedLabels = [...globalAlternatives.keys()].filter((k) => !usedAlternatives.has(k));
// The unit reason is claimed first, so an exclusion is never blamed for an alternative the unit
// test disqualified — the same ordering the sibling rule records.
for (const map of ['capitalisedUnitPlacements', 'anyCaseUnitPlacements'] as const) {
  const inMap = unusedLabels.filter((k) => globalAlternatives.get(k)?.map === map);
  const globs = inMap.map((k) => globalAlternatives.get(k)?.glob as string);
  const hit = keysMatchingAny(globs, nonUnitParents[map], compile);
  for (const k of inMap) {
    if (hit.has(globalAlternatives.get(k)?.glob as string)) {
      notes.set(k, 'matched directories but never a unit');
    }
  }
}

const stillUnused = unusedLabels.filter((k) => !notes.has(k));
const globByLabel = new Map(stillUnused.map((k) => [k, globalAlternatives.get(k)?.glob as string]));
const reasons = classifyUnusedKeys([...new Set(globByLabel.values())], excludedDirs, compile);
for (const k of stillUnused) {
  const reason = reasons.get(globByLabel.get(k) as string);
  notes.set(k, reason === 'only-excluded' ? 'matched only excluded directories' : 'matched no directory');
}

const reported = [...notes.keys()].sort();
if (reported.length > 0) {
  const message =
    reported.length === 1
      ? `The declaration ${reported[0]} does not check what it says: ${notes.get(reported[0] as string)}.`
      : `These declarations do not check what they say: ${reported.map((k) => `${k} (${notes.get(k)})`).join(', ')}.`;
  out.push({
    id: ID,
    category: 'architecture',
    severity: 'info',
    detection: { presence: 'none', value: 'absent' },
    message,
    recommendation: 'Correct the glob or the name, or remove the declaration.',
    docsUrl
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- reserved-name-placement`
Expected: PASS, 17 tests.

- [ ] **Step 5: Verify each guard is load-bearing**

| Break                                                                      | Test that must fail              |
| -------------------------------------------------------------------------- | -------------------------------- |
| push one `Result` per note instead of aggregating                          | item 9                           |
| key `globalAlternatives` on `${map}.${name}` instead of including the glob | item 10                          |
| the `nonUnitParents` pass removed                                          | item 11                          |
| `excludedDirs.push(dir)` removed                                           | the excluded-classification test |
| `emptyNames` never merged into `notes`                                     | item 8's reported half           |

- [ ] **Step 6: Run the whole core suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test` then `pnpm typecheck`
Expected: both clean. If any pre-existing test broke, the change is wrong — this rule is new and inert.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/rules/architecture/reserved-name-placement.ts packages/core/test/reserved-name-placement.test.ts
git commit -m "feat(core): report declarations that do not check what they say"
```

---

## Task 6: Registration, documentation, changeset

**Files:**

- Modify: `packages/core/src/rules/index.ts` (three places)
- Modify: `packages/core/src/index.ts` (one place, unchecked by TypeScript)
- Create: `docs/src/content/docs/rules/architecture/reserved-name-placement.md`
- Create: `docs/src/content/docs/ja/rules/architecture/reserved-name-placement.md`
- Modify: the generated rules index pages (via the generator, not by hand)
- Create: `.changeset/<name>.md`

**Interfaces:**

- Consumes: `architectureReservedNamePlacement` from Task 2.

- [ ] **Step 1: Register in all four places**

In `packages/core/src/rules/index.ts`, beside each existing `architectureReservedDirectoryNames` line:

```ts
// line ~67, with the other imports
import { architectureReservedNamePlacement } from './architecture/reserved-name-placement.js';
```

Add `architectureReservedNamePlacement,` to the `allRules` array (~line 141) and to the re-export block
(~line 216). Then in `packages/core/src/index.ts`, add it to the `export { ... } from './rules/index.js'`
list (~line 133).

- [ ] **Step 2: Confirm all four landed**

Run: `grep -rn "architectureReservedNamePlacement" packages/core/src/`
Expected: exactly four hits in `rules/index.ts` (import, array, re-export) and `index.ts`, plus the
definition in `rules/architecture/reserved-name-placement.ts`. TypeScript does not check the fourth, so this
grep is the check.

- [ ] **Step 3: Write the English rule page**

Create `docs/src/content/docs/rules/architecture/reserved-name-placement.md`, following
`reserved-directory-names.md`'s structure (frontmatter `title`/`description`, then **Severity** line,
`## What it checks`, `## Why it matters`, `## Configuration`, `## When to turn it off`). It must state:

- the rule is **off until configured** — all three maps default to `{}`;
- the three maps all match the reserved-name directory's **parent**, differing only in what else they
  require of it;
- a name's permitted positions are the **union** across the maps;
- a `|` separates alternatives, and a value that splits to nothing ungoverns that name in every map and is
  reported;
- a glob in a unit map matches the unit itself, so a bare `src/lib` means "a unit at exactly `src/lib`" and
  is almost always a mistake — use `src/lib/**`.

Include the design's example configuration verbatim as the worked example.

- [ ] **Step 4: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/architecture/reserved-name-placement.md` — the same content, same
section order, translated. Check `docs/src/content/docs/ja/rules/architecture/reserved-directory-names.md`
for the established heading translations and reuse them exactly.

- [ ] **Step 5: Regenerate the rules index**

Run: `pnpm --filter svelte-vitals run gen:rules-index && pnpm format`
Then: `pnpm --filter svelte-vitals test -- rules-index docs-links`
Expected: PASS. These two suites fail the build if the index is stale or either language page is missing.

- [ ] **Step 6: Add the changeset**

Run `pnpm changeset` and select **minor** for both `@svelte-vitals/core` and `svelte-vitals` (a new rule is
a feature). Summary, one line, naming no other tool:

```
Add architecture/reserved-name-placement: a reserved directory name may appear only in the places declared for it.
```

- [ ] **Step 7: Full verification**

Run, in order, and confirm each is clean:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build && pnpm smoke
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(core): register architecture/reserved-name-placement and document it"
```

---

## Self-Review

**Spec coverage.** Every Testing item 1–15 maps to a task: 1, 2, 3, 6, 7 → Task 3; 4, 5, 12, 13, 15 → Task 2;
8 → Tasks 4 (silence) and 5 (report); 9, 10, 11 → Task 5; 14 → Task 4. The four options, the union, the
name-level empty drop, the aggregated three-part diagnostic with both inherited boundaries, the finding shape
(`route` = directory, `location` = `reportAt` file), no pass results, inertness, the `--route` silence, and
registration/docs/changeset all have a task.

**Deliberately not implemented**, matching the design's "Deliberately not solved": over-permission at a
reserved-name directory; seeding a declaration from the tree; reporting a declared name that never appears;
`tests` as its convention actually states it; the `isUnitDir` mismatch in the sibling rules.

**One item to confirm before writing a real config**, carried from the design: the field measurement counted
`parts` (28) and `styleGuide` (109) as "directly under a unit" without recording the unit's case. If any sits
under a lowercase unit, declaring the name in `capitalisedUnitPlacements` reports it. This blocks the example
encoding, not the rule — a name whose case split is unconfirmed goes in `anyCaseUnitPlacements`, which cannot
produce a false positive the capitalised map would not.
