# Examined Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report how many places each declaration of `architecture/reserved-name-placement` judged, so that a run producing zero findings stops being indistinguishable from a run that checked nothing.

**Architecture:** `runRules` hands each rule a one-shot sink and returns what the rules wrote to it, keyed by rule id. The engine owns the sink so no caller can forget to thread it. The counts surface as a **top-level** `examined` map in the JSON report — not on `rules[id]`, because `findings`/`passed` describe what survived reporting while this describes what the analysis examined.

**Tech Stack:** TypeScript, vitest, the `@svelte-vitals/core` rule engine.

Design: `docs/superpowers/specs/2026-08-07-examined-counts-design.md` (approved after adversarial review, 2026-08-07). Read it before Task 1 — in particular the table enumerating the five ways a count can be zero, which review produced by execution after an earlier draft claimed zero meant one thing.

## Global Constraints

- **The number counts places judged, not places permitted and not findings.** A directory the declaration rejected counts exactly as much as one it permitted.
- **Zero means the declaration judged nothing, and nothing more.** Do not add prose anywhere — code comment, report, guide — claiming zero implies the tree is compliant or a position unoccupied. Review falsified that with two supported configurations.
- **Only globally resolved declarations are counted**, the same set the rule's diagnostic classifies. A declaration minted by an `overrides` layer is not counted, and a directory judged under one must not inflate a global declaration's number.
- **Empty-value declarations have no key.** Their diagnostic label is `map.name` with no `→ glob`; there is no glob, so there is no count key. The label-match and zero claims are about **glob-bearing** declarations only.
- **A run with no file inventory reports no counts at all — not a map of zeros.** `--route` runs pass `sourceFiles: undefined` and the dev-server hooks pass none; the rule returns before its config guard in that case.
- **The counts are not filtered** by `--diff`, `--baseline` or suppressions. They describe the analysis, not the report.
- `packages/core` has **no `node:` imports, no I/O, no runtime-specific globals**.
- **Never name another tool, linter, plugin, product or automated reviewer** in code, tests, docs, changeset or commit messages. PR bodies are written in English.
- Read `AGENTS.md` first, especially the comment convention: a comment earns its place only when it says something the code cannot.
- **Verify commands — use these exact invocations.** A `pnpm --filter` package-suite run times out in this sandbox. From the repo root:
  - one test file: `cd packages/<pkg> && ../../node_modules/.bin/vitest run test/<file>.test.ts`
  - whole suites: `../../node_modules/.bin/vitest run` from `packages/core`, `packages/cli`, `packages/vite`
  - typecheck: `cd packages/<pkg> && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json` for all three
  - lint: `./node_modules/.bin/oxlint .` — format: `./node_modules/.bin/oxfmt --write .` then `--check .`
  - Never run `pnpm install`. Never background a run.
- **`packages/cli` and `packages/vite` resolve core through its built `dist/`, not its source.** A change in
  `packages/core/src` is invisible to their suites until you rebuild:
  `cd packages/core && ../../node_modules/.bin/tsup`, then the same in `packages/cli` if the CLI changed too.
  `dist/` is gitignored, so this never appears in a diff — and a suite that looks green against a stale build
  is exactly the kind of false assurance this feature exists to remove.

---

## File Structure

| File                                                                | Responsibility                                                                                                                      |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/engine.ts`                                       | **Modify.** `runRules` builds a per-rule sink and returns `{ results, examined }`.                                                  |
| `packages/core/src/rule.ts`                                         | **Modify.** `RuleContext` gains the optional sink.                                                                                  |
| `packages/core/src/reporter/json.ts`                                | **Modify.** `JsonReport` gains a top-level `examined`; `buildJsonReport` accepts it.                                                |
| `packages/core/test/engine.test.ts`                                 | **Modify or create.** The mechanism, tested with synthetic rules.                                                                   |
| `packages/core/src/rules/architecture/reserved-name-placement.ts`   | **Modify.** Counts judgments per globally resolved glob-bearing declaration.                                                        |
| `packages/core/test/reserved-name-placement.test.ts`                | **Modify.** The counting behaviour.                                                                                                 |
| `packages/cli/src/index.ts`                                         | **Modify.** Destructure `runRules`; carry `examined` out of `analyzeProject` the way `ruleIds` already is; pass it to the reporter. |
| `packages/vite/src/analyze.ts`, `packages/vite/src/hooks/handle.ts` | **Modify.** Destructure the new return shape. `handle.ts` builds no JSON report, so it drops the counts deliberately.               |
| `docs/src/content/docs/guides/(reporting)/reporters.md` + `ja/`     | **Modify.** Document `examined`, and scope the existing "the counts describe the report, not the tree" sentence to `rules`.         |
| `.changeset/examined-counts.md`                                     | **Create.** Minor for the three packages.                                                                                           |

---

## Task 1: The mechanism

**Files:**

- Modify: `packages/core/src/rule.ts` (the `RuleContext` interface)
- Modify: `packages/core/src/engine.ts` (all four lines of it)
- Modify: `packages/core/src/reporter/json.ts` (`JsonReport`, `buildJsonReport`)
- Modify: `packages/cli/src/index.ts`, `packages/vite/src/analyze.ts`, `packages/vite/src/hooks/handle.ts`
- Modify or create: `packages/core/test/engine.test.ts`

**Interfaces:**

- Produces, for Task 2:
  ```ts
  // rule.ts, on RuleContext
  /** Report per-declaration counts of places examined. The engine keys them by rule id. */
  recordExamined?: (counts: Record<string, number>) => void;

  // engine.ts
  runRules(rules: Rule[], ctx: RuleContext): Promise<{
    results: Result[];
    examined: Record<string, Record<string, number>>;
  }>;

  // json.ts — a new top-level field
  examined?: Record<string, Record<string, number>>;
  buildJsonReport(results, config, meta, ruleIds?, examined?): JsonReport;
  ```

**A rule that reaches the end always calls the sink, even with an empty map.** So there are three states, not
two: no entry at all means the rule does not count or returned before reaching the call; an entry of `{}` means
it counts and this configuration declares nothing; an entry with a `0` means a declaration judged nothing.
Collapsing the middle one into the first would lose the distinction between "not configured" and "does not
count", which is the same distinction `ruleIds` exists to preserve for `rules`.

**Why one call rather than an incrementing one.** The rule seeds every declaration at 0 and increments as it walks, so it already holds a complete map by the end. A single hand-off keeps the sink dumb and makes "seeded at 0 but never incremented" expressible, which is the whole point.

- [ ] **Step 1: Write the failing engine tests**

In `packages/core/test/engine.test.ts` (read it first; create it following the conventions of a neighbouring core test file if it does not exist):

```ts
import { describe, expect, it } from 'vitest';
import { runRules } from '../src/engine.js';
import type { Rule, RuleContext } from '../src/rule.js';

const ctx = { heads: [], project: {}, config: { rules: {} } } as unknown as RuleContext;

function ruleThatCounts(id: string, counts: Record<string, number>): Rule {
  return {
    id,
    title: id,
    category: 'architecture',
    severity: 'info',
    scope: 'component',
    rationale: '',
    async check(c: RuleContext) {
      c.recordExamined?.(counts);
      return [];
    }
  } as unknown as Rule;
}

function ruleThatDoesNot(id: string): Rule {
  return {
    id,
    title: id,
    category: 'architecture',
    severity: 'info',
    scope: 'component',
    rationale: '',
    async check() {
      return [];
    }
  } as unknown as Rule;
}

describe('runRules examined counts', () => {
  it('keys a rule’s counts by its id', async () => {
    const { examined } = await runRules([ruleThatCounts('a/one', { 'x → y': 3 })], ctx);
    expect(examined).toEqual({ 'a/one': { 'x → y': 3 } });
  });

  it('gives a rule that reports nothing no entry at all', async () => {
    const { examined } = await runRules([ruleThatDoesNot('a/two')], ctx);
    expect(Object.hasOwn(examined, 'a/two')).toBe(false);
  });

  it('keeps two rules’ counts apart', async () => {
    const { examined } = await runRules([ruleThatCounts('a/one', { g: 1 }), ruleThatCounts('a/two', { g: 2 })], ctx);
    expect(examined).toEqual({ 'a/one': { g: 1 }, 'a/two': { g: 2 } });
  });

  it('still returns the results', async () => {
    const { results } = await runRules([ruleThatDoesNot('a/two')], ctx);
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/engine.test.ts`
Expected: FAIL — `runRules` returns an array, so `{ examined }` is undefined and `{ results }` too.

- [ ] **Step 3: Add the sink to the context type**

In `packages/core/src/rule.ts`, inside `RuleContext`, beside the other optional members:

```ts
  /**
   * Report per-declaration counts of places this rule examined. The engine supplies it and keys the
   * result by rule id; a rule that does not call it gets no entry, which is distinct from an entry of
   * zeros. Absent in contexts a caller builds directly.
   */
  recordExamined?: (counts: Record<string, number>) => void;
```

- [ ] **Step 4: Have the engine own the sink**

Replace the body of `packages/core/src/engine.ts`:

```ts
export async function runRules(
  rules: Rule[],
  ctx: RuleContext
): Promise<{ results: Result[]; examined: Record<string, Record<string, number>> }> {
  const examined: Record<string, Record<string, number>> = {};
  // The engine supplies the sink rather than each caller: three call sites thread this context, and a
  // caller that forgot would drop the counts silently — the failure this feature exists to remove.
  const perRule = await Promise.all(
    rules.map((rule) => rule.check({ ...ctx, recordExamined: (counts) => void (examined[rule.id] = counts) }))
  );
  return { results: perRule.flat(), examined };
}
```

- [ ] **Step 5: Run the engine tests**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/engine.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Add the report field**

In `packages/core/src/reporter/json.ts`, add to `JsonReport` after `inventories`:

```ts
  /**
   * Per-rule, per-declaration counts of places examined. Unlike `rules`, this describes the analysis
   * rather than the report: `--diff`, `--baseline` and suppressions do not narrow it. A rule that
   * counts nothing has no entry; a declaration that judged nothing has an entry of `0`.
   */
  examined?: Record<string, Record<string, number>>;
```

Add a trailing optional `examined` parameter to `buildJsonReport` and include it in the returned object only
when the argument is given and has at least one key, so reports from callers that pass nothing are
byte-identical to today's. Note this is about the **outer** map: an inner `{}` — a counting rule with nothing
declared — still produces `"examined": { "<rule id>": {} }`, which is a meaningful state.

- [ ] **Step 7: Update the three callers**

`packages/cli/src/index.ts` around line 234 currently reads
`await runRules(rules, { heads, images, headings, components, project, config, kitModules, sourceFiles })`.
Destructure it, carry `examined` into `analyzeProject`'s return object beside `ruleIds`, add it to the
`AnalyzeResult` type, and pass it as the new last argument at the `formatJsonReport` call (~line 479).

`packages/vite/src/analyze.ts` (~line 76) and `packages/vite/src/hooks/handle.ts` (~line 66): destructure
`{ results }`. In `handle.ts` the call is nested inside `applyRuleSeverities(await runRules(...), config)`, so
it becomes `applyRuleSeverities((await runRules(...)).results, config)` or a hoisted `const { results }` —
whichever reads better there. `handle.ts` builds no JSON report — it POSTs results to the overlay ingest — so it drops the
counts. Add a one-line comment there saying so, or the next reader will file it as an oversight.

- [ ] **Step 8: Confirm no caller was missed**

```bash
grep -rn "runRules(" packages/*/src/ packages/*/test/
```

**Both trees, not just `src/`** — an earlier draft of this plan grepped only `src/` and missed
`packages/core/test/seo001.test.ts`, which calls `runRules` directly. Every hit outside `engine.ts` must
destructure. A hit that still treats the return as an array is a type error, so this grep is a cross-check on
the typechecker rather than the only guard.

- [ ] **Step 9: Run everything**

`cd packages/core && ../../node_modules/.bin/vitest run`, the same from `packages/cli` and `packages/vite`,
then typecheck all three, then lint and format from the repo root.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src packages/core/test packages/cli/src packages/vite/src
git commit -m "feat(core): let a rule report what it examined, keyed by the engine"
```

---

## Task 2: The rule counts

**Files:**

- Modify: `packages/core/src/rules/architecture/reserved-name-placement.ts`
- Modify: `packages/core/test/reserved-name-placement.test.ts`

**Interfaces:**

- Consumes: `ctx.recordExamined` from Task 1.
- Produces: nothing later tasks depend on.

**Where the count is taken.** A directory reaches the judging phase only past five early exits — the rule is
inert here, the directory's name is in no map, **any** map's value for that name splits to nothing, the
directory is at the root, or it is excluded. Past all five, the directory is judged, and **every globally
resolved glob-bearing alternative of its name, in every map, increments by one** — whether or not that
alternative's glob matched the parent. The declaration was consulted; that is what "judged against" means.

`globalAlternatives` is keyed by label and stores `{ map, glob }` but not the name, so this task adds a
name-to-labels index built in the same loop.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe` in `packages/core/test/reserved-name-placement.test.ts`. Read the file's
`run(files, options, extra)` and `projectScoped` helpers first and reuse them; add an `examinedFor` helper
alongside them if the run helper does not already surface the counts.

```ts
it('counts every directory a declaration judged, permitted or not', async () => {
  const { examined } = await runWithCounts(
    [
      'src/lib/Card/Card.svelte',
      'src/lib/Card/parts/a.svelte',
      'src/lib/Panel/Panel.svelte',
      'src/lib/Panel/parts/b.svelte',
      'src/lib/other/parts/c.svelte',
      'src/lib/other/x.ts'
    ],
    { capitalisedUnitPlacements: { parts: 'src/**' } }
  );
  // Three `parts/` judged: two permitted, one rejected. The rejected one counts too.
  expect(examined['capitalisedUnitPlacements.parts → src/**']).toBe(3);
});

it('reports zero for a live declaration nothing occupies, with no finding and no diagnostic', async () => {
  const files = ['src/lib/Card/Card.svelte'];
  const options = { anyCaseUnitPlacements: { types: 'src/**' } };
  const { examined, results } = await runWithCounts(files, options);
  expect(examined['anyCaseUnitPlacements.types → src/**']).toBe(0);
  expect(results).toEqual([]);
});

it('names a declaration in examined with the same string the diagnostic uses', async () => {
  const { examined, results } = await runWithCounts(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'], {
    capitalisedUnitPlacements: { parts: 'src/**' },
    placements: { stores: 'src/nowhere/**' }
  });
  const note = results.find((r) => r.route === undefined)?.message ?? '';
  expect(note).toContain("'placements.stores → src/nowhere/**'");
  expect(Object.hasOwn(examined, 'placements.stores → src/nowhere/**')).toBe(true);
});

it('gives an empty-value declaration no key', async () => {
  const { examined } = await runWithCounts(['src/lib/Card/Card.svelte'], { placements: { e2e: '|' } });
  expect(Object.keys(examined).filter((k) => k.startsWith('placements.e2e'))).toEqual([]);
});

it('zeroes a name whose sibling map carries an empty value', async () => {
  const { examined } = await runWithCounts(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'], {
    capitalisedUnitPlacements: { parts: 'src/**' },
    placements: { parts: '|' }
  });
  // The empty value ungoverns `parts` in every map, so the good declaration judges nothing.
  expect(examined['capitalisedUnitPlacements.parts → src/**']).toBe(0);
});

it('does not count a declaration that exists only in an overrides layer', async () => {
  const { examined } = await runWithCounts(
    ['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'],
    { capitalisedUnitPlacements: { parts: 'src/**' } },
    {
      overrides: [{ files: 'src/**/parts', rules: { [ID]: { options: { placements: { parts: 'src/lib/Card' } } } } }]
    } as never
  );
  expect(Object.keys(examined).filter((k) => k.startsWith('placements.'))).toEqual([]);
});

it('reports no counts at all on a run with no file inventory', async () => {
  const config = { rules: { [ID]: { options: { capitalisedUnitPlacements: { parts: 'src/**' } } } } };
  const seen: Record<string, number>[] = [];
  await architectureReservedNamePlacement.check({
    sourceFiles: undefined,
    config,
    recordExamined: (c) => void seen.push(c)
  } as unknown as RuleContext);
  expect(seen).toEqual([]);
});
```

Add a `runWithCounts(files, options, extra?)` helper beside the existing `run`, returning
`{ results, examined }` where `examined` is `(await runRules([rule], ctx)).examined[ID] ?? {}`.

**Corrected after execution: the second test's fixture asserted a number it could not produce.** As first
written it also listed `src/lib/db/types/t.ts` with a `placements: { types: 'src/lib/db' }` entry, which puts a
`types/` directory in the tree — that directory clears all five early exits, so the count is `1`, not `0`. A
declaration that is judged and merely doesn't qualify is not the declaration nothing occupies. The fixture
above is the corrected one: no directory named `types` exists, so the name never clears the name-in-no-map
exit anywhere, and the glob still reaches a live unit so no diagnostic fires either.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/reserved-name-placement.test.ts`
Expected: every new test FAILS — the rule reports nothing yet, so `examined` is `{}` throughout. Record each
one's actual result rather than assuming; the last one may pass vacuously if the helper is wrong, and if it
does, say so.

- [ ] **Step 3: Build the name index and the counter**

In the loop that fills `globalAlternatives` (around line 113), collect the labels per name as well:

```ts
const labelsByName = new Map<string, string[]>();
```

and inside the `for (const glob of globs)` body, after the `globalAlternatives.set(...)`:

```ts
const key = label(map, name, glob);
labelsByName.set(name, [...(labelsByName.get(name) ?? []), key]);
```

Declare the counter beside `usedAlternatives`, seeded from every global alternative so a declaration that
judges nothing reports `0` rather than vanishing:

```ts
const examinedCounts: Record<string, number> = {};
for (const key of globalAlternatives.keys()) examinedCounts[key] = 0;
```

- [ ] **Step 4: Increment where the directory is judged**

Immediately after the last of the five early exits — that is, directly before the `record` closure is defined —
add:

```ts
// Past every early exit, so this directory is judged. Each globally resolved alternative of its
// name was consulted, whether or not its glob matched: that is what the count reports.
for (const key of labelsByName.get(name) ?? []) examinedCounts[key] = (examinedCounts[key] ?? 0) + 1;
```

Then, immediately before the rule's final `return out;`:

```ts
ctx.recordExamined?.(examinedCounts);
```

**It must be after the `sourceFiles === undefined` guard and after the `isMentionedAnywhere` guard**, both of
which `return []` earlier — a run with no inventory must report nothing, not a map of zeros.

- [ ] **Step 5: Run the tests**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/reserved-name-placement.test.ts`
Expected: PASS, every test including the pre-existing ones.

- [ ] **Step 6: Verify each guard is load-bearing**

| Break                                                                                | Test that must fail                                                                    |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| seed loop removed, so a judged-nothing declaration vanishes                          | "reports zero for a live declaration nothing occupies…"                                |
| the increment moved inside `record()`'s `qualifies` branch                           | "counts every directory a declaration judged, permitted or not"                        |
| `labelsByName` built from the per-directory resolved maps instead of the global ones | "does not count a declaration that exists only in an overrides layer"                  |
| `recordExamined` called before the `sourceFiles === undefined` guard                 | "reports no counts at all on a run with no file inventory"                             |
| empty-value names added to `labelsByName`                                            | "gives an empty global value no key even at a directory an overrides layer un-empties" |
| the increment moved above the empty-value early exit                                 | "zeroes a name whose sibling map carries an empty value"                               |

Every row must fail exactly the named test. **This rule has already shipped five tests that pinned nothing**,
three of them because a fixture never reached the code under test — so if a break causes no failure, say which
row and either strengthen the test or explain why no behavioural test can pin that guard.

**Corrected after execution: row 5 named a test that survives the break.** "gives an empty-value declaration no
key" passes with empty-value names planted in the index, because its fixture has no `e2e` directory at all —
the bad entry is added and then never read, which is indistinguishable from never being added. The row now
names the test written to close exactly that gap: an overrides layer gives one `e2e` directory a non-empty
per-directory value, clearing the empty-value early exit while the global value stays empty, so the increment
loop runs for that name and would read a planted entry if one existed.

**Rows 3 and 5 name `labelsByName`, which the follow-up fix wave deleted.** The increment is now keyed on the
values resolved at each directory and filtered through `globalAlternatives`, because keying it on the global
values let an `overrides` layer that _replaces_ a value inflate the global declaration's count while the
diagnostic still called that declaration dead. Read both rows as breaks against whatever index the increment
reads.

- [ ] **Step 7: Confirm `--diff` does not narrow the count**

Add one CLI-level test in `packages/cli/test/analyze-project.test.ts` following that file's existing pattern: a
fixture where the rule produces a finding, analysed with a `--diff`-style scope applied, asserting the count is
the full number rather than the filtered one. Read how the file's existing scope tests are written and follow
them; if the harness cannot express it there, say so and put it where it fits, naming the file in your report.

- [ ] **Step 8: Run everything**

Whole core, cli and vite suites; typecheck all three; lint and format.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/rules/architecture/reserved-name-placement.ts packages/core/test/reserved-name-placement.test.ts packages/cli/test/analyze-project.test.ts
git commit -m "feat(core): count what each reserved-name-placement declaration judged"
```

---

## Task 3: Documentation and changeset

**Files:**

- Modify: `docs/src/content/docs/guides/(reporting)/reporters.md`
- Modify: the Japanese counterpart under `docs/src/content/docs/ja/guides/(reporting)/`
- Create: `.changeset/examined-counts.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Document the new map, and scope the sentence it contradicts**

The guide's `json` section documents the `rules` map and currently says:

> The counts describe the report, not the tree. Baseline, suppression and `--diff` filtering are applied before
> the report is built…

That sentence is about `rules` and stays true of it. **Scope it explicitly to `rules`**, because `examined` is
the one count in the report that describes the analysis instead — leaving the sentence unqualified would make
the guide contradict the new field.

Then document `examined`: a top-level map from rule id to declaration label to the number of places that
declaration judged. Say what the number counts — places judged, permitted or rejected — and that it is not
narrowed by `--diff`, `--baseline` or suppressions.

**Do not tell the reader what zero implies about their tree.** It can mean the declaration judged nothing for
any of several reasons, including an `overrides`-supplied `exclude` that produces no diagnostic at all. State
what the number counts and stop. The guide may say that a non-zero count is what distinguishes "the tree
complies" from "nothing was checked", which is the question the field could not answer without planting a
violation — that direction is sound.

- [ ] **Step 2: Mirror it in Japanese**

Same claims, same order, same paragraph count, reusing that page's existing terminology for レポート, 宣言 and
除外 rather than inventing wording.

- [ ] **Step 3: Run the docs gates**

```bash
cd packages/cli && ../../node_modules/.bin/vitest run test/docs-links.test.ts test/rules-index.test.mjs test/docs-embed.test.mjs
```

Then `grep -rn "examined\|describe the report" packages/cli/docs/` — that directory holds the topics
`svelte-vitals docs show` prints, generated into `packages/cli/src/docs/generated.ts`. If anything there
discusses the `rules` map's semantics, correct it and regenerate with `cd packages/cli && node scripts/gen-docs.mjs`.
**If nothing turns up, say so explicitly** — I want it checked, not assumed.

- [ ] **Step 4: Write the changeset**

`pnpm changeset` is interactive and unavailable. Write `.changeset/examined-counts.md` by hand, following the
shape of an existing entry. **Minor** for `@svelte-vitals/core`, `svelte-vitals` and `@svelte-vitals/vite`;
verify that package list with `git diff --stat $(git merge-base main HEAD)..HEAD` before writing it.

The body must name **every changed exported type**, not only the behaviour: `runRules`'s return shape,
`RuleContext`'s new optional member, and `JsonReport`'s new top-level `examined`. Say that `RuleEvidence` is
unchanged and why the count is not there. And state the user-visible problem: a glob-configured rule reporting
zero findings could not be distinguished from one whose declarations matched nothing, and verifying a real
project meant planting a deliberate violation to see whether anything fired.

- [ ] **Step 5: Format, lint, commit**

```bash
./node_modules/.bin/oxfmt --write . && ./node_modules/.bin/oxfmt --check . && ./node_modules/.bin/oxlint .
git add -A
git commit -m "docs: document the examined map and scope the report-versus-tree sentence"
```

---

## Self-Review

**Spec coverage.** Design testing items map as: 1 → Task 2 test 1; 2 → Task 2 test 2; 3 → Task 2 test 1 (the
rejected directory is in the same fixture); 4 → Task 2 test 3; 5 → Task 1 test 2; 6 → Task 2 test 7; 7 → Task 1
Step 7 and Step 8's grep, with the dev-hooks caller named as deliberately dropping the counts; 8 → Task 2 test
6; 9 → Task 2 Step 7; 10 → Task 2 test 5.

The design's other requirements: the top-level placement and its reason are Task 1 Step 6; the "zero means
nothing more" rule is a Global Constraint and enforced by Task 3 Step 1's instruction not to gloss it; the
scoping of the label and zero claims to glob-bearing declarations is Task 2 test 4; the docs impact is Task 3.

**Deliberately not implemented**, matching the design: the three sibling directory rules; a console `--stats`
surface; counting for rules that are not glob-configured; making zero a finding; and the two zero-causes that
carry no explanation, which are recorded rather than fixed.
