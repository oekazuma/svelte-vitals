# Per-route category scores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reader of the JSON report see what each route scored in each category, so a category's number
can be traced to the routes that produced it.

**Architecture:** `scoresByCategory` gains an optional `ScoreOptions` parameter forwarded to `computeScore`;
the JSON reporter calls it per route with `{ applyCriticalCap: false }` and puts the resulting scores on each
`routes[]` entry. Nothing else in the scoring model changes.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, oxlint + oxfmt, Astro Starlight docs.

**Spec:** `docs/superpowers/specs/2026-08-04-route-category-scores-design.md`. **Read it before Task 1** — it
was rejected four times by adversarial review, and three of those rejections were claims that sounded
authoritative and were false. Every number in this plan is measured; if one disagrees with what you compute,
stop and report it rather than adjusting the test.

## Global Constraints

- **`packages/core/src/` is runtime-agnostic**: no `node:` imports, no I/O, no runtime-specific globals.
- **`scoresByCategory`'s existing behaviour must not change.** Its new third parameter defaults to `{}`, and
  every current caller passes nothing. `computeHealth` in particular **depends on a category still being
  capped at 79 by a `critical`** — `2026-07-31-score-honesty-design.md` requires a capped category to pull
  Health down.
- **The per-route map carries scores only, never `scoreModel`.**
- **Only the categories that produced a result on that route appear.** A route with no `architecture` result
  must **not** show `architecture: 100`; that would claim a measurement that never happened.
- **The critical cap is off on the per-route path**, matching `routes[].score`.
- **Comments and docs are for the next reader** (`AGENTS.md`): a line earns its place only when it says
  something the code cannot. Prefer one line over three.
- **Never name another tool, linter, plugin or product** in any doc, comment or commit message.
- **en/ja docs ship together.**
- Conventional commits, scoped by package. **A changeset is required** — `minor` (a new report field), listing
  `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`.

## File Structure

| File                                                                                                                               | Responsibility                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/core/src/scoring/score.ts`                                                                                               | `scoresByCategory` gains `options: ScoreOptions = {}`, forwarded to `computeScore`. Three lines. |
| `packages/core/src/reporter/json.ts`                                                                                               | `JsonReport['routes']` gains `categories`; `buildJsonReport` fills it.                           |
| `packages/core/test/score.test.ts`                                                                                                 | the new parameter, and that omitting it still caps.                                              |
| `packages/core/test/json-report.test.ts`                                                                                           | the field's contents, the absence rule, the cap, and the disagreement with `routes[].score`.     |
| `packages/core/test/html-report.test.ts`, `packages/vite/test/app-shell-static.test.ts`, `packages/vite/test/ui-dashboard.test.ts` | eight literal route constructions that stop compiling.                                           |
| `docs/src/content/docs/guides/(reporting)/reporters.md` + ja                                                                       | the sample and the prose.                                                                        |
| `.changeset/route-category-scores.md`                                                                                              | **new**                                                                                          |

Two tasks. The scoring parameter is separable from the reporter that uses it — a reviewer can reject one while
approving the other — and the parameter is where the risk lives, because getting its default wrong silently
changes Health.

---

## Task 1: `scoresByCategory` takes scoring options

**Files:**

- Modify: `packages/core/src/scoring/score.ts` (`scoresByCategory`, around line 120)
- Test: `packages/core/test/score.test.ts` (append)

**Interfaces:**

- Consumes: `ScoreOptions`, `computeScore`, `Category`, `ScoreResult` — all already in that file.
- Produces:

  ```ts
  export function scoresByCategory(
    results: Result[],
    config: Config,
    options: ScoreOptions = {}
  ): Partial<Record<Category, ScoreResult>>;
  ```

  Task 2 calls it as `scoresByCategory(rs, config, { applyCriticalCap: false })`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/score.test.ts`. The `fail` helper already exists at the top of that file; do not
redefine it.

```ts
describe('scoresByCategory — scoring options', () => {
  const config = defineConfig({});
  // One failing `seo` critical on one route: the ratio gives 100 − 1500/110 = 86.36, the cap gives 79.
  const results = [fail('seo/title-presence', '/a', 'critical')];

  it('caps a category when called without options, which computeHealth depends on', () => {
    expect(scoresByCategory(results, config).seo!.score).toBe(79);
    expect(scoresByCategory(results, config).seo!.scoreModel.criticalCap).toBe(79);
  });

  it('leaves the category uncapped when the cap is switched off', () => {
    const sr = scoresByCategory(results, config, { applyCriticalCap: false }).seo!;
    expect(sr.score).toBe(86);
    expect(sr.scoreModel.criticalCap).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `packages/core`: `../../node_modules/.bin/vitest run test/score.test.ts -t 'scoring options'`
Expected: FAIL — `scoresByCategory` accepts two arguments, so the third is a type error and the uncapped
expectation gets 79.

Only two tests: `options` is forwarded as one object, so proving `applyCriticalCap` reaches `computeScore`
proves `rules` does too. A third test for `rules` would assert the same forwarding twice.

- [ ] **Step 3: Add the parameter**

In `packages/core/src/scoring/score.ts`, change the signature and the one call inside:

```ts
/** Compute an independent score per category present in `results` (issue #10). */
export function scoresByCategory(
  results: Result[],
  config: Config,
  options: ScoreOptions = {}
): Partial<Record<Category, ScoreResult>> {
```

and the loop's final line from `computeScore(rs, config)` to `computeScore(rs, config, options)`.

Change nothing else. In particular do **not** change `computeHealth`, which calls
`scoresByCategory(results, config)` and must keep capping.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `../../node_modules/.bin/vitest run test/score.test.ts -t 'scoring options'`
Expected: PASS, 2 tests.

- [ ] **Step 5: Confirm no existing behaviour moved**

```bash
(cd packages/core && ../../node_modules/.bin/vitest run)
(cd packages/cli  && ../../node_modules/.bin/vitest run)
(cd packages/vite && ../../node_modules/.bin/vitest run)
```

Expected: all pass, unchanged counts. An optional trailing parameter defaulting to `{}` is behaviour-identical
because `computeScore` already defaults its own `options` to `{}` — so **any** failure here means the default
was got wrong, and that is a Health regression, not a test to adjust. Report it rather than editing an
expectation.

- [ ] **Step 6: Typecheck and lint**

```bash
(cd packages/core && ../../node_modules/.bin/tsc --noEmit)
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/scoring/score.ts packages/core/test/score.test.ts
git commit -m "feat(core): let scoresByCategory take scoring options"
```

---

## Task 2: The report field, its consumers, and the docs

**Files:**

- Modify: `packages/core/src/reporter/json.ts` (the `JsonReport` interface around line 39, and
  `buildJsonReport`'s `routes` assembly around line 82)
- Modify: `packages/core/test/html-report.test.ts` (4 literal route constructions),
  `packages/vite/test/app-shell-static.test.ts` and `packages/vite/test/ui-dashboard.test.ts` (4 more)
- Test: `packages/core/test/json-report.test.ts` (append)
- Modify: `docs/src/content/docs/guides/(reporting)/reporters.md` and
  `docs/src/content/docs/ja/guides/(reporting)/reporters.md`
- Create: `.changeset/route-category-scores.md`

**Interfaces:**

- Consumes: `scoresByCategory(results, config, options)` from Task 1.
- Produces: `JsonReport['routes']` becomes
  `Array<{ route: string; score: number; categories: Record<string, number>; issues: JsonIssue[] }>`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/json-report.test.ts`. That file has a module-level `config` and a module-level
`results` array used by the existing suites — do **not** reuse or extend `results`, since these cases need
specific inventories. Reuse `config`, and declare each case's own results inline as below.

```ts
describe('buildJsonReport — per-route category scores', () => {
  const config = defineConfig({});
  const meta = { version: '0.0.0' };

  it('scores each category present on the route', () => {
    // seo::route inventory 110, one warning failing -> 100 − 500/110 = 95.45 -> 95.
    // performance::route inventory 28, nothing failing -> 100.
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
        id: 'performance/preconnect',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'own', value: 'static' },
        route: '/a',
        message: 'ok'
      }
    ];
    const report = buildJsonReport(results, config, meta);
    expect(report.routes[0]!.categories).toEqual({ seo: 95, performance: 100 });
  });

  it('omits a category that produced no result on the route', () => {
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
    const report = buildJsonReport(results, config, meta);
    expect(Object.keys(report.routes[0]!.categories)).toEqual(['seo']);
    expect(report.routes[0]!.categories.architecture).toBeUndefined();
  });

  it('does not cap a category at 79 for a route carrying a critical', () => {
    // The ratio gives 100 − 1500/110 = 86. Asserting routes[].score instead would pass on a
    // capped implementation, because that path is already cap-free.
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        category: 'seo',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'x'
      }
    ];
    const report = buildJsonReport(results, config, meta);
    expect(report.routes[0]!.categories.seo).toBe(86);
  });

  it('keeps routes[].score as the union ratio, which need not equal the category mean', () => {
    // The union observes both pairs: inventory 138, failed 5 -> 100 − 500/138 = 96.
    // The categories are 95 and 100, whose mean is 97.5. Both numbers are asserted on one input
    // because their disagreement is the property the spec records.
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
        id: 'performance/preconnect',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'own', value: 'static' },
        route: '/a',
        message: 'ok'
      }
    ];
    const report = buildJsonReport(results, config, meta);
    expect(report.routes[0]!.score).toBe(96);
    expect(report.routes[0]!.categories).toEqual({ seo: 95, performance: 100 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `packages/core`: `../../node_modules/.bin/vitest run test/json-report.test.ts -t 'per-route category'`
Expected: FAIL — `categories` is `undefined` on every route entry.

- [ ] **Step 3: Add the field**

In `packages/core/src/reporter/json.ts`, change the interface line:

```ts
routes: Array<{ route: string; score: number; categories: Record<string, number>; issues: JsonIssue[] }>;
```

and the `routes` assembly in `buildJsonReport`:

```ts
    .map(({ route, results: rs }) => ({
      route,
      score: computeScore(rs, config, { applyCriticalCap: false }).score,
      // Per category, scored against that category's own inventory — so this does not average to `score`,
      // which is one ratio over the union of the pairs the route touched.
      categories: Object.fromEntries(
        Object.entries(scoresByCategory(rs, config, { applyCriticalCap: false })).map(([cat, sr]) => [cat, sr!.score])
      ),
      issues: rs
        .filter((r) => isPenalized(r.detection, config.treatDynamicAs))
        .map((r) => ({ ...issueOf(r), severity: effectiveSeverity(r, config) }))
    }));
```

Add `scoresByCategory` to the existing import from `../scoring/score.js`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `../../node_modules/.bin/vitest run test/json-report.test.ts -t 'per-route category'`
Expected: PASS, 4 tests.

- [ ] **Step 5: Fix the eight route constructions that stopped compiling**

`categories` is required, so every literal `JsonReport['routes']` element needs it. Rebuild core first, then
typecheck each package — a grep for the type name will not find these, because several are typed through
another type:

```bash
(cd packages/core && ../../node_modules/.bin/tsup)
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit); done
```

Expected: 4 errors in `packages/core/test/html-report.test.ts`, and 4 across
`packages/vite/test/app-shell-static.test.ts` and `packages/vite/test/ui-dashboard.test.ts`. The CLI and the
markdown reporter compile clean.

Add `categories: {}` to each — these fixtures exercise rendering, not scoring, and an empty map is the honest
value for a hand-built route with no scored results. Do not invent scores for them.

- [ ] **Step 6: Assert the field reaches the HTML snapshot**

Append to `packages/core/test/html-report.test.ts`. It already imports `formatHtmlReport` from `../src/index.js`
and builds a `JsonReport` literal named `report` with a `model()` helper for `ScoreModel` — that literal is one
of the four constructions you fixed in Step 5.

```ts
it('carries per-route category scores into the embedded snapshot', () => {
  // `sanitizeReport` spreads each route, so this passes today — it exists to fail if that spread is
  // ever replaced by an explicit field list.
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
  const html = formatHtmlReport(results, defineConfig({}), { version: '0.0.0' });
  expect(html).toContain('"categories":{"seo":95}');
});
```

If the embedded JSON is formatted differently — check by logging a slice of the output rather than guessing —
assert on the parsed snapshot instead of a substring, and say in your report which form you used.

- [ ] **Step 7: Run everything**

```bash
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/vitest run); done
(cd packages/core && ../../node_modules/.bin/tsup)
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit); done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: all green. (`packages/mcp` has no `tsconfig.json`; skip it.)

- [ ] **Step 8: Confirm the real report grows as the spec measured**

```bash
BIN="$(pwd)/packages/cli/dist/bin.js"
(cd packages/cli/test/fixtures/basic-project && node "$BIN" --reporter json > "$TMPDIR/after.json")
wc -c < "$TMPDIR/after.json"
```

Expected: **69,003 bytes**, up from 67,656 — 1,347 bytes over 22 routes. Report the actual figure. A
materially different number means the field's shape is not what the spec measured; say so rather than
adjusting the spec.

- [ ] **Step 9: Update both docs pages**

`docs/src/content/docs/guides/(reporting)/reporters.md` shows the `routes[]` sample around line 53. Add
`categories` to the sample beside `score`, with a comment, and add prose saying what it is.

**The prose must say the relationship is not guaranteed, in both directions.** A flat "it does not average to
`score`" is contradicted by any single-category route and by any clean one; a flat "it does" is contradicted by
any route whose categories differ by more than flooring absorbs. Keep it to one or two sentences. Do the same
in `docs/src/content/docs/ja/guides/(reporting)/reporters.md` — the Japanese must be idiomatic, not a
transliteration.

- [ ] **Step 10: Write the changeset**

Create `.changeset/route-category-scores.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Each entry in the JSON report's `routes` array now carries a `categories` map of category name to score.

A category's score is an average over its keys, so a category that looks wrong gives no clue which routes
produced it. The report listed each route's findings but not what each route scored per category, and since a
key's score became a ratio against the severity-weighted inventory of the checks it was measured against, that
number is no longer something a reader can reconstruct by hand.

Only the categories that produced a result on a route appear, so an absent category means "not measured here"
rather than "perfect here". A route's `categories` values are **not guaranteed** to average to its `score`:
`score` is one ratio over everything the route was measured against, while each category score uses that
category's own inventory. They agree whenever every category on the route scores the same ratio — including
every route with no findings — and can differ by several points otherwise.
```

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/reporter/json.ts packages/core/test packages/vite/test docs .changeset
git commit -m "feat(core): report each route's score per category"
```

---

## Notes for whoever runs this

- A full-workspace `pnpm` command fails in this sandbox for a known, pre-existing reason (the `docs` package's
  dependencies), and `pnpm --filter <pkg> build` fails on a reflink error. Use `../../node_modules/.bin/tsup`
  from inside the package.
- The spec records three things as deliberately out of scope, so do not implement them: rendering the field in
  the HTML report or the dev dashboard, making the aggregates re-derivable, and a per-route `scoreModel`.
- The spec's own history is worth one minute of your time before you start. Its claim about how often
  `routes[].score` equals the category mean was wrong three times in three different ways. If you find
  yourself about to write a test asserting that relationship in general, re-read that section first.
