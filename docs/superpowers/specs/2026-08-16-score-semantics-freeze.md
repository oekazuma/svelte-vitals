# What the Health score means at 1.0 — design

Phase A-2 of `2026-08-16-v1-roadmap.md`. **Amends** `2026-08-05-score-floor-and-reach-design.md`,
which stays authoritative for _why_ the floor exists and what it bought. This decides what the
number promises at 1.0, and it changes one thing: the guard on the floor becomes prescriptive,
because the roadmap's own Phase C will otherwise spend the margin the floor depends on.

## Measured 2026-08-16 — 88 rules, six categories, twelve pairs

| pair                      | rules | weight | floored | c/w/i   |
| ------------------------- | ----- | ------ | ------- | ------- |
| `seo::route`              | 26    | 100    | 100     | 1/15/10 |
| `correctness::component`  | 14    | 96     | 96      | 3/10/1  |
| `a11y::component`         | 10    | 46     | 46      | 0/9/1   |
| `security::component`     | 5     | 35     | 35      | 1/4/0   |
| `performance::route`      | 8     | 28     | 28      | 0/5/3   |
| `a11y::route`             | 4     | 20     | **25**  | 0/4/0   |
| `seo::project`            | 4     | 16     | **25**  | 0/3/1   |
| `architecture::component` | 9     | 9      | **25**  | 0/0/9   |
| `performance::component`  | 5     | 9      | **25**  | 0/1/4   |
| `seo::component`          | 1     | 5      | **25**  | 0/1/0   |
| `performance::project`    | 1     | 5      | **25**  | 0/1/0   |
| `a11y::project`           | 1     | 5      | **25**  | 0/1/0   |

Two corrections to the 2026-08-06 field measurement, which the guides still repeat:

- **`seo::route` holds 100, not 110.** The severity-alignment pass shrank it. The `info < warning`
  margin the field called "fifteen points, not comfortable" is therefore **25** today — wider, not
  narrower, than the number in the older doc.
- **Seven of twelve pairs are clamped, not five of nine.** Both figures are hard-coded in the
  reporters guide, in both languages, and both are stale. See Corrections.

## Frozen at 1.0

### The model's shape

- **A key's score is the share of its pairs' severity weight that survived.** Per `(category, scope)`
  pair; a key's denominator is the sum of the pairs it was measured against, floored once.
- **One deduction per distinct rule id per key**, duplicates taking the maximum. Eight findings from
  one rule on one key cost what one costs.
- **Severity ratios 15 / 5 / 1** for `critical` / `warning` / `info`. The guides teach these as
  "5× and 15×", so the ratio is the contract; the absolute numbers are its implementation.
- **A `critical` anywhere caps the headline at 79.**
- **100 means zero penalized findings, and nothing else.** The structural `min(99, …)` in
  `computeHealth` is what makes this exact rather than a rounding accident.
- **Health averages in deficit space** across categories, then floors once.
- **`affectedKeys` / `keys` carry magnitude, the score carries depth.** The score is a mean over
  every key, so reach is not recoverable from it. A consumer that renders the score without reach
  is showing half the measurement.

### Weighting: equal across present categories

Confirmed, unchanged. Two properties that were implemented but never stated, and are now part of
the promise:

- **A category absent from the results leaves the denominator; it is never scored 100.** Turning
  off every a11y rule, or running `--category seo`, makes Health the average of what remains — not
  an average dragged upward by a perfect score for checks that never ran.
- **A partial `weights` map leaves unlisted categories at 1.** `{ a11y: 3 }` means a11y counts
  triple against five categories at 1, not a11y-only.

There is no evidence basis for an unequal default — no category is measurably more predictive of
project health than another — and `config.weights` is the knob for projects that disagree.

### Comparability: within a release, not across

**The score is a measurement against the rule set of the version that produced it.** Adding rules
moves it; adding a category moves it more. Both have already happened — the a11y category turned a
five-way average into a six-way one in a minor, and the floor's own arrival raised every thin-pair
key.

So 1.0 promises the _model_, not the _number_: a minor release may move a project's score, and a
`--fail-on` / `--min-health` gate is recalibrated on upgrade like any other threshold. Stated as
frozen semantics rather than a release note because the alternative — freezing the number — would
forbid every rule the roadmap plans to add.

This is also what makes the floor bump below legal in a minor.

## The one change: the floor's guard becomes prescriptive

The floor's job is the ordering `info < warning`. It holds only while the widest pair stays under
five times the floor:

```text
worst info = 100 / K        cheapest warning = 500 / i_max
ordering holds  ⟺  5·K > i_max
```

Today `5 × 25 = 125 > 100`. **Phase C spends this.** `a11y::component` holds 46; the Phase 2
element-level spec rules and the small-rule pool are mostly `warning`-severity component rules, and
roughly sixteen of them put that pair over 125 — at which point an `info` in a floored pair
silently starts costing more than a `warning` in a11y, which is the exact inversion the floor was
built to remove.

**The floor stays a constant, and the invariant becomes the frozen guarantee.** When the registry
crosses the line, the PR that crosses it raises `INVENTORY_FLOOR` to `floor(i_max / 5) + 1` in the
same change, so the score movement lands with the rules that caused it. The existing guard test
already trips at the boundary; it now says what to set the constant to instead of only that a
comparison failed.

**The floor is not derived from the registry at runtime**, though the formula above would allow it.
`buildInventory` runs against the `selectRules`-filtered set, so a runtime derivation would make
`K` depend on the user's config: disabling seo rules would shrink `i_max`, lower `K`, and change
scores in _unrelated_ floored pairs. That is precisely the property floor-and-reach rejected —
"findings getting lighter as a project declares more conventions". A derivation would have to run
against the default registry with default severities, which is a per-release constant with extra
machinery. `reporter/json.ts` also imports `INVENTORY_FLOOR` directly to publish `inventories`; a
constant keeps the scorer and the reporter provably on one value, which is what makes the
`100 − 100·f/i` recomputation in the guide checkable.

## Not frozen

- **Inventory values, and therefore scores.** The `JsonReport` fields carrying them are frozen (A-1);
  the numbers move with the registry.
- **`INVENTORY_FLOOR`'s value.** It is the current implementation of the ordering guarantee, and
  rises when the guarantee requires it.
- **`warning` below `critical` across pairs.** Unreachable without collapsing the model into
  absolute deductions; see floor-and-reach. A `warning` in a floored pair costs 20, a `critical` in
  `seo::route` costs 15.

## Corrections (fix with this design)

- `docs/.../reporters.md` (en + ja) hard-codes `"seo::route": 110` in the sample and "five of the
  nine groups" in the prose. Both are stale, and both will rot again on the next rule — restate
  without counts, per the AGENTS.md convention that already forbids rule counts in guides.

## Testing

The guard test in `packages/core/test/score.test.ts` keeps its assertion and gains the remedy in
its failure message. No other test changes: this design freezes behaviour that already ships.
