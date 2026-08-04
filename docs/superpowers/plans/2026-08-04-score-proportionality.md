# Score proportionality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a category score move with how much is wrong, by scoring each key as the share of what it was
measured against that is intact, instead of subtracting fixed points from 100.

**Architecture:** `computeScore` gains a rule inventory — the severity-weighted count of selected rules,
grouped by `(category, scope)` — which it derives itself from `selectRules(allRules, config)`, so no call
site changes. A key's score becomes `100 − (100 × failedWeight) / inventoryWeight` over the pairs observed on
that key, and the route mean moves into deficit space. `sitePenalty`, the critical cap, the flooring and
`computeHealth` are untouched.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, oxlint + oxfmt, Astro Starlight docs.

**Spec:** `docs/superpowers/specs/2026-08-04-score-proportionality-design.md`. Read it before Task 1. Every
number in this plan traces to it, and three of its decisions survived an adversarial review that rejected two
earlier drafts on arithmetic grounds — do not "simplify" the formula.

## Global Constraints

- **`packages/core/src/` is runtime-agnostic**: no `node:` imports, no I/O, no runtime-specific globals
  (`packages/core/src/index.ts` states this verbatim). This change adds only pure computation.
- **The evaluation order is mandatory**: `100 − (100 × f) / i`, never `100 × (1 − f / i)`. The second form
  yields `19.999999999999996` for `f = 88, i = 110` and displays 19 for a true 20.
- **The route mean is computed in deficit space**: `100 − (Σ keyDeficit) / N`, never as a mean of key scores.
  The second form yields `49.99999999999999` for the two-key fixture below and displays 49 for a true 50.
- **`inventoryWeight` is `max(observedInventory, failedWeight)`**, with `inventoryWeight === 0 → keyScore 100`.
  Without both, a result whose rule is not in the inventory divides by zero and `clamp(NaN)` is `NaN`.
- **The inventory is grouped by `(category, scope)` pair**, not by scope alone. Three call sites pass
  multi-category result sets.
- **`DEDUCTION` values, `CRITICAL_CAP`, `Math.floor`, `computeHealth`, `sitePenalty` and the "present
  categories only" semantics do not change.**
- **Comments earn their place only when they say something the code cannot** (`AGENTS.md`): a constraint, a
  rejected alternative, a non-local dependency. Prefer one line over three.
- **Never name another tool, linter, plugin or product** in any doc, comment, changeset or commit message.
- **Conventional commits**, scoped by package. **A changeset is required** — `feat` is `minor`, listing
  `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`.
- **en/ja docs ship together.**

## File Structure

| File                                                                                                                                                                   | Responsibility                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/scoring/inventory.ts`                                                                                                                               | **new** — build the `(category, scope)` → weight map from a rule list and a config. One exported function, no dependency on `Result`. |
| `packages/core/src/scoring/score.ts`                                                                                                                                   | modify `computeScore`: use the inventory, the ratio, the deficit-space mean. `computeHealth` and `scoresByCategory` untouched.        |
| `packages/core/test/inventory.test.ts`                                                                                                                                 | **new** — the inventory in isolation.                                                                                                 |
| `packages/core/test/score.test.ts`                                                                                                                                     | modify — existing expected values change; new cases for the ratio, the pair, the arithmetic.                                          |
| `packages/core/test/health.test.ts`                                                                                                                                    | modify — expected values change; Health's own logic does not.                                                                         |
| `packages/core/test/json-report.test.ts`, `packages/core/test/unit-entry-file.test.ts`, `packages/vite/test/analyze.test.ts`, `packages/cli/test/resolve-args.test.ts` | modify — assertions on score values only.                                                                                             |
| `docs/src/content/docs/guides/(reporting)/reporters.md` + ja                                                                                                           | modify — `routes[].score`'s meaning.                                                                                                  |
| `.changeset/score-proportionality.md`                                                                                                                                  | **new**                                                                                                                               |

Splitting the inventory into its own file is deliberate: it is the piece with no `Result` dependency, it is
the piece a reviewer can check against the rule registry on its own, and keeping it out of `score.ts` stops
that file from growing a second concern.

---

## Task 1: The rule inventory

**Files:**

- Create: `packages/core/src/scoring/inventory.ts`
- Test: `packages/core/test/inventory.test.ts`

**Interfaces:**

- Consumes: `Rule` (`packages/core/src/rule.ts`), `Config`, `Category`, `Scope`, `Severity`
  (`packages/core/src/types.ts`), `selectRules` and `settingSeverity` (`packages/core/src/config-apply.ts`),
  `allRules` (`packages/core/src/rules/index.ts`).
- Produces:

  ```ts
  export type PairKey = `${Category}::${Scope}`;
  export function pairKey(category: Category, scope: Scope): PairKey;
  export function buildInventory(config: Config, rules?: readonly Rule[]): Map<PairKey, number>;
  export function ruleScopes(rules: readonly Rule[]): Map<string, PairKey>;
  ```

  `buildInventory` defaults `rules` to `selectRules(allRules, config)`. `ruleScopes` maps a rule id to its
  pair so `score.ts` can find which pair a result belongs to; it takes the same list `buildInventory` used.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/inventory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildInventory, pairKey, ruleScopes } from '../src/scoring/inventory.js';
import { defineConfig } from '../src/types.js';
import { allRules } from '../src/rules/index.js';
import type { Rule } from '../src/rule.js';

const rule = (id: string, category: Rule['category'], scope: Rule['scope'], severity: Rule['severity']) =>
  ({ id, category, scope, severity, title: id, rationale: '', check: async () => [] }) as unknown as Rule;

describe('buildInventory', () => {
  it('sums DEDUCTION per (category, scope) pair', () => {
    const rules = [
      rule('a/one', 'architecture', 'component', 'info'),
      rule('a/two', 'architecture', 'component', 'warning'),
      rule('p/one', 'performance', 'route', 'critical')
    ];
    const inv = buildInventory(defineConfig({}), rules);
    expect(inv.get(pairKey('architecture', 'component'))).toBe(6);
    expect(inv.get(pairKey('performance', 'route'))).toBe(15);
    expect(inv.get(pairKey('performance', 'component'))).toBeUndefined();
  });

  it('drops a rule turned off and counts a rule whose severity is overridden', () => {
    const rules = [
      rule('a/one', 'architecture', 'component', 'info'),
      rule('a/two', 'architecture', 'component', 'info')
    ];
    const config = defineConfig({ rules: { 'a/one': 'off', 'a/two': 'critical' } });
    const inv = buildInventory(config, rules);
    expect(inv.get(pairKey('architecture', 'component'))).toBe(15);
  });

  it('defaults to the selected registry', () => {
    // Eight architecture rules, all info, is what makes the old model bottom out at 92.
    const inv = buildInventory(defineConfig({}));
    const architecture = allRules.filter((r) => r.category === 'architecture');
    expect(inv.get(pairKey('architecture', 'component'))).toBe(architecture.length);
  });

  it('maps a rule id to its pair', () => {
    const rules = [rule('a/one', 'architecture', 'component', 'info')];
    expect(ruleScopes(rules).get('a/one')).toBe(pairKey('architecture', 'component'));
    expect(ruleScopes(rules).get('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `packages/core`: `../../node_modules/.bin/vitest run test/inventory.test.ts`
Expected: FAIL — cannot resolve `../src/scoring/inventory.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/scoring/inventory.ts`:

```ts
import type { Category, Config, Scope, Severity } from '../types.js';
import type { Rule } from '../rule.js';
import { selectRules, settingSeverity } from '../config-apply.js';
import { allRules } from '../rules/index.js';

const DEDUCTION: Record<Severity, number> = { critical: 15, warning: 5, info: 1 };

export type PairKey = `${Category}::${Scope}`;

export function pairKey(category: Category, scope: Scope): PairKey {
  return `${category}::${scope}`;
}

/** A rule's severity as configured, matching how `selectRules` reads `config.rules`. */
function severityOf(rule: Rule, config: Config): Severity {
  const setting = settingSeverity(config.rules[rule.id]);
  return setting !== undefined && setting !== 'off' ? setting : rule.severity;
}

/**
 * Total severity weight per `(category, scope)` pair — the denominator a key of that pair is measured
 * against. Defaults to the selected registry so `computeScore` needs no new argument; the parameter exists
 * for tests and for scoring against a rule set that is not the registry.
 */
export function buildInventory(
  config: Config,
  rules: readonly Rule[] = selectRules(allRules, config)
): Map<PairKey, number> {
  const out = new Map<PairKey, number>();
  for (const rule of rules) {
    const key = pairKey(rule.category, rule.scope);
    out.set(key, (out.get(key) ?? 0) + DEDUCTION[severityOf(rule, config)]);
  }
  return out;
}

/** Rule id to its pair, so a result can be attributed to the inventory entry it was measured against. */
export function ruleScopes(rules: readonly Rule[]): Map<string, PairKey> {
  return new Map(rules.map((r) => [r.id, pairKey(r.category, r.scope)]));
}
```

> **Superseded (2026-08-04):** this `severityOf` restores an `off` rule's own severity, which contradicts the
> "drops a rule turned off" test above (that test's inventory of 15 requires the `off` rule contribute
> nothing, not its own 1). The shipped `severityOf` returns `undefined` for an `off` rule instead, and
> `buildInventory` skips it — see `packages/core/src/scoring/inventory.ts` and its test.

- [ ] **Step 4: Run the test to verify it passes**

Run: `../../node_modules/.bin/vitest run test/inventory.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Confirm the registry default is what the spec measured**

Run from `packages/core`:

```bash
../../node_modules/.bin/vitest run test/inventory.test.ts -t 'defaults to the selected registry'
```

Expected: PASS. If the architecture count is not 8, the registry has changed since the spec was written —
**stop and report it** rather than adjusting the number, because the spec's motivating table depends on it.

- [ ] **Step 6: Typecheck and lint**

Run from `packages/core`: `../../node_modules/.bin/tsc --noEmit`
Run from the repo root: `node_modules/.bin/oxlint .` and `node_modules/.bin/oxfmt --check .`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/scoring/inventory.ts packages/core/test/inventory.test.ts
git commit -m "feat(core): add the per-(category, scope) rule inventory"
```

---

## Task 2: The ratio model in `computeScore`

**Files:**

- Modify: `packages/core/src/scoring/score.ts` (the body of `computeScore`, lines 36–95)
- Test: `packages/core/test/score.test.ts` (append; existing cases are re-baselined in Task 3)

**Interfaces:**

- Consumes: `buildInventory`, `ruleScopes`, `pairKey`, `PairKey` from Task 1.
- Produces: `ScoreOptions` gains `rules?: readonly Rule[]`. `ScoreResult` and `ScoreModel` keep their current
  fields and meanings — `score`, `rawScore`, `scoreModel.routeAverage`, `scoreModel.sitePenalty`,
  `scoreModel.criticalCap`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/score.test.ts`. The helpers `pass` and `fail` already exist at the top of that
file; do not redefine them.

```ts
import type { Rule } from '../src/rule.js';

const r = (id: string, category: Rule['category'], scope: Rule['scope'], severity: Rule['severity']) =>
  ({ id, category, scope, severity, title: id, rationale: '', check: async () => [] }) as unknown as Rule;

// Nine weight in one pair — the shape that makes the arithmetic below checkable by hand.
const PERF = [
  r('p/i1', 'performance', 'component', 'info'),
  r('p/i2', 'performance', 'component', 'info'),
  r('p/i3', 'performance', 'component', 'info'),
  r('p/i4', 'performance', 'component', 'info'),
  r('p/w1', 'performance', 'component', 'warning')
];

describe('computeScore — proportional model', () => {
  const config = defineConfig({});

  it('scores a key as the share of its pair that is intact', () => {
    // failedWeight 5 of inventory 9 -> 100 - 500/9 = 44.44…, floored once at the category.
    const results = [fail('p/w1', 'src/A.svelte', 'warning')];
    const { score } = computeScore(results, config, { rules: PERF });
    expect(score).toBe(44);
  });

  it('lets a key reach 0 when everything in its pair fails', () => {
    const results = PERF.map((rule) => fail(rule.id, 'src/A.svelte', rule.severity as 'warning' | 'info'));
    expect(computeScore(results, config, { rules: PERF, applyCriticalCap: false }).score).toBe(0);
  });

  it('distinguishes one affected key from many', () => {
    // The reported symptom: under the old model both displayed 99.
    const keys = Array.from({ length: 585 }, (_, i) => `src/${i}.svelte`);
    const one = keys.map((k, i) => (i === 0 ? fail('p/i1', k, 'info') : pass('p/i1', k)));
    const many = keys.map((k, i) => (i < 276 ? fail('p/i1', k, 'info') : pass('p/i1', k)));
    const a = computeScore(one, config, { rules: PERF }).score;
    const b = computeScore(many, config, { rules: PERF }).score;
    expect(a).toBe(99);
    expect(b).toBeLessThan(a);
  });

  it('sums the inventory over every pair observed on a key', () => {
    // One seo route warning beside a passing performance route rule: 100 - 500/(5+5) = 50,
    // where the seo pair alone would give 100 - 500/5 = 0.
    const rules = [r('seo/x', 'seo', 'route', 'warning'), r('perf/y', 'performance', 'route', 'warning')];
    const results = [fail('seo/x', '/a', 'warning'), pass('perf/y', '/a')];
    expect(computeScore(results, defineConfig({}), { rules }).score).toBe(50);
  });

  it('keeps an integral score integral', () => {
    // 100 - (100*88)/110 is exactly 20; 100 * (1 - 88/110) is 19.999999999999996.
    const rules = [
      r('s/c1', 'seo', 'route', 'critical'),
      r('s/c2', 'seo', 'route', 'critical'),
      ...Array.from({ length: 14 }, (_, i) => r(`s/w${i}`, 'seo', 'route', 'warning')),
      ...Array.from({ length: 10 }, (_, i) => r(`s/i${i}`, 'seo', 'route', 'info'))
    ];
    // 2 criticals (30) + 11 warnings (55) + 3 infos (3) = 88, against an inventory of 110.
    const results = [
      fail('s/c1', '/a', 'critical'),
      fail('s/c2', '/a', 'critical'),
      ...Array.from({ length: 11 }, (_, i) => fail(`s/w${i}`, '/a', 'warning')),
      ...Array.from({ length: 3 }, (_, i) => fail(`s/i${i}`, '/a', 'info'))
    ];
    expect(computeScore(results, defineConfig({}), { rules, applyCriticalCap: false }).score).toBe(20);
  });

  it('keeps an integral mean integral across keys', () => {
    // Two keys, deficits 300/9 and 600/9, true mean exactly 50. A mean of key scores gives
    // 49.99999999999999 and displays 49.
    const results = [
      fail('p/i1', 'src/A.svelte', 'info'),
      fail('p/i2', 'src/A.svelte', 'info'),
      fail('p/i3', 'src/A.svelte', 'info'),
      fail('p/w1', 'src/B.svelte', 'warning'),
      fail('p/i1', 'src/B.svelte', 'info')
    ];
    expect(computeScore(results, config, { rules: PERF }).score).toBe(50);
  });

  it('scores 0, not NaN, for a penalized result whose rule is not in the inventory', () => {
    const results = [fail('ghost/rule', 'src/A.svelte', 'warning')];
    const { score } = computeScore(results, config, { rules: PERF, applyCriticalCap: false });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBe(0);
  });

  it('scores 100 for a key whose only results come from rules outside the inventory', () => {
    const results = [pass('ghost/rule', 'src/A.svelte')];
    expect(computeScore(results, config, { rules: PERF }).score).toBe(100);
  });

  it('narrowing the rule set to one category leaves that category unchanged', () => {
    const mixed = [...PERF, r('seo/x', 'seo', 'route', 'warning')];
    const results = [fail('p/w1', 'src/A.svelte', 'warning'), pass('p/i1', 'src/A.svelte')];
    expect(computeScore(results, config, { rules: mixed }).score).toBe(
      computeScore(results, config, { rules: PERF }).score
    );
  });

  it('keeps a category with two scopes from merging them', () => {
    // A component key must not be measured against route-scoped rules it can never trigger.
    // Merged, the inventory would be 5 + 45 and the key would score 90 instead of 0.
    const rules = [
      r('p/comp', 'performance', 'component', 'warning'),
      ...Array.from({ length: 9 }, (_, i) => r(`p/route${i}`, 'performance', 'route', 'warning'))
    ];
    const results = [fail('p/comp', 'src/A.svelte', 'warning')];
    expect(computeScore(results, config, { rules, applyCriticalCap: false }).score).toBe(0);
  });

  it('scores 100 when nothing is penalized', () => {
    const results = [pass('p/i1', 'src/A.svelte'), pass('p/w1', 'src/B.svelte')];
    expect(computeScore(results, config, { rules: PERF }).score).toBe(100);
  });

  it('orders severities within one pair', () => {
    const one = (id: string, sev: 'critical' | 'warning' | 'info') =>
      computeScore([fail(id, 'src/A.svelte', sev)], config, {
        rules: [
          r('x/c', 'security', 'component', 'critical'),
          r('x/w', 'security', 'component', 'warning'),
          r('x/i', 'security', 'component', 'info')
        ],
        applyCriticalCap: false
      }).score;
    expect(one('x/c', 'critical')).toBeLessThan(one('x/w', 'warning'));
    expect(one('x/w', 'warning')).toBeLessThan(one('x/i', 'info'));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `packages/core`: `../../node_modules/.bin/vitest run test/score.test.ts -t 'proportional model'`
Expected: FAIL — `rules` is not a valid `ScoreOptions` property (a type error), and the values are the old
model's.

- [ ] **Step 3: Replace the scoring body**

In `packages/core/src/scoring/score.ts`, add the imports:

```ts
import type { Rule } from '../rule.js';
import { selectRules } from '../config-apply.js';
import { allRules } from '../rules/index.js';
import { buildInventory, ruleScopes, type PairKey } from './inventory.js';
```

`buildInventory` defaults its rule list the same way, but `ruleScopes` needs the identical list, so
`computeScore` resolves it once and passes it to both rather than letting the two disagree.

Extend `ScoreOptions`:

```ts
export interface ScoreOptions {
  applyCriticalCap?: boolean;
  /** The rules that ran. Defaults to the selected registry; supplied by tests and custom rule sets. */
  rules?: readonly Rule[];
}
```

Replace the body of `computeScore` from `const routeResults = …` down to and including the loop that writes
`routeScores`, with:

```ts
const routeResults = results.filter((r) => r.route !== undefined);
const projectResults = results.filter((r) => r.route === undefined);

const rules = options.rules ?? selectRules(allRules, config);
const inventory = buildInventory(config, rules);
const pairOf = ruleScopes(rules);

let anyCritical = false;

// Per key: the pairs it was measured against, and the weight that failed. One deduction per
// (key, rule id) — the max among duplicates — exactly as before; only the divisor is new.
const observed = new Map<string, Set<PairKey>>();
const ruleMax = new Map<string, Map<string, number>>();
for (const r of routeResults) {
  const key = r.route as string;
  if (!observed.has(key)) observed.set(key, new Set());
  const pair = pairOf.get(r.id);
  if (pair !== undefined) observed.get(key)!.add(pair);
  if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
  const sev = effectiveSeverity(r, config);
  if (sev === 'critical') anyCritical = true;
  let perRule = ruleMax.get(key);
  if (!perRule) ruleMax.set(key, (perRule = new Map()));
  const prev = perRule.get(r.id) ?? 0;
  if (DEDUCTION[sev] > prev) perRule.set(r.id, DEDUCTION[sev]);
}

// Deficit space, as `computeHealth` already works: a mean of key scores computes
// 49.99999999999999 for a true 50 on two keys of deficit 300/9 and 600/9.
let totalDeficit = 0;
for (const [key, pairs] of observed) {
  let failed = 0;
  for (const d of ruleMax.get(key)?.values() ?? []) failed += d;
  let inventoryWeight = 0;
  for (const p of pairs) inventoryWeight += inventory.get(p) ?? 0;
  // `max` covers the two cases where a result outweighs its own inventory: `treatDynamicAs: 'warn'`
  // promotes a result's severity without changing its rule's, and a rule absent from the inventory
  // observes no pair. Both would otherwise divide by zero, and `clamp(NaN)` is `NaN`.
  inventoryWeight = Math.max(inventoryWeight, failed);
  // `100 - (100 * f) / i`, never `100 * (1 - f / i)`: the latter gives 19.999999999999996 for
  // f = 88, i = 110 and displays 19 for a true 20.
  totalDeficit += inventoryWeight === 0 ? 0 : (100 * failed) / inventoryWeight;
}

const keyCount = observed.size;
const rawRouteAverage = keyCount === 0 ? 100 : 100 - totalDeficit / keyCount;
const routeAverage = Math.floor(rawRouteAverage);
```

Delete the now-dead `routeScores` map, the `scores` array, the old `rawRouteAverage` line and its comment
block, and the `for (const [route, perRule] of routeRuleMax)` loop. Leave everything from
`// One deduction per project rule id` onward exactly as it is.

- [ ] **Step 4: Rewrite the stale comment**

The comment above the old `routeAverage` claims no epsilon is needed because "every route score is an
integer". Key scores are no longer integers. Replace it with the two-line comment already shown in Step 3
above `totalDeficit`; do not leave the old text anywhere in the file. A false premise in a comment about
floating point is how this file's previous arithmetic bugs survived review.

- [ ] **Step 5: Run the new tests**

Run from `packages/core`: `../../node_modules/.bin/vitest run test/score.test.ts -t 'proportional model'`
Expected: PASS, 12 tests. Older cases in the same file will now fail — that is expected and is Task 3's work.

- [ ] **Step 6: Prove each guard is load-bearing**

Run each mutation, confirm the named test fails, then restore and confirm green. Report every result.

| mutation                                    | must fail                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `100 * (1 - failed / inventoryWeight)`      | `keeps an integral score integral`                                              |
| mean of key scores instead of deficit space | `keeps an integral mean integral across keys`                                   |
| drop the `Math.max`                         | `scores 0, not NaN, …`                                                          |
| drop the `inventoryWeight === 0` guard      | `scores 100 for a key whose only results come from rules outside the inventory` |
| sum by `scope` alone, ignoring `category`   | `sums the inventory over every pair observed on a key`                          |
| sum by `category` alone, ignoring `scope`   | `keeps a category with two scopes from merging them`                            |

If a mutation leaves the suite green, the test is wrong, not the implementation.

- [ ] **Step 7: Typecheck**

Run from `packages/core`: `../../node_modules/.bin/tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/scoring/score.ts packages/core/test/score.test.ts
git commit -m "feat(core): score a key by the share of its checks that pass"
```

---

## Task 3: Re-baseline every test that asserts a score

**Files:**

- Modify: `packages/core/test/score.test.ts`, `packages/core/test/health.test.ts`,
  `packages/core/test/json-report.test.ts`, `packages/core/test/unit-entry-file.test.ts`,
  `packages/vite/test/analyze.test.ts`, `packages/cli/test/resolve-args.test.ts`

**Interfaces:**

- Consumes: `computeScore` as changed in Task 2. Nothing new is produced.

- [ ] **Step 1: See the full damage**

Run each package's suite and collect every failure:

```bash
(cd packages/core && ../../node_modules/.bin/vitest run)
(cd packages/cli  && ../../node_modules/.bin/vitest run)
(cd packages/vite && ../../node_modules/.bin/vitest run)
```

Expected: failures confined to assertions on score, health, or `routes[].score` values. **A failure anywhere
else is a real regression — stop and report it** rather than editing the expectation.

- [ ] **Step 2: Update each expectation from the formula, not from the old value**

For each failing assertion, recompute the expected number by hand:
`keyScore = 100 − (100 × failedWeight) / inventoryWeight`, then
`categoryScore = Math.floor(100 − (Σ keyDeficit) / N − sitePenalty)`.

The inventories these tests hit come from the real registry, so use `buildInventory(config)` in a scratch
check rather than guessing. **Do not paste the value the test runner reports** — that makes the test agree
with whatever was implemented instead of with the design.

Where a test asserts a specific number only to prove that "something was deducted", replace it with the
relational assertion it actually means (`toBeLessThan(100)`), and leave a one-line comment saying which
property it holds. Where a test pins an exact worked example from a spec, keep it exact.

- [ ] **Step 3: Keep the §12 worked example honest**

`packages/core/test/score.test.ts` opens with a case named after design §12 that asserts the cap and the site
penalty together. Its route arithmetic changes; the cap at 79 and the site penalty in absolute points do not.
Update the route numbers, and add an assertion that `scoreModel.sitePenalty` is still the sum of absolute
deductions — that is the field the spec deliberately left alone, and nothing else in the suite pins it.

- [ ] **Step 4: Run all three suites**

```bash
(cd packages/core && ../../node_modules/.bin/vitest run)
(cd packages/cli  && ../../node_modules/.bin/vitest run)
(cd packages/vite && ../../node_modules/.bin/vitest run)
```

Expected: all pass.

- [ ] **Step 5: Rebuild core and typecheck every package**

```bash
(cd packages/core && ../../node_modules/.bin/tsup)
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit); done
```

Expected: clean. (`packages/mcp` has no `tsconfig.json`; skip it.) This per-package check is not ceremony —
on an earlier branch a cross-package break hid in a fixture that never named the changed type.

- [ ] **Step 6: Commit**

```bash
git add packages/core/test packages/cli/test packages/vite/test
git commit -m "test: re-baseline score expectations against the proportional model"
```

---

## Task 4: Documentation and changeset

**Files:**

- Modify: `docs/src/content/docs/guides/(reporting)/reporters.md` and
  `docs/src/content/docs/ja/guides/(reporting)/reporters.md`
- Create: `.changeset/score-proportionality.md`

**Interfaces:**

- Consumes: the shipped behaviour from Tasks 1–3. Nothing is produced.

- [ ] **Step 1: Find what the docs say about scores**

```bash
grep -rn "score" "docs/src/content/docs/guides/(reporting)/reporters.md"
grep -rn "score" docs/src/content/docs/ja/guides/\(reporting\)/reporters.md
```

`routes[].score` is documented in both. Read the surrounding prose before editing — the page describes the
JSON report's shape, and only the description of what the number means changes.

- [ ] **Step 2: Update both pages**

State that a route's `score` is the share of the checks that ran on that route, weighted by severity, that
passed — not 100 minus a fixed deduction per finding. Keep it to the same length as the sentence it replaces.
Do not add a migration note to the docs; that belongs in the changeset. Do not name any other tool.

- [ ] **Step 3: Check the rest of the docs for a stale claim**

```bash
grep -rn "100 minus\|deduct\|15 points\|5 points\|1 point" docs/src/content/docs --include="*.md*"
```

Any prose describing the old subtraction is now wrong. Update what you find, in both languages. If nothing
matches, say so in the report rather than silently skipping the step.

- [ ] **Step 4: Write the changeset**

Create `.changeset/score-proportionality.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Category scores now reflect **how much** is wrong, not merely whether anything is.

A key — a route or a source file — used to start at 100 and lose a fixed number of points per failing rule.
That capped what a category could express: `architecture` is eight `info` rules, so no amount of bad code
moved it below 92, and three more scopes bottomed out above 90. It also erased magnitude, because one
finding moves a mean of N keys by `1/N`: on a large project, one finding and several hundred displayed the
same score.

A key now scores the share of what it was measured against that is intact, weighted by severity. Every
category can reach 0, and the score moves with the number of findings.

**Every score changes, most of them downward, and by more than a point.** `seo` and `correctness` stay
within a point of their old values; `architecture`, `security` and `performance` move further, because their
scales were the most compressed. A `--min-health` gate calibrated against the old numbers will start
failing — recalibrate it against the new scale. `routes[].score` in the JSON report changes meaning the same
way. Stored baselines are unaffected, since they key on findings rather than scores.

Unchanged: the site-wide penalty stays in absolute points, a `critical` still caps a category at 79, and a
displayed 100 still means no finding among the checks that ran.
```

- [ ] **Step 5: Verify the docs build inputs**

```bash
node_modules/.bin/oxfmt --check .
(cd packages/cli && ../../node_modules/.bin/vitest run test/docs-links.test.ts test/rules-index.test.mjs test/docs-embed.test.mjs)
```

Expected: clean and passing. If `oxfmt` reports a diff, run `node_modules/.bin/oxfmt --write .` and re-check.

- [ ] **Step 6: Full verification**

```bash
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/vitest run); done
(cd packages/core && ../../node_modules/.bin/tsup)
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit); done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add docs .changeset
git commit -m "docs: describe the proportional score model"
```

---

## Notes for whoever runs this

- A full-workspace `pnpm` command fails in this sandbox for a known, pre-existing reason (the `docs`
  package's dependencies). Use `--filter` or the per-package binaries shown above. Do not try to fix it.
- The spec records two things as deliberately **not** solved, so do not implement them here:
  `routes[].categories[].score` in the JSON report, and severity recalibration of thin scopes.
- The spec accepts one tolerance: a multi-key mean whose true value is an integer may display one point low
  (four `performance` component keys failing `{info}`, `{warning}`, `{all five}`, `{three infos}` display 49
  for a true 50). This is bounded at one point and is not a bug to fix.
