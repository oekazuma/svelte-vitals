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
keyScore = inventoryWeight === 0 ? 100 : clamp(100 − (100 × failedWeight) / inventoryWeight)
```

- **`failedWeight`** — over the distinct rule ids that produced a penalized result on this key, the sum of
  `DEDUCTION[effective severity]`, taking the maximum among duplicates. This is today's numerator
  unchanged; only what it is divided by is new.
- **`inventoryWeight`** — `max(observedInventory, failedWeight)`, where `observedInventory` is the sum of
  `DEDUCTION[severity]` over the selected rules whose **(category, scope) pair** is among the pairs
  observed on this key.

Everything downstream is unchanged: key scores are averaged, `sitePenalty` is subtracted, the cap is
applied, the result is floored.

The reading is "of what this key was measured against, how much is intact" — the same shape as the
audit-weighted category score users already know from browser performance tooling.

**Three details in that formula are load-bearing, and two of them are arithmetic.**

**The pair, not the scope alone.** `computeScore` takes results, not a category: `scoresByCategory` buckets
first and calls it per category, but three call sites pass a multi-category set — `routes[].score` in the
JSON report, the console's "By route" tree, and the Vite plugin's overall score. Partitioning by scope alone
leaves those undefined. Summing over observed `(category, scope)` pairs defines them and reduces to the
single-category rule exactly when the input is single-category, so the two paths cannot disagree. A route
carrying one failing `seo` `warning` alongside passing `performance` route rules scores `100 − 500/138 =
96.38` against the union, where the `seo` bucket alone gives `95.45`; both are defined, and which applies
depends only on what was handed in.

**The evaluation order.** `100 × (1 − f / i)` loses a full displayed point on values that are exactly
integral: with `f = 88, i = 110` it yields `19.999999999999996`, which floors to **19** for a true **20**
(and `f = 99` gives `9.999999999999998` → **9** for **10**; both are reachable on one `seo` route). Written
as `100 − (100 × f) / i`, `100 × f` and `i` are exact integers and an integer quotient of exact integers is
exactly representable — the same argument `score.ts` already makes for the route mean, whose comment must be
updated because this model breaks its stated premise that every key score is an integer.

**`max(observedInventory, failedWeight)` and the zero guard.** Normally `observedInventory ≥ failedWeight`,
since every failing rule sits in its own pair's inventory, and the `max` is inert. It is there for the two
cases where that does not hold, both of which would otherwise divide by zero or produce `NaN` —
`clamp(NaN)` is `NaN`, which would propagate into the category score, into Health, and out as
`"score": null`:

- `treatDynamicAs: 'warn'` promotes a **result's** severity without changing its rule's, so `failedWeight`
  can exceed the inventory. The key scores 0, which is the honest reading.
- A result whose rule id is absent from the inventory — reachable through the `rules?:` escape hatch below,
  or a set of results scored against a configuration that turned its rule `off`. It observes no pair, so it
  contributes nothing to `observedInventory`; the `max` keeps it from being divided by zero and from
  displaying 100 with a finding present, which would break the invariant this spec inherits.
- An `overrides` entry raising a rule's severity for a glob. `selectRules` and `buildInventory` read only
  top-level `config.rules`, so the denominator keeps the rule's base severity while the result carries the
  raised one. Measured on the eight-`info` architecture pair: promoting one rule's result to `critical` this
  way scores the key **0** (`failedWeight` 15 against an unmoved inventory of 8), where making the same
  promotion at top level — which raises the inventory too, to 22 — displays **31** (raw 31.81…).

The zero guard covers the remaining case: a key with no penalized results and no observed pair scores 100,
matching today's seed.

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

**Chosen: the inventory of the `(category, scope)` pairs observed on the key.** Partitioning removes the
objection to the whole-inventory form while keeping its stability. The denominator does not depend on which
checks happened to have something to say about this particular file, so no key collapses to a denominator of
one.

### The unevenness this accepts, stated rather than smoothed

Because the denominator is the scope's rule count, a scope with few rules charges more per finding:

Key scores are **not** rounded — they are averaged, and only the category score is floored. The column
below is the exact key score, so a single-key category displays its floor:

| key                                 | inventory | one finding | displays | today |
| ----------------------------------- | --------- | ----------- | -------- | ----- |
| seo / route (`critical`)            | 110       | 86.36       | 86       | 85    |
| correctness / component (`warning`) | 96        | 94.79       | 94       | 95    |
| security / component (`critical`)   | 35        | 57.14       | 57       | 85    |
| performance / route (`warning`)     | 28        | 82.14       | 82       | 95    |
| architecture / component (`info`)   | 8         | 87.5        | 87       | 99    |
| performance / component (`warning`) | 9         | 44.44       | **44**   | 95    |

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
averaging unrounded category scores in deficit space; "present" categories only; the empty case scoring 100.

The invariant survives by construction: `failedWeight` is zero exactly when no penalized finding carries the
key, and only then does every key score 100 — the zero guard returns 100 precisely in the case where
`failedWeight` must also be zero, and the `max` keeps a penalized result whose rule is unknown from reaching
the guard.

One premise in `score.ts` does **not** survive. The comment at the route mean argues that no epsilon is
needed there because "every route score is an integer, so `sum / length` is a division of exact integers,
and whenever the true quotient IS an integer it is exactly representable". Key scores are no longer
integers, and the conclusion the comment draws no longer follows from the reason it gives.

**The clean case is not what breaks.** A clean key scores exactly `100`, a sum of exact `100`s is exact for
any key count this tool will ever see, and the quotient is exactly `100`. That guarantee survives the model
change untouched, and a test asserting it would pass under any arithmetic — it pins nothing.

**What breaks is an exactly-integral mean of unclean keys.** Two `performance` component keys against an
inventory of 9, one failing three `info` rules and one failing a `warning` and an `info`, have a true
category score of exactly **50**. Computed as a mean of key scores it comes out `49.99999999999999` and
displays **49**.

**So the route mean moves into deficit space**, as `computeHealth` already does:
`rawRouteAverage = 100 − (Σ keyDeficit) / N`, where `keyDeficit` is `(100 × failedWeight) / inventoryWeight`.
That fixture then displays 50. The comment must be rewritten to state this reason rather than the one it
states today — a false premise left in a comment about floating point is how the previous spec's arithmetic
bugs survived review the first time, and the first draft of this paragraph made exactly that mistake.

**The residual, stated because the single-key case was not allowed to pass silently.** Deficit space narrows
this class; it does not close it. Four `performance` component keys failing one `info`, one `warning`, all
five rules, and three `info`s have a true mean of exactly 50 and display **49** in deficit space too. The
accepted tolerance is therefore: exact for a clean project and exact for a single key, but a multi-key mean
whose true value is an integer may display one point low. It is bounded at one point and it is the same
tolerance `computeHealth` already carries — but this spec blocked the single-key instance of the identical
error as "a full displayed point lost", so leaving the multi-key instance unnamed would be the double
standard.

### Wiring: no signature cascade

`computeScore` needs a rule inventory, which it has never had. It does not need a new argument.

`ScoreOptions` gains `rules?: readonly Rule[]`, defaulting to `selectRules(allRules, config)` computed
inside `computeScore`. A supplied list is not taken as given either: `computeScore` runs it through
`selectRules(config)` itself, so an injected rule that config turns `off` is dropped from the inventory and
from `pairOf` alike, rather than reaching one but not the other. Nothing under `packages/core/src/rules/`
imports anything under
`packages/core/src/scoring/`, so the import direction is free — verified before choosing this shape. Every
existing call site — three reporters in `core`, three in `cli`, one in `vite` — is untouched, and the
optional parameter remains for tests and for scoring against a rule set that is not the registry. The Vite
plugin already bundles `allRules` through `analyze.ts`, so nothing gains weight.

This is deliberately unlike `2026-08-03-json-rule-evidence`, which threaded a rule-id list through
`AnalyzeResult` because the CLI narrows rules by `--category` _after_ selection and the reporter needed the
narrowed set. Here the narrowed set would be wrong: `--category seo` must not shrink `seo`'s own inventory,
or a filtered run would score differently from a full one on identical input. The inventory is a property of
the configuration, not of the run.

**Severity for the denominator** is `settingSeverity(config.rules[id]) ?? rule.severity` — the same
top-level resolution `selectRules` uses. `overrides` narrows severity per glob and `selectRules` does not
read it, so a rule disabled only inside an override stays in the inventory.

## What this buys, quantified

The resolution improves by the ratio of the new per-key deficit to the old one, and no further. In
`architecture`, one `info` used to cost a key 1 point and now costs 12.5, so at N keys it takes
`⌊N/12.5⌋ + 1` findings to move the displayed score by one instead of `N + 1`. The `+ 1` is not a rounding
convenience: a mean deficit of exactly 1 still floors to 99, so at N = 500 forty findings display 99 and
forty-one are needed. At the field report's 585 keys that is 47 findings rather than 586 — the reported case
(276) now reads **94** against **99** for one finding, but **1 through 46 findings all still display 99.**

That flat band is the honest limit of this change: it makes magnitude visible at the scale the complaint was
filed at, and it does not make every increment visible. Stating the factor here is what keeps the same
complaint from being re-filed at 20 findings as though nothing had been done.

## Migration

Every score moves, most of them down, and by much more than the previous spec's one point. The changeset
must say so plainly, along with the three consequences:

- a `--min-health` gate calibrated against today's numbers will start failing, and the fix is to
  recalibrate against the new scale, not to work around it;
- **`routes[].score` in the JSON report changes meaning**, from "100 minus this route's deductions" to "the
  share of everything measured on this route that is intact". It is a published field, documented in
  `docs/src/content/docs/guides/(reporting)/reporters.md` (and its Japanese counterpart), whose description
  of the field must be updated alongside;
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
   test is what holds the partition in place. Take the expected value from the formula, not from this
   document's tables — those are illustrative and go stale on the next rule added.
5. **A multi-category key sums the observed pairs.** Score a single route carrying one failing `seo`
   `warning` and a passing `performance` route rule, through `computeScore` directly rather than through
   `scoresByCategory`. Against the `seo` bucket alone the answer is higher, so this is the test that holds
   the pair definition — and it is the path `routes[].score`, the console route tree and the Vite plugin
   take. Without it the multi-category call sites are unpinned.
6. **Severity still orders within a scope.** In one category and scope, a `critical` scores lower than a
   `warning`, which scores lower than an `info`. Assert the ordering, not the absolute values, so rule
   additions do not churn the test.
7. **The inventory follows configuration, not the tree.** Turning a rule `off` removes it from the
   denominator, so the remaining findings cost more. This pins the inventory to `selectRules` rather than to
   which rules happened to produce results.
8. **`--category` does not change the scored category's score.** Score one category's results with the full
   rule set and with a rule set narrowed to that category; the category score must be identical. Compare
   only that category — a narrowed rule set leaves the other categories with no inventory, which is the
   unknown-rule path, not the invariance being asserted.
9. **No input produces `NaN` or a 100 that hides a finding.** A penalized result whose rule is absent from
   the injected inventory scores its key 0, not `NaN` and not 100. A key with no results and no inventory
   scores 100. Assert `Number.isFinite` on the category score in both.
10. **Integral scores survive the arithmetic, in both places it can go wrong.** A single key with
    `failedWeight` 88 against inventory 110 displays **20** — written as `100 × (1 − f / i)` it yields
    `19.999999999999996` and displays 19, so this holds the evaluation order. And two `performance`
    component keys against an inventory of 9, failing `f = 3` and `f = 6`, display **50** — as a mean of key
    scores that is `49.99999999999999` and displays 49, so this holds the deficit-space mean. Do **not**
    assert that a clean project displays 100 as the test for the mean: it is exactly 100 under either
    arithmetic, so it would pass on the implementation this test exists to reject.
11. **Unchanged edges.** No results → 100. All passes → 100. A `critical` still caps a category at 79.
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
