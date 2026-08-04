# Score proportionality: a category score must move with how much is wrong — design

**Date:** 2026-08-04
**Status:** approved
**Origin:** the first follow-up recorded by `2026-07-31-score-honesty-design.md`, which raised its own
priority: "Trading '100 is a lie' for '99 says nothing' is the right trade only if the second half gets
fixed."

## The problem

Two symptoms, measured rather than supposed. They share one cause.

**A category cannot reach most of its own scale.** A key loses `DEDUCTION[severity]` per failing rule, and
is only ever touched by rules of its own scope — component rules key on a file, route rules on a route — so
the lowest score it can reach is fixed by that scope's rule inventory:

| category / scope         | rules                       | max deduction on one key | lowest reachable |
| ------------------------ | --------------------------- | ------------------------ | ---------------- |
| architecture / component | 8 info                      | 8                        | **92**           |
| seo / component          | 1 warning                   | 5                        | **95**           |
| performance / component  | 4 info, 1 warning           | 9                        | **91**           |
| performance / route      | 3 info, 5 warning           | 28                       | 72               |
| security / component     | 4 warning, 1 crit           | 35                       | 65               |
| correctness / component  | 1 info, 10 warning, 3 crit  | 96                       | 4                |
| seo / route              | 10 info, 14 warning, 2 crit | 110                      | 0                |

Architecture is eight `info` rules and nothing else, so an architecture score is a nine-value scale
presented as a hundred-value one. No amount of bad code moves it below 92, and the rule shipped
immediately before this spec — `architecture/doc-link-target` — can move a key by exactly one point. Three
more scopes sit above 90, so this is not one miscalibrated category: it is what the model does wherever a
scope's rules are few or cheap.

**The average erases magnitude.** One `info` finding moves a mean of N keys by `1/N`. At the scale the
field report measured (585 keys), 1 finding and 276 findings both display **99**.

**The cause is the same in both.** A per-key penalty of one point is too small for the mean to register,
and too small for the scale to be used. Fixing either symptom alone fixes neither: raising the deductions
without changing the model still leaves architecture bounded, and un-bounding architecture without making
each affected key cost more still leaves the mean pinned near 100.

## What must remain true

The previous spec established an invariant this one may not break:

> A displayed 100 means the deduction was exactly zero.

And severity must still order findings: within a category and scope, a `critical` must cost more than a
`warning`, which must cost more than an `info`.

## Design

### The model: a key scores the share of its scope that is intact

```
keyScore = clamp(100 × (1 − failedWeight / inventoryWeight))
```

- **`failedWeight`** — over the distinct rule ids that produced a penalized result on this key, the sum of
  `DEDUCTION[effective severity]`, taking the maximum among duplicates. This is today's numerator
  unchanged; only what it is divided by is new.
- **`inventoryWeight`** — the sum of `DEDUCTION[severity]` over the selected rules in this category whose
  scope is among the scopes observed on this key.

Everything downstream is unchanged: key scores are averaged, `sitePenalty` is subtracted, the cap is
applied, the result is floored.

The reading is "of what this category checks at this scope, how much is intact" — the same shape as the
audit-weighted category score users already know from browser performance tooling.

### Why the denominator is the scope's inventory and not what applied

Three candidates were considered. The measurements decide between them.

**Rejected: the rules that actually applied to this key.** This is the faithful "not applicable" semantics,
and it collapses. Measuring the `applies` condition of each architecture rule:

| rule                     | applies when                         |
| ------------------------ | ------------------------------------ |
| `component-size`         | `loc > 0` — every parsable component |
| `prop-count`             | `propCount > 0`                      |
| `doc-link-target`        | a declared-prefix link exists — rare |
| `route-component-import` | a route entry is imported — rare     |
| the four directory rules | a declaration matches — L3           |

So an ordinary component has **one or two** applicable architecture rules. A component with no props that
exceeds the size threshold would have `failedWeight === inventoryWeight` and score **0** — a file a few
lines over a threshold, scored as total failure. Worse, severity would invert across categories: an
`info` at denominator 1 costs 100 points while a `critical` at denominator 35 costs 43.

Flooring the denominator does not rescue it, because the floor and the fix trade against each other
directly. At 300 keys with 10 affected, a per-key score of 0 yields a category mean of 96.7 and a per-key
score of 80 yields 99.3. **The larger the floor, the less of the fix survives**, and the constant has no
principle behind it.

**Rejected: the category's whole inventory, unpartitioned.** `performance` and `seo` each carry rules of
more than one scope. A component key measured against route-scoped rules it can never trigger keeps a
guaranteed share of the denominator intact — the ceiling, reintroduced one level down.

**Chosen: the inventory of the scopes observed on the key.** Partitioning by scope removes the objection to
the whole-inventory form while keeping its stability. The denominator does not depend on which checks
happened to have something to say about this particular file, so no key collapses to a denominator of one.

### The unevenness this accepts, stated rather than smoothed

Because the denominator is the scope's rule count, a scope with few rules charges more per finding:

| key                                 | inventory | one finding | today |
| ----------------------------------- | --------- | ----------- | ----- |
| seo / route (`critical`)            | 110       | 86          | 85    |
| correctness / component (`warning`) | 96        | 95          | 95    |
| security / component (`critical`)   | 35        | 57          | 85    |
| performance / route (`warning`)     | 28        | 82          | 95    |
| architecture / component (`info`)   | 8         | 88          | 99    |
| performance / component (`warning`) | 9         | **44**      | 95    |

A `performance` `warning` therefore costs more than a `security` `critical` (44 against 57). Both scopes hold
five rules, but `security`'s carry four times the weight, so the same finding is a larger share of the
thinner denominator. Severity still orders findings **within** a category and scope, which is the guarantee
this spec keeps; it does not order them across categories, which the previous model did and this one does
not.

This is accepted rather than corrected. The alternative — a floor under the denominator — buys a smoother
table at the cost of the fix itself, on an arbitrary constant. The unevenness also self-corrects: every rule
added to a thin scope widens its denominator.

Note what does **not** move. `seo` and `correctness`, the two categories with the largest inventories and
the ones users read most often, land within a point of today. The change concentrates where the scale was
most compressed, which is the intended effect and not a side effect.

### `sitePenalty` stays absolute

Project-scoped rules keep subtracting `DEDUCTION[severity]` points directly from the category average.

Neither symptom applies to them: a site-wide finding is not divided by the number of keys, so nothing
erases its magnitude, and the site penalty was never bounded by a per-key floor. Normalising it would move
scores for a reason this spec is not about — a single site-wide `warning` in `seo` would go from 5 points to 31.

The consequence is a model that mixes scales: a key's deficit is a share of its scope's inventory, a site
penalty is points. It is bounded (the largest site penalty in the codebase is `seo`'s 16 points) and it is
recorded here rather than discovered later.

### Everything else is unchanged

`CRITICAL_CAP` at 79 with its decision on the raw value; `Math.floor` at both stages; `computeHealth`
averaging unrounded category scores in deficit space; "present" categories only; the empty case scoring 100. The invariant survives by construction: `failedWeight` is zero exactly when no penalized finding
carries the key, and only then does every key score 100.

### Wiring: no signature cascade

`computeScore` needs a rule inventory, which it has never had. It does not need a new argument.

`ScoreOptions` gains `rules?: readonly Rule[]`, defaulting to `selectRules(allRules, config)` computed
inside `computeScore`. Nothing under `packages/core/src/rules/` imports anything under
`packages/core/src/scoring/`, so the import direction is free — verified before choosing this shape. Every
existing call site — three reporters in `core`, four in `cli`, one in `vite` — is untouched, and the
optional parameter remains for tests and for scoring against a rule set that is not the registry.

This is deliberately unlike `2026-08-03-json-rule-evidence`, which threaded a rule-id list through
`AnalyzeResult` because the CLI narrows rules by `--category` _after_ selection and the reporter needed the
narrowed set. Here the narrowed set would be wrong: `--category seo` must not shrink `seo`'s own inventory,
or a filtered run would score differently from a full one on identical input. The inventory is a property of
the configuration, not of the run.

Two resolutions to state, because both can make `failedWeight` disagree with `inventoryWeight`:

- **Severity for the denominator** is `settingSeverity(config.rules[id]) ?? rule.severity` — the same
  top-level resolution `selectRules` uses. `overrides` narrows severity per glob and `selectRules` does not
  read it, so a rule disabled only inside an override stays in the inventory.
- **`treatDynamicAs: 'warn'`** promotes a result's severity without changing its rule's, so `failedWeight`
  can exceed `inventoryWeight`. The clamp absorbs it; the key scores 0, which is the honest reading.

## Migration

Every score moves, most of them down, and by much more than the previous spec's one point. The changeset
must say so plainly, along with the two consequences:

- a `--min-health` gate calibrated against today's numbers will start failing, and the fix is to
  recalibrate against the new scale, not to work around it;
- a stored baseline is unaffected — baselines key on findings, not scores.

## Testing

1. **Magnitude is visible.** At 585 keys, one affected key and 276 affected keys must display **different**
   scores. Under the current model both display 99, so this test must fail before the change. This is the
   regression test for the reported symptom.
2. **The scale is reachable.** An architecture key failing every architecture rule scores 0, not 92. A test
   asserting merely "below 92" would pass on a model that only widened the deductions.
3. **The invariant holds from both sides.** No penalized finding → 100. A single `info` among many passes →
   never 100.
4. **The denominator is partitioned by scope.** A `performance` component key must not count
   `performance`'s route-scoped rules. Assert the exact score of a component key with one failing
   component-scoped rule; computed against the unpartitioned inventory it is measurably higher, so this
   test is what holds the partition in place.
5. **Severity still orders within a scope.** In one category and scope, a `critical` scores lower than a
   `warning`, which scores lower than an `info`. Assert the ordering, not the absolute values, so rule
   additions do not churn the test.
6. **The inventory follows configuration, not the tree.** Turning a rule `off` removes it from the
   denominator, so the remaining findings cost more. This pins the inventory to `selectRules` rather than to
   which rules happened to produce results.
7. **`--category` does not change any category's score.** Scoring the same results with the full rule set
   and with a category-filtered one yields identical category scores. This is the test that fails if the
   inventory is taken from the narrowed set.
8. **Unchanged edges.** No results → 100. All passes → 100. A `critical` still caps a category at 79.
   `sitePenalty` still subtracts absolute points — a site-wide `warning` in `seo` costs 5, not 31.

## Deliberately not solved

- **`routes[].categories[].score` in the JSON report.** Still the third follow-up from the previous spec,
  and this change sharpens the need: a reader who wants to know why a category moved now has to reconstruct
  a ratio per key rather than a subtraction. Recorded, not closed.
- **Making the directory-rule family verifiable from its output.** Unchanged and unaffected.
- **Severity recalibration.** The unevenness above has a second cause the model cannot reach: `performance`
  having five component-scoped rules is a property of the rule set, not of the scoring. Widening thin
  scopes is rule work, tracked separately.
- **Health's cross-category weighting.** `computeHealth` averages category scores with configurable
  weights. Whether those defaults are still right once categories use their full range is a question this
  spec raises and does not answer.
