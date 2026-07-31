# Score honesty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a displayed score of 100 mean that the deduction was exactly zero, so a category carrying
findings can never print a perfect score.

**Architecture:** `computeScore` floors its route average and its final score instead of rounding, and
additionally returns the **unrounded** final score. `computeHealth` averages those unrounded scores and
floors **once**, so the two rounding stages stop composing. Separately, `architecture/unit-entry-file`'s
pass drops its `route` — which is what created a score key — and keeps a `location`, so it stays evidence
that the rule ran without inflating the denominator.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, oxlint + oxfmt, Astro Starlight for docs.

**Spec:** `docs/superpowers/specs/2026-07-31-score-honesty-design.md` — read it before Task 1. It went
through four review rounds and several obvious-looking simplifications are recorded there as rejected.

## Global Constraints

- **The invariant this exists to establish:** a displayed 100 means the deduction was exactly zero. Every
  decision below serves it; if a change would let a score of 100 coexist with a finding, it is wrong.
- **`health` averages the unrounded category score, never the route average and never the displayed
  score.** Averaging route averages drops `sitePenalty` and `CRITICAL_CAP` out of Health entirely;
  averaging displayed scores composes two roundings and moves Health by two points.

  > **2026-07-31 follow-up:** the invariant above is bounded by positive effective weight, not mere
  > presence — a category weighted `0` is present but excluded from the average, and can hold a
  > `critical` finding without moving Health at all. See the paragraph following "A displayed 100 means
  > the deduction was exactly zero" in
  > `docs/superpowers/specs/2026-07-31-score-honesty-design.md`, and the
  > "shows 100 only when every positively weighted present category deducted nothing" test in
  > `packages/core/test/health.test.ts`.

- **Every score moves down by 0 or 1 point.** That bound holds only because Health floors once. Any
  expectation that shifts by more than 1 is a bug in this change, not a test to update.
- **`CRITICAL_CAP`'s value and effect are unchanged** — a capped category still displays 79 — but its
  **decision input changes** from the rounded mean to the raw one. Satisfying "a critical still caps at 79"
  while leaving the decision on the rounded value is the specific mistake to avoid.
- **`score === routeAverage - sitePenalty` holds only where neither the cap nor the clamp binds.** Do not
  assert it unconditionally.
- `packages/core/src/` must contain no `node:` imports, no I/O, and no runtime-specific globals.
- **Existing score expectations are re-baselined by this change, and that is correct here.** This is the
  one context in which editing an existing test expectation is the intended outcome. Each task updates the
  expectations it breaks, so the suite is green at every commit.
- **en/ja docs ship together.** Write real, idiomatic Japanese.
- **Never name other tools** (linters, plugins, competing products) in code, docs, or commit messages.
- A changeset is required: this changes the product's headline number.
- **Verify commands:** per-package `node_modules/.bin/{vitest,tsc,oxlint,oxfmt}`. A full-workspace `pnpm`
  command fails in this sandbox for a pre-existing reason unrelated to this work (the `docs` package has no
  installed dependencies, so the docs site cannot be built locally — CI's `docs` job is that gate).
- **Conventional commits, scoped by package:** `fix(core):`, `docs:`.

## File Structure

| File                                                                | Responsibility                                                                   | Task |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---- |
| `packages/core/src/scoring/score.ts`                                | floor `routeAverage`/`score`, expose `rawScore`, decide the cap on the raw value | 1    |
| `packages/core/test/score.test.ts`                                  | the invariant, the boundary, the cap's decision input                            | 1    |
| `packages/core/src/scoring/score.ts` (`computeHealth`)              | average `rawScore`, floor once                                                   | 2    |
| `packages/core/test/health.test.ts`                                 | the double-rounding regression, `sitePenalty`/cap reaching Health                | 2    |
| `packages/core/src/rules/architecture/unit-entry-file.ts`           | the pass loses `route`, gains `location`                                         | 3    |
| `packages/core/test/unit-entry-file.test.ts`                        | no score key, evidence retained, distinct `findingKey`s                          | 3    |
| `docs/src/content/docs/guides/(reporting)/health-report.md` + `ja/` | the score is floored, not rounded                                                | 4    |
| `.changeset/score-honesty.md`                                       | release note                                                                     | 4    |

---

### Task 1: `computeScore` floors, and exposes its unrounded score

**Files:**

- Modify: `packages/core/src/scoring/score.ts:15-18` (`ScoreResult`) and `:29-83` (`computeScore`)
- Test: `packages/core/test/score.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `ScoreResult` gains `rawScore: number` — the unrounded final score, after `sitePenalty` and
  the cap, clamped to `[0, 100]`. `score` becomes `Math.floor(rawScore)`. `scoreModel.routeAverage`
  becomes `Math.floor(rawRouteAverage)`. Task 2 reads `rawScore`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/score.test.ts`. That file imports `defineConfig` (not `defaultConfig`) and
already defines `pass`/`fail` helpers — so add `const CONFIG = defineConfig({});` beside the new block and
use it, rather than introducing a second config style. Add this results builder too:

```ts
/** `keys` route keys, the first `findings` of them carrying one `info` finding. */
const spread = (keys: number, findings: number): Result[] =>
  Array.from({ length: keys }, (_, i) => ({
    id: 'seo/title-presence',
    category: 'seo' as const,
    severity: 'info' as const,
    detection:
      i < findings
        ? { presence: 'none' as const, value: 'absent' as const }
        : { presence: 'own' as const, value: 'static' as const },
    route: `/k${i}`,
    message: 'm',
    recommendation: 'r'
  }));

describe('computeScore — a displayed 100 means zero deduction', () => {
  it('shows 99, not 100, for a single info finding among many passes', () => {
    // The reported bug: 276 findings over 585 keys rounded to a perfect 100.
    expect(computeScore(spread(585, 276), CONFIG).score).toBe(99);
    expect(computeScore(spread(585, 1), CONFIG).score).toBe(99);
  });

  it('shows 100 only when nothing was deducted', () => {
    expect(computeScore(spread(585, 0), CONFIG).score).toBe(100);
    expect(computeScore([], CONFIG).score).toBe(100);
  });

  it('floors a mean of exactly 99.5 down to 99', () => {
    // 200 keys, 100 of them with one info → mean 99.5. `Math.round` gave 100.
    expect(computeScore(spread(200, 100), CONFIG).score).toBe(99);
  });

  it('exposes the unrounded score alongside the floored one', () => {
    const r = computeScore(spread(585, 276), CONFIG);
    expect(r.score).toBe(99);
    expect(r.rawScore).toBeCloseTo(99.528, 3);
  });

  it('floors routeAverage too, keeping score = routeAverage - sitePenalty when neither cap nor clamp binds', () => {
    const results: Result[] = [
      ...spread(200, 100),
      {
        id: 'seo/robots-txt',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'no robots.txt',
        recommendation: 'r'
      }
    ];
    const r = computeScore(results, CONFIG);
    expect(r.scoreModel.routeAverage).toBe(99);
    expect(r.scoreModel.sitePenalty).toBe(5);
    expect(r.score).toBe(r.scoreModel.routeAverage - r.scoreModel.sitePenalty);
  });

  it('decides the cap on the raw value, not the floored one', () => {
    // One critical on one of 200 keys: raw mean 99.925, so raw - 0 > 79 and the cap binds.
    const withCritical: Result[] = spread(200, 0).map((r, i) =>
      i === 0
        ? { ...r, severity: 'critical' as const, detection: { presence: 'none' as const, value: 'absent' as const } }
        : r
    );
    const r = computeScore(withCritical, CONFIG);
    expect(r.score).toBe(79);
    expect(r.rawScore).toBe(79);
    expect(r.scoreModel.criticalCap).toBe(79);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: from `packages/core`, `node_modules/.bin/vitest run score`
Expected: FAIL. The first, third and fourth cases fail on the rounded value (100 where 99 is expected),
and `rawScore` does not exist so TypeScript rejects the fourth.

- [ ] **Step 3: Implement**

In `packages/core/src/scoring/score.ts`, extend the result type:

```ts
export interface ScoreResult {
  /** The score as displayed: `Math.floor(rawScore)`, so 100 means the deduction was exactly zero. */
  score: number;
  /**
   * The same score before flooring, after `sitePenalty` and the cap, clamped to `[0, 100]`. Exposed so
   * `computeHealth` can average unrounded values and floor once — averaging the displayed scores would
   * compose two roundings and move Health by up to two points.
   */
  rawScore: number;
  scoreModel: ScoreModel;
}
```

Then replace the tail of `computeScore` — from the `const scores = ...` line to its `return` — with:

```ts
const scores = [...routeScores.values()].map(clamp);
const rawRouteAverage = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 100;
const routeAverage = Math.floor(rawRouteAverage);

// One deduction per project rule id: take the max deduction among duplicates.
const projectRuleMax = new Map<string, number>();
for (const r of projectResults) {
  if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
  const sev = effectiveSeverity(r, config);
  if (sev === 'critical') anyCritical = true;
  const prev = projectRuleMax.get(r.id) ?? 0;
  if (DEDUCTION[sev] > prev) projectRuleMax.set(r.id, DEDUCTION[sev]);
}
let sitePenalty = 0;
for (const deduction of projectRuleMax.values()) sitePenalty += deduction;

// The cap is decided on the RAW value. Deciding it on the floored mean would let a capped category
// contribute nearly a point above the cap to Health — the displayed score cannot disagree either way,
// since that would need `rawRouteAverage - Math.floor(rawRouteAverage) > 1`.
const applyCap = options.applyCriticalCap ?? true;
const rawUncapped = rawRouteAverage - sitePenalty;
const capBinds = applyCap && anyCritical && rawUncapped > CRITICAL_CAP;
const criticalCap = capBinds ? CRITICAL_CAP : null;
const rawScore = clamp(capBinds ? CRITICAL_CAP : rawUncapped);

return { score: Math.floor(rawScore), rawScore, scoreModel: { routeAverage, sitePenalty, criticalCap } };
```

Keep the existing comments above the project-rule loop and the cap; the only substantive edits are the two
`Math.round` → `Math.floor` moves, computing the cap from `rawRouteAverage`, and returning `rawScore`.

- [ ] **Step 4: Run the new tests**

Run: from `packages/core`, `node_modules/.bin/vitest run score`
Expected: the new block PASSES. Pre-existing cases in the same file may now fail — that is Step 5.

- [ ] **Step 5: Re-baseline the pre-existing expectations in this file**

Run the file and inspect each failure. For every one, confirm the expectation moved **down by exactly 1**
(or not at all) and update the number. Any expectation that moves by more than 1, or moves **up**, is a bug
in Step 3 — stop and report instead of updating it.

Add a one-line comment at the top of the file recording why the numbers changed:

```ts
// Scores are floored, not rounded (2026-07-31): a displayed 100 means the deduction was exactly zero.
```

- [ ] **Step 6: Run the full core suite, typecheck, lint**

```bash
cd packages/core && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json
cd ../.. && node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: PASS. Failures outside `score.test.ts` are Task 2's and Task 3's to fix if they concern Health or
`unit-entry-file`; anything else means Step 3 changed more than intended — report it.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/scoring/score.ts packages/core/test/score.test.ts
git commit -m "fix(core): floor a category score instead of rounding it"
```

---

### Task 2: `computeHealth` averages the unrounded scores and floors once

**Files:**

- Modify: `packages/core/src/scoring/score.ts` (`computeHealth`, the `weighted +=` line and the final
  `Math.round`)
- Test: `packages/core/test/health.test.ts`

**Interfaces:**

- Consumes: `ScoreResult.rawScore` from Task 1.
- Produces: nothing later tasks read.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/health.test.ts`, matching its existing helpers and its existing config style
(declare `const CONFIG = defineConfig({});` if the file has no equivalent already). Add this builder:

```ts
/** `keys` route keys in `category`, the first `findings` of them carrying one `info` finding. */
const cat = (category: Category, keys: number, findings: number): Result[] =>
  Array.from({ length: keys }, (_, i) => ({
    id: `${category}/x`,
    category,
    severity: 'info' as const,
    detection:
      i < findings
        ? { presence: 'none' as const, value: 'absent' as const }
        : { presence: 'own' as const, value: 'static' as const },
    route: `${category}-k${i}`,
    message: 'm',
    recommendation: 'r'
  }));

describe('computeHealth — one rounding, at the boundary', () => {
  /** `keys` keys in `category`, the first `findings` of them carrying one finding of `severity`. */
  const at = (category: Category, keys: number, findings: number, severity: 'info' | 'warning'): Result[] =>
    cat(category, keys, 0).map((r, i) =>
      i < findings ? { ...r, severity, detection: { presence: 'none' as const, value: 'absent' as const } } : r
    );

  it('floors the mean of the unrounded category scores, not of the displayed ones', () => {
    // Raw category scores [99.9, 99.9, 99.9, 99.9, 97.9] → mean 99.5 → 99.
    // Averaging the floored scores [99, 99, 99, 99, 97] gives 98.6 → 98: a two-point move, which is
    // what this asserts against. 100 info findings over 1000 keys = 99.9; 420 warnings = 97.9.
    const results = [
      ...at('seo', 1000, 100, 'info'),
      ...at('performance', 1000, 100, 'info'),
      ...at('correctness', 1000, 100, 'info'),
      ...at('security', 1000, 100, 'info'),
      ...at('architecture', 1000, 420, 'warning')
    ];
    expect(computeHealth(results, CONFIG).health).toBe(99);
  });

  it('lets a site-wide finding reach Health even when every route key is clean', () => {
    // The invariant: Health 100 requires no finding of any kind, route-scoped or not.
    const results: Result[] = [
      ...cat('seo', 10, 0),
      {
        id: 'seo/robots-txt',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'no robots.txt',
        recommendation: 'r'
      }
    ];
    expect(computeHealth(results, CONFIG).health).toBe(95);
  });

  it('lets a capped category pull Health down', () => {
    const capped = cat('security', 200, 0).map((r, i) =>
      i === 0
        ? { ...r, severity: 'critical' as const, detection: { presence: 'none' as const, value: 'absent' as const } }
        : r
    );
    const { health, categories } = computeHealth([...cat('seo', 200, 0), ...capped], CONFIG);
    expect(categories.security!.score).toBe(79);
    expect(health).toBe(89); // floor((100 + 79) / 2)
  });

  it('shows 100 only when every present category deducted nothing', () => {
    expect(computeHealth([...cat('seo', 10, 0), ...cat('security', 10, 0)], CONFIG).health).toBe(100);
    expect(computeHealth([], CONFIG).health).toBe(100);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: from `packages/core`, `node_modules/.bin/vitest run health`
Expected: FAIL — the first case returns 98 (two-stage flooring) and the third returns 90 or similar,
because Health is averaging the displayed integers.

- [ ] **Step 3: Implement**

In `computeHealth`, change the accumulation and the final rounding:

```ts
weights[cat] = w;
weighted += categories[cat]!.rawScore * w;
total += w;
```

```ts
// Floor ONCE, on the unrounded category scores. Averaging the displayed integers would compose two
// roundings and move Health by up to two points, breaking this change's own one-point bound.
const health = Math.floor(weighted / total);
```

Leave the empty-categories and zero-weight guards exactly as they are.

- [ ] **Step 4: Run the tests**

Run: from `packages/core`, `node_modules/.bin/vitest run health`
Expected: PASS.

- [ ] **Step 5: Re-baseline the report-level expectations**

Run the whole core suite. Report tests (`json-report`, `console-report`, `agent-report`,
`markdown-report`, `html-report`) assert rendered score numbers and will shift. For each, confirm the move
is **down by 0 or 1** and update. A move of more than 1 point means Health is still composing two
roundings — stop and report.

Then the other packages:

```bash
cd packages/core && ../../node_modules/.bin/tsup
cd ../cli && ../../node_modules/.bin/vitest run
cd ../vite && ../../node_modules/.bin/vitest run
cd ../mcp && ../../node_modules/.bin/vitest run
```

Update any shifted expectation under the same 0-or-1 rule.

- [ ] **Step 6: Typecheck and lint**

```bash
for p in core cli vite mcp; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json) || echo "FAIL $p"; done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

- [ ] **Step 7: Commit**

```bash
git add packages/core packages/cli packages/vite packages/mcp
git commit -m "fix(core): average unrounded category scores when computing Health"
```

---

### Task 3: `unit-entry-file`'s pass stops creating a score key

**Files:**

- Modify: `packages/core/src/rules/architecture/unit-entry-file.ts:153-165` (the pass branch)
- Test: `packages/core/test/unit-entry-file.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks read.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/unit-entry-file.test.ts`, using the helpers already in that file for building
a `sourceFiles` context and a `units`/`pascalCaseUnits` config:

```ts
describe('architecture/unit-entry-file — a pass is evidence, not a score key', () => {
  it('emits a pass with no route, so a conforming unit adds nothing to the denominator', async () => {
    // A .ts unit entry is the case that exposed this: no other rule keys a plain .ts file, so the
    // pass was inventing a fresh 100 for every conforming unit.
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/api/api.ts'], { units: { 'src/lib/*': '.ts' } }));
    expect(rs).toHaveLength(1);
    expect(rs[0]!.detection).toEqual({ presence: 'own', value: 'static' });
    expect(rs[0]!.route).toBeUndefined();
    expect(rs[0]!.location).toBe('src/lib/api/api.ts');
  });

  it('does the same for a .svelte entry, so the fix is not narrowed to the reported symptom', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte'], { pascalCaseUnits: { 'src/lib/**': '.svelte' } })
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]!.route).toBeUndefined();
    expect(rs[0]!.location).toBe('src/lib/Card/Card.svelte');
  });

  it('gives each conforming unit a distinct location, so their finding keys do not collapse', async () => {
    // `findingKey` is `id::route::location`; with neither field, N units would share one key.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/api/api.ts', 'src/lib/db/db.ts'], { units: { 'src/lib/*': '.ts' } })
    );
    expect(rs.map((r) => r.location).sort()).toEqual(['src/lib/api/api.ts', 'src/lib/db/db.ts']);
  });

  it('leaves a conforming tree scoring identically to a run with the rule disabled', () => {
    const passes: Result[] = [
      {
        id: 'architecture/unit-entry-file',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'own', value: 'static' },
        location: 'src/lib/api/api.ts',
        message: 'Unit entry file',
        recommendation: 'r'
      }
    ];
    const other = [
      {
        id: 'architecture/component-size',
        category: 'architecture' as const,
        severity: 'info' as const,
        detection: { presence: 'none' as const, value: 'absent' as const },
        route: 'src/lib/A.svelte',
        message: 'm',
        recommendation: 'r'
      }
    ];
    expect(computeScore([...other, ...passes], CONFIG).score).toBe(computeScore(other, CONFIG).score);
  });
});
```

`ctx(sourceFiles, options?)`, `fails` and `passes` already exist in that file — use them rather than adding
a second set.

- [ ] **Step 2: Run the tests to verify they fail**

Run: from `packages/core`, `node_modules/.bin/vitest run unit-entry-file`
Expected: FAIL — `route` is the entry file and `location` is undefined, the reverse of what is asserted.

- [ ] **Step 3: Implement**

In the pass branch, swap `route` for `location`:

```ts
const expected = `${dir}/${baseName(dir)}${ext}`;
if (fileSet.has(expected)) {
  // No `route`: `computeScore` seeds its denominator only from results that carry one, and a plain
  // `.ts` entry is a key no other rule produces — so a pass here used to invent a fresh 100 per
  // conforming unit and dilute every real finding. `location` stays, because it keeps each pass a
  // distinct `findingKey` and keeps it visible to `--diff` filtering, and plays no part in scoring.
  out.push({
    id: ID,
    category: 'architecture',
    severity: 'info',
    detection: { presence: 'own', value: 'static' },
    location: expected,
    message: 'Unit entry file',
    recommendation,
    docsUrl
  });
  continue;
}
```

- [ ] **Step 4: Run the tests**

Run: from `packages/core`, `node_modules/.bin/vitest run unit-entry-file`
Expected: PASS. Update any pre-existing expectation in the file that asserted `route` on a pass — that is
the assertion this task deliberately changes.

- [ ] **Step 5: Full verification**

```bash
cd packages/core && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsup
cd ../cli && ../../node_modules/.bin/vitest run
cd ../vite && ../../node_modules/.bin/vitest run
cd ../.. && node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "fix(core): keep unit-entry-file's pass out of the score denominator"
```

---

### Task 4: Documentation and changeset

**Files:**

- Modify: `docs/src/content/docs/guides/(reporting)/health-report.md`
- Modify: `docs/src/content/docs/ja/guides/(reporting)/health-report.md`
- Create: `.changeset/score-honesty.md`

**Interfaces:**

- Consumes: the behaviour from Tasks 1-3.
- Produces: nothing.

- [ ] **Step 1: Correct the rounding statement in the English guide**

`docs/src/content/docs/guides/(reporting)/health-report.md` line 45 currently reads:

> The result is rounded to the nearest integer.

Replace it with:

```md
The result is **floored**, not rounded to nearest, so a displayed score of 100 means the deduction was
exactly zero. A category or project with any finding at all — even a single `info` — scores at most 99.

Health is floored **once**, from the unrounded category scores. It is therefore not always equal to the
average of the category scores you see printed, and can sit up to a point above them: each printed category
score is itself floored, and flooring twice would compound the loss.
```

Also check line 29 ("Health averages the category scores using per-category weights") and make it say the
**unrounded** category scores. Leave the worked example's numbers alone unless they contradict the new
wording — if they do, recompute them rather than deleting them.

- [ ] **Step 2: Mirror both edits in Japanese**

Apply the equivalent changes at the matching positions in
`docs/src/content/docs/ja/guides/(reporting)/health-report.md`. Write idiomatic Japanese, not a literal
rendering; keep code spans, option names and numbers in their original form. The two files must make the
same claims.

- [ ] **Step 3: Add the changeset**

Create `.changeset/score-honesty.md`:

```md
---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
'@svelte-vitals/mcp': patch
---

Scores are now floored rather than rounded to nearest, so a displayed 100 means the deduction was exactly
zero. Previously a category could print a perfect 100 while carrying hundreds of findings: with 585 score
keys it took 293 `info` findings to move the number off 100, and a finding on every single key still showed 99.

**Every score moves down by 0 or 1 point.** If you gate CI with `--min-health` at or just above your
current score, lower the threshold by one. `--min-health 100` now fails on any finding at all, which is the
honest reading of 100.

Health is also computed differently, though the change is invisible on most projects: it averages the
unrounded category scores and floors once, instead of averaging scores that had each already been rounded.
The old double rounding could move Health two points where the parts moved one.

`architecture/unit-entry-file` no longer adds a score key for each conforming unit. Its pass is still
reported — it is the only evidence the rule ran at all — but it no longer inflates the denominator that
every other finding is averaged against.
```

- [ ] **Step 4: Verify**

```bash
node_modules/.bin/oxfmt --write docs .changeset
node_modules/.bin/oxfmt --check .
(cd packages/cli && ../../node_modules/.bin/vitest run docs-links)
```

Expected: PASS. The docs site build cannot run in this sandbox; check the two `.md` files by eye for valid
frontmatter and balanced fences, and say in your report that the build was not run — CI's `docs` job is the
gate.

- [ ] **Step 5: Commit**

```bash
git add docs .changeset
git commit -m "docs: the score is floored, not rounded"
```

---

## Self-Review

**Spec coverage.** §1's flooring is Task 1 (route average, score, cap decision input) and Task 2 (Health,
averaging `rawScore`). §2's pass change is Task 3, including the `location`-not-dropped reasoning and the
`findingKey` collapse it prevents. The spec's Testing list maps as: 1 and 2 → Task 1 Step 1; 3 → Task 2
Step 1 (all three of its cases); 4 → Task 1's cap test and Task 2's capped-category test; 5 and 7 → Task 3
Step 1; 6 → Task 2's first test; 8 → the re-baselining steps in Tasks 1, 2 and 3, each bounded by the
0-or-1 rule. The four follow-ups are out of scope by the spec's own statement and appear in no task.

**Type consistency.** `rawScore` is the name in `ScoreResult` (Task 1), in `computeHealth`'s accumulation
(Task 2), and in Task 1's assertions. `scoreModel`'s three fields keep their names and stay integers.
`Result.location` is an existing optional field, so Task 3 adds no type.

**The one number that must not be "fixed" into passing.** Task 2's first test expects **99**. A naive
two-stage flooring returns 98, and 98 is a plausible-looking answer — an implementer who reaches it may
conclude the expectation is wrong rather than the implementation. The test carries the arithmetic in a
comment for exactly that reason.

**Test file names verified against the repo:** `packages/core/test/score.test.ts` (helpers `pass`/`fail`),
`health.test.ts`, and `unit-entry-file.test.ts` (helpers `fails`/`passes`/`ctx`, plus a `PASCAL` config
constant). Task 3's snippets say `ctxWith`; the file's builder is named **`ctx(sourceFiles, options?)`** —
use that. There is also a separate `unit-entry-file-example.test.ts`; leave it alone unless it fails, in
which case its expectations re-baseline under the same 0-or-1 rule.
