# Score floor and reach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a less severe finding cost less than a more severe one, and put the magnitude signal where a
mean cannot carry it.

**Architecture:** A floor of 25 joins the existing `max(observedInventory, failedWeight)`, so a category that
checks very few things is scored against the floor rather than against those few. `ScoreResult` gains the
counts of keys touched and keys penalized, which the JSON report exposes per category. The report also gains
the floored weight of every `(category, scope)` pair, so the arithmetic is checkable.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, oxlint + oxfmt, Astro Starlight docs.

**Spec:** `docs/superpowers/specs/2026-08-05-score-floor-and-reach-design.md`. **Read it before Task 1.** Its
predecessor was withdrawn after field review, and its own numbers were measured rather than derived — if one
disagrees with what you compute, stop and report it rather than adjusting a test.

## Global Constraints

- **`packages/core/src/` is runtime-agnostic**: no `node:` imports, no I/O, no runtime-specific globals.
- **The floor is `25`, one named constant beside `CRITICAL_CAP`.** `inventoryWeight = max(observedInventory, failedWeight, 25)`.
- **`DEDUCTION` values, `CRITICAL_CAP`, `Math.floor`, the deficit-space mean, and `sitePenalty` do not
  change.** `sitePenalty` stays absolute points subtracted after the mean.
- **The invariant survives**: no penalized finding → 100; one `info` among many passes → never 100.
- **Comments and docs are for the next reader** (`AGENTS.md`): a line earns its place only when it says
  something the code cannot. Prefer one line over three. **Test names state the behaviour, not the reasoning.**
- **Never name another tool, linter, plugin or product** in any doc, comment or commit message.
- **en/ja docs ship together** — the Japanese must be idiomatic, not a transliteration.
- Conventional commits, scoped by package. **A changeset is required** — `minor`, listing
  `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`.

## File Structure

| File                                                           | Responsibility                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/core/src/scoring/score.ts`                           | the floor constant, the `max`, and the two new `ScoreResult` counts.     |
| `packages/core/src/reporter/json.ts`                           | expose `keys` and `affectedKeys` per category, and the pair inventories. |
| `packages/core/test/score.test.ts`                             | the floor, the ordering, the counts.                                     |
| `packages/core/test/json-report.test.ts`                       | the report shape.                                                        |
| `packages/core/test/*.test.ts`, `packages/vite/test/*.test.ts` | expectations that move because scores rise.                              |
| `docs/src/content/docs/guides/(reporting)/reporters.md` + ja   | the paragraph, the sample, the three facts.                              |
| `.changeset/score-floor-and-reach.md`                          | **new**                                                                  |

Three tasks. The floor changes every score, so it lands alone and its fallout is re-baselined with it; the
counts are additive and separable; the docs are their own reviewable deliverable.

---

## Task 1: The floor

**Files:**

- Modify: `packages/core/src/scoring/score.ts` (the `DEDUCTION`/`CRITICAL_CAP` block near line 5, and the
  `inventoryWeight` line inside `computeScore`)
- Test: `packages/core/test/score.test.ts` (append)

**Interfaces:**

- Consumes: nothing new.
- Produces: `export const INVENTORY_FLOOR = 25;` — Task 2 does not use it, Task 3 imports it so the report
  and the scorer cannot drift.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/score.test.ts`. The `fail`, `pass` and `r` helpers already exist in that file —
read the top of it and reuse them rather than redefining.

```ts
describe('computeScore — inventory floor', () => {
  const config = defineConfig({});

  it('scores a one-rule pair at 80 for a single warning', () => {
    // Inventory 5 floored to 25: 100 − 500/25.
    const rules = [r('x/only', 'seo', 'component', 'warning')];
    const results = [fail('x/only', 'src/A.svelte', 'warning')];
    expect(computeScore(results, config, { rules, applyCriticalCap: false }).score).toBe(80);
  });

  it('scores an eight-info pair at 96 for a single info', () => {
    // Inventory 8 floored to 25: 100 − 100/25.
    const rules = Array.from({ length: 8 }, (_, i) => r(`a/${i}`, 'architecture', 'component', 'info'));
    const results = [fail('a/0', 'src/A.svelte', 'info')];
    expect(computeScore(results, config, { rules }).score).toBe(96);
  });

  it('leaves a pair above the floor unchanged', () => {
    // Inventory 30 > 25, so one warning costs 500/30 and the key scores 83.
    const rules = Array.from({ length: 6 }, (_, i) => r(`s/${i}`, 'seo', 'route', 'warning'));
    const results = [fail('s/0', '/a', 'warning')];
    expect(computeScore(results, config, { rules }).score).toBe(83);
  });

  it('still scores 100 when nothing is penalized', () => {
    const rules = [r('x/only', 'seo', 'component', 'warning')];
    expect(computeScore([pass('x/only', 'src/A.svelte')], config, { rules }).score).toBe(100);
  });

  it('still subtracts sitePenalty in absolute points', () => {
    // A site-wide warning costs 5, not a share of anything — the floor must not reach it.
    const rules = [r('p/site', 'seo', 'project', 'warning'), r('s/one', 'seo', 'route', 'warning')];
    const results = [
      {
        id: 'p/site',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'x'
      },
      pass('s/one', '/a')
    ] as Result[];
    const sr = computeScore(results, config, { rules });
    expect(sr.scoreModel.sitePenalty).toBe(5);
    expect(sr.score).toBe(95);
  });

  it('orders info below warning in every registry pair', () => {
    // Derived from the registry rather than written out, so a new rule cannot silently break the ordering.
    const inv = buildInventory(config);
    const cost = (weight: number, i: number) => (100 * weight) / Math.max(i, 25);
    const worstInfo = Math.max(...[...inv.values()].map((i) => cost(1, i)));
    const cheapestWarning = Math.min(...[...inv.values()].map((i) => cost(5, i)));
    expect(worstInfo).toBeLessThanOrEqual(cheapestWarning);
  });
});
```

Add `buildInventory` to that file's existing import from `../src/scoring/inventory.js` if it is not already
imported.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `packages/core`: `../../node_modules/.bin/vitest run test/score.test.ts -t 'inventory floor'`
Expected: FAIL — the first case scores 0, the second 87, and the ordering assertion is false. The two
"still" cases pass already; they are there to fail if the floor reaches something it must not.

- [ ] **Step 3: Add the floor**

In `packages/core/src/scoring/score.ts`, beside `CRITICAL_CAP`:

```ts
/**
 * A key is never scored against less than this much severity weight. Without it a pair holding one rule
 * makes that rule's finding cost the whole key, and a finding's cost stops tracking its severity — an
 * `info` in an eight-rule pair outweighed a `warning` in a twenty-six-rule one.
 */
export const INVENTORY_FLOOR = 25;
```

and change the `inventoryWeight` line inside `computeScore` from

```ts
inventoryWeight = Math.max(inventoryWeight, failed);
```

to

```ts
inventoryWeight = Math.max(inventoryWeight, failed, INVENTORY_FLOOR);
```

Leave the comment above that line in place and extend it with one clause naming the floor's job; do not
replace what it says about `failed`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `../../node_modules/.bin/vitest run test/score.test.ts -t 'inventory floor'`
Expected: PASS, 6 tests.

- [ ] **Step 5: Prove the floor is load-bearing**

Remove `INVENTORY_FLOOR` from the `Math.max`, confirm the first, second and ordering cases fail and the two
"still" cases stay green, restore, confirm all six green. Report both halves — a floor that also broke the
unchanged cases would be reaching too far.

- [ ] **Step 6: Re-baseline the expectations that move**

```bash
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/vitest run); done
```

Every score against a pair below 25 rises. **Recompute each failing expectation from the formula**
`100 − (100 × failedWeight) / max(observedInventory, failedWeight, 25)` — never paste the number the runner
prints, which makes the test agree with the implementation instead of the design. Get real inventories from
`buildInventory(config)` in a scratch check and delete the scratch file.

**A failure that is not a score or health number is a real regression — stop and report it** rather than
editing the expectation.

- [ ] **Step 7: Typecheck and lint**

```bash
(cd packages/core && ../../node_modules/.bin/tsup)
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit); done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: clean. (`packages/mcp` has no `tsconfig.json`; skip it.)

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/scoring/score.ts packages/core/test packages/cli/test packages/vite/test
git commit -m "fix(core): never score a key against less than 25 points of checks"
```

---

## Task 2: Reach

**Files:**

- Modify: `packages/core/src/scoring/score.ts` (`ScoreResult`, and the return in `computeScore`)
- Modify: `packages/core/src/reporter/json.ts` (`JsonReport['categories']`, and the `categories` assembly)
- Test: `packages/core/test/score.test.ts`, `packages/core/test/json-report.test.ts`

**Interfaces:**

- Consumes: `computeScore` as changed in Task 1.
- Produces:

  ```ts
  export interface ScoreResult {
    score: number;
    rawScore: number;
    scoreModel: ScoreModel;
    /** Keys this result set touched. */
    keys: number;
    /** Keys carrying at least one penalized finding. */
    affectedKeys: number;
  }
  ```

  and `JsonReport['categories']` becomes
  `Record<string, { score: number; scoreModel: ScoreModel; keys: number; affectedKeys: number }>`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/score.test.ts`:

```ts
describe('computeScore — reach', () => {
  const config = defineConfig({});
  const rules = Array.from({ length: 8 }, (_, i) => r(`a/${i}`, 'architecture', 'component', 'info'));

  it('counts keys touched and keys penalized', () => {
    const results = [fail('a/0', 'src/A.svelte', 'info'), pass('a/0', 'src/B.svelte'), pass('a/0', 'src/C.svelte')];
    const sr = computeScore(results, config, { rules });
    expect(sr.keys).toBe(3);
    expect(sr.affectedKeys).toBe(1);
  });

  it('reports the same score and different reach for one finding and for many', () => {
    // The reason reach exists: after the floor these two score alike and must still be distinguishable.
    const keys = Array.from({ length: 40 }, (_, i) => `src/${i}.svelte`);
    const one = keys.map((k, i) => (i === 0 ? fail('a/0', k, 'info') : pass('a/0', k)));
    const many = keys.map((k) => fail('a/0', k, 'info'));
    const a = computeScore(one, config, { rules });
    const b = computeScore(many, config, { rules });
    expect(a.score).toBe(b.score);
    expect(a.affectedKeys).toBe(1);
    expect(b.affectedKeys).toBe(40);
  });

  it('counts a key once however many rules penalize it', () => {
    const results = [fail('a/0', 'src/A.svelte', 'info'), fail('a/1', 'src/A.svelte', 'info')];
    expect(computeScore(results, config, { rules }).affectedKeys).toBe(1);
  });
});
```

Append to `packages/core/test/json-report.test.ts`, reusing that file's module-level `config` and declaring
each case's results inline:

```ts
describe('buildJsonReport — category reach', () => {
  it('reports keys and affectedKeys per category', () => {
    const results: Result[] = [
      {
        id: 'seo/canonical-url',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'x'
      },
      {
        id: 'seo/canonical-url',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'own', value: 'static' },
        route: '/b',
        message: 'ok'
      }
    ];
    const report = buildJsonReport(results, config, { version: '0.0.0' });
    expect(report.categories.seo!.keys).toBe(2);
    expect(report.categories.seo!.affectedKeys).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `packages/core`:
`../../node_modules/.bin/vitest run test/score.test.ts test/json-report.test.ts -t 'reach'`
Expected: FAIL — `keys` and `affectedKeys` are `undefined`.

- [ ] **Step 3: Count and return**

In `computeScore`, the loop over `observed` already visits every key. Count there:

```ts
  let affectedKeys = 0;
  let totalDeficit = 0;
  for (const [key, pairs] of observed) {
    let failed = 0;
    for (const d of ruleMax.get(key)?.values() ?? []) failed += d;
    if (failed > 0) affectedKeys += 1;
```

and extend the return:

```ts
return {
  score: Math.floor(rawScore),
  rawScore,
  scoreModel: { routeAverage, sitePenalty, criticalCap },
  keys: keyCount,
  affectedKeys
};
```

`keyCount` is already computed as `observed.size`. Add the two fields to `ScoreResult` with the docstrings
from the Interfaces block above.

- [ ] **Step 4: Expose them in the report**

In `packages/core/src/reporter/json.ts`, widen the interface line:

```ts
categories: Record<string, { score: number; scoreModel: ScoreModel; keys: number; affectedKeys: number }>;
```

and the assembly:

```ts
const categories = Object.fromEntries(
  Object.entries(byCat).map(([cat, sr]) => [
    cat,
    { score: sr.score, scoreModel: sr.scoreModel, keys: sr.keys, affectedKeys: sr.affectedKeys }
  ])
);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `../../node_modules/.bin/vitest run test/score.test.ts test/json-report.test.ts -t 'reach'`
Expected: PASS, 4 tests.

- [ ] **Step 6: Fix what stops compiling**

`keys` and `affectedKeys` are required on `ScoreResult` and on the report's `categories`, so hand-built
literals in test fixtures break. A text search for the type name will not find them all — several are typed
through another type:

```bash
(cd packages/core && ../../node_modules/.bin/tsup)
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit); done
```

Give each fixture `keys: 0, affectedKeys: 0` — these exercise rendering, not scoring, and zero is the honest
value for a literal with no scored results. Do not invent counts.

- [ ] **Step 7: Run everything**

```bash
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/vitest run); done
(cd packages/core && ../../node_modules/.bin/tsup)
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit); done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src packages/core/test packages/vite/test
git commit -m "feat(core): report how many keys a category reached"
```

---

## Task 3: The inventories, and the documentation

**Files:**

- Modify: `packages/core/src/reporter/json.ts` (`JsonReport`, and `buildJsonReport`)
- Test: `packages/core/test/json-report.test.ts`
- Modify: `docs/src/content/docs/guides/(reporting)/reporters.md` and
  `docs/src/content/docs/ja/guides/(reporting)/reporters.md`
- Create: `.changeset/score-floor-and-reach.md`

**Interfaces:**

- Consumes: Tasks 1 and 2, and `buildInventory` / `pairKey` from `packages/core/src/scoring/inventory.js`.
- Produces: `JsonReport` gains `inventories: Record<string, number>`, keyed `"<category>::<scope>"`, holding
  the **floored** weight each key of that pair is scored against.

**Why here and not on `scoreModel`.** A `ScoreModel` describes one `computeScore` call, and the call behind a
category covers many keys of possibly different pairs — there is no single inventory weight to report there,
and reporting one key's would be a number that explains nothing. The pair map is unambiguous, is the same for
every key of a pair, and is what a reader needs to check any of them.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/json-report.test.ts`, reusing that file's module-level `config`:

```ts
describe('buildJsonReport — pair inventories', () => {
  it('reports the floored weight of each pair', () => {
    const results: Result[] = [
      {
        id: 'seo/canonical-url',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'x'
      }
    ];
    const report = buildJsonReport(results, config, { version: '0.0.0' });
    // seo::route holds 110 points and is above the floor; architecture::component holds 8 and is not.
    expect(report.inventories['seo::route']).toBe(110);
    expect(report.inventories['architecture::component']).toBe(25);
  });

  it('lets a reader recompute a route category score from the map', () => {
    const results: Result[] = [
      {
        id: 'seo/canonical-url',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'x'
      }
    ];
    const report = buildJsonReport(results, config, { version: '0.0.0' });
    const i = report.inventories['seo::route']!;
    expect(Math.floor(100 - (100 * 5) / i)).toBe(report.routes[0]!.categories.seo);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `packages/core`: `../../node_modules/.bin/vitest run test/json-report.test.ts -t 'pair inventories'`
Expected: FAIL — `report.inventories` is `undefined`.

- [ ] **Step 3: Build the map**

In `packages/core/src/reporter/json.ts`, add to the interface:

```ts
/** Floored severity weight per `"<category>::<scope>"` pair — the divisor behind every key of that pair. */
inventories: Record<string, number>;
```

and in `buildJsonReport`, beside the other derived values:

```ts
const inventories = Object.fromEntries(
  [...buildInventory(config)].map(([pair, weight]) => [pair, Math.max(weight, 25)])
);
```

Import `buildInventory` from `../scoring/inventory.js`. Add `inventories` to the returned object.

**The `25` here must not be a second literal.** Export `INVENTORY_FLOOR` from
`packages/core/src/scoring/score.ts` (Task 1 declared it) and use it, so the report and the scorer cannot
drift.

- [ ] **Step 4: Run the test to verify it passes**

Run: `../../node_modules/.bin/vitest run test/json-report.test.ts -t 'pair inventories'`
Expected: PASS, 2 tests. Then run the full core suite; `JsonReport` literals in
`packages/core/test/html-report.test.ts` and the two `packages/vite` fixtures need `inventories: {}`.

- [ ] **Step 5: Write the guide paragraph**

`docs/src/content/docs/guides/(reporting)/reporters.md` documents the report shape. Add the sample fields
(`keys`, `affectedKeys`, and the `inventories` map) and this paragraph, adapted to the page's voice:

> A category's score on a key is the share of that category's severity weight that survived. One `info` costs
> a twenty-fifth of the weight at most, one `warning` five times that, one `critical` fifteen times — so a
> more severe finding always costs more than a less severe one within a category, and a category that checks
> very few things is scored against a floor rather than against those few. Repeated findings from the same
> rule on the same key cost what one costs. Beside the score, `affectedKeys` says how much of the project the
> category touched: the score is depth, that is reach.

Then add the two facts the paragraph does not carry:

- per-key scores are comparable **within** a category; across categories the number says which category has a
  larger share of _its own_ checks failing, not which problem is worse;
- `inventories` gives the divisor behind every key of a pair, so any score can be recomputed by hand.

Mirror all of it in the Japanese page. **Do not transliterate** — write it as Japanese technical prose.

- [ ] **Step 6: Write the changeset**

Create `.changeset/score-floor-and-reach.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

A less severe finding now costs less than a more severe one, and the report says how much of a project each
category touched.

A key's category score is the share of that category's severity weight that survived, so a finding's cost
depends on how much that category checks. Where a category checked very little, a single `info` could cost
more than a `warning` elsewhere — measured on a real project, an `info` took 13 points off a key while a
`warning` took 5 — and a category holding one rule scored a key **0** for one finding. A key is now never
scored against less than 25 points of checks, which orders `info` below `warning` everywhere and turns that
0 into 80.

Scores rise wherever a category checks few things. **A `--min-health` gate calibrated on the previous release
will pass more easily; recalibrate it.**

Because a score is a mean over every key, forty affected keys and one affected key can display alike. Each
category in the JSON report now carries `keys` and `affectedKeys`, which distinguish them exactly, and
an `inventories` map giving the divisor behind every key, so the arithmetic can be checked.
```

- [ ] **Step 7: Run everything**

```bash
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/vitest run); done
(cd packages/core && ../../node_modules/.bin/tsup)
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit); done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
(cd packages/cli && ../../node_modules/.bin/vitest run test/docs-links.test.ts test/rules-index.test.mjs test/docs-embed.test.mjs)
node scripts/floor-smoke.mjs
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add packages/core docs .changeset
git commit -m "feat(core): expose the weight each pair is scored against"
```

---

## Notes for whoever runs this

- A full-workspace `pnpm` command fails in this sandbox for a known, pre-existing reason (the `docs` package's
  dependencies), and `pnpm --filter <pkg> build` fails on a reflink error. Use `../../node_modules/.bin/tsup`
  from inside the package.
- The spec records four things as deliberately out of scope: ordering `warning` below `critical` across
  categories (no floor achieves it), excluding unconfigured rules from the denominator (the floor subsumes
  it), fixing dilution (reach is the answer instead), and rendering reach in the HTML report or dashboard.
- The predecessor design was withdrawn after field review found its central justification false. If you are
  about to write a comment or a doc sentence describing _why_ the model behaves as it does, take the wording
  from the spec rather than paraphrasing — the last branch shipped a flat claim into a code comment that the
  spec had spent four review passes making precise.
