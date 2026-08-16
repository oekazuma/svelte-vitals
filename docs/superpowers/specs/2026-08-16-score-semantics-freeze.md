# What the Health score means at 1.0 — design

Phase A-2 of `2026-08-16-v1-roadmap.md`. **Amends** `2026-08-05-score-floor-and-reach-design.md`,
which stays authoritative for _why_ the floor exists and what it bought. This decides what the
number promises at 1.0, and it changes one thing in code: the guard on the floor becomes
prescriptive, because the roadmap's own Phase C will otherwise spend the margin the floor depends
on.

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

- **`seo::route` holds 100, not 110.** The severity-alignment pass shrank it, so the `info < warning`
  margin the field called "fifteen points, not comfortable" is **25** today — wider, not narrower.
- **Seven of twelve pairs are clamped, not five of nine.** Both figures are hard-coded in the
  reporters guide, in both languages. See Corrections.

The three `*::project` rows are listed for completeness and **never bind**: project-scope findings
are absolute deductions, not shares. See below.

## There are three numbers, and they are not the same number

The report publishes three scores with three different models. The freeze has to name which is
which, because two of them are already described wrongly in this project's own docs.

| number                | how it is computed                                                       | critical cap                 |
| --------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| `score` (Health)      | weighted mean of the **category** scores, in deficit space, floored once | **no**                       |
| `categories[x].score` | proportional model over that category's keys, minus its `sitePenalty`    | **yes**, 79                  |
| `routes[x].score`     | the same model over one route's findings across **all** categories       | **no** (explicitly disabled) |

## Frozen at 1.0

### The proportional model (category scores)

- **A key's score is the share of its category's severity weight that survived.** The denominator is
  the `(category, scope)` pair the key was measured against, floored at `INVENTORY_FLOOR`. Within a
  category a key touches exactly one pair, because route ids and source paths are disjoint key
  spaces.
- **One deduction per distinct rule id per key**, duplicates taking the maximum. Eight findings from
  one rule on one key cost what one costs.
- **Severity ratios 15 / 5 / 1** for `critical` / `warning` / `info`. The guides teach these as
  "5× and 15×", so the ratio is the contract; the absolute numbers are its implementation.
- **Project-scope findings are absolute points, not shares.** `sitePenalty` sums a flat 15/5/1 per
  rule id and subtracts it from the mean; no inventory divides it. A single project-scope `warning`
  costs its category a flat 5 points on a project of any size. The `*::project` entries in
  `inventories` are inert — they are published for uniformity and no score ever divides by them.
- **A `critical` caps the category score at 79**, and caps nothing else.
- **A category score of 100 means zero penalized findings in that category**, where "penalized" is
  `isPenalized` under the project's `treatDynamicAs`: `'pass'` (the default) does not penalize a
  dynamically-computed value, while `'warn'` and `'fail'` do, at their respective severities. That
  setting therefore changes what a 100 asserts, which is the point of having it.

### Health

- **A weighted mean of the present category scores, averaged in deficit space and floored once.**
  Averaging displayed scores would compose two roundings.
- **Health is not capped by a `critical`.** One critical in one of six categories moves Health by
  about 3.5 points, so Health can read in the nineties with a critical present. This is deliberate
  and stays: the hard gate for a critical is the **exit code** — `1`, frozen in A-1, on any critical
  by default — not the number. A cap on a mean would also make Health disagree with the categories
  it averages. `--min-health` is a floor on overall quality; `--fail-on` is the severity gate. Users
  who want "no critical, ever" already have the default.
- **100 means every present category _with a positive weight_ scored 100.** A category at weight 0
  contributes nothing to the average, so it can read 50 while Health reads 100 — that is what asking
  for weight 0 means. The structural `min(99, …)` makes the rest exact rather than a rounding
  accident: any deficit at all, however small, displays at most 99.
- **`affectedKeys` / `keys` carry magnitude; the score carries depth.** The score is a mean over
  every key, so reach is not recoverable from it. A consumer rendering the score without reach shows
  half the measurement.

### Weighting: equal across present categories

Confirmed, unchanged. Four properties that ship today and are now part of the promise:

- **A category absent from the results leaves the denominator; it is never scored 100.** Turning off
  every a11y rule, or running `--category seo`, makes Health the average of what remains — not an
  average dragged upward by a perfect score for checks that never ran.
- **A partial `weights` map leaves unlisted categories at 1.** `{ a11y: 3 }` means a11y counts triple
  against five categories at 1, not a11y-only.
- **Weight `0` removes a present category from the average** — the documented way to score a category
  without letting it move Health.
- **All present categories at weight 0 is an error, not a 100.** A silent 100 would let a
  `--min-health` gate pass over real findings.

There is no evidence basis for an unequal default — no category is measurably more predictive of
project health than another — and `config.weights` is the knob for projects that disagree.

### Comparability: within a release, and within a mode

**The score is a measurement against the rule set of the version that produced it, over the keys
that mode could reach.**

- **Across versions.** Adding rules moves it; adding a category moves it more. Both have happened —
  the a11y category turned a five-way average into a six-way one in a minor, and the floor's arrival
  raised every thin-pair key. 1.0 promises the _model_, not the _number_: a minor may move a
  project's score, and a `--fail-on` / `--min-health` gate is recalibrated on upgrade like any other
  threshold. Freezing the number instead would forbid every rule the roadmap plans to add — and it
  is what makes the floor bump below legal in a minor.
- **Across modes.** The CLI analyzes every route from source; the Vite plugin analyzes prerendered
  HTML and does not cover SSR/dynamic routes. Different key sets, sometimes different present
  categories, therefore different Health for the same project at the same version. **This is
  contract, not a defect** — each number is honest about what it measured — so a threshold is
  calibrated per mode and the two are never compared.

## The one change: the floor's guard becomes prescriptive

The floor's job is the ordering `info < warning` **within the proportional model**, which is where
the guide already scopes it ("within one group"). A category key touches exactly one pair, so:

```text
worst info = 100 / K        cheapest warning = 500 / i_max
ordering holds  ⟺  5·K > i_max        (i_max = the widest single pair that divides)
```

Today `5 × 25 = 125 > 100`. **Phase C spends this.** `a11y::component` holds 46; the Phase 2
element-level spec rules and the small-rule pool are mostly `warning`-severity component rules, and
sixteen of them put that pair at 126 — at which point an `info` in a floored pair silently starts
costing more than a `warning` in a11y, the exact inversion the floor was built to remove.

**The floor stays a constant, and the invariant becomes the frozen guarantee.** When the registry
crosses the line, the PR that crosses it raises `INVENTORY_FLOOR` to `floor(i_max / 5) + 1` in the
same change, so the score movement lands with the rules that caused it. The existing guard test
already trips at the boundary; it now names the value to set.

Two scoping notes the guarantee needs, both of which make it narrower than it first reads:

- **It covers category scores, not `routes[].score`.** A route's own score spans every category, so
  its denominator is the _sum_ of the pairs it touched, floored once — today up to 148 for a route
  key. Cross-severity ordering does not hold against a sum and no floor can make it: the sum grows
  with the registry in every category at once. `routes[].score` is a per-route roll-up, and severity
  comparisons belong to the category scores beside it.
- **It covers pairs that divide.** `*::project` pairs deduct absolute points and never appear in a
  denominator, so they are excluded from `i_max` — otherwise a future project-scope rule could demand
  a floor rise, moving every clamped score, for an ordering it does not take part in.
- **It covers default severities.** `buildInventory` reads the configured severity, so a project that
  promotes many rules can widen its own `i_max` past `5·K` and re-invert the two for itself. That is
  a consequence of letting configuration change severities and is not guarded.

**The floor is not derived from the registry at runtime**, though the formula would allow it.
`buildInventory` runs against the `selectRules`-filtered set, so a runtime derivation would make `K`
depend on the user's config: disabling seo rules would shrink `i_max`, lower `K`, and change scores
in _unrelated_ floored pairs — precisely the property floor-and-reach rejected ("findings getting
lighter as a project declares more conventions"). A derivation would have to run against the default
registry with default severities, which is a per-release constant with extra machinery.
`reporter/json.ts` also imports `INVENTORY_FLOOR` directly to publish `inventories`; a constant keeps
the scorer and the reporter provably on one value, which is what makes the guide's
`100 − 100·f/i` recomputation checkable.

Raising the floor moves every clamped pair's scores at once and changes the `inventories` output —
that is the cost, and it is why the bump rides with the rules that force it rather than landing
alone.

## Not frozen

- **Inventory values, and therefore scores.** The `JsonReport` fields carrying them are frozen (A-1);
  the numbers move with the registry.
- **`INVENTORY_FLOOR`'s value.** It is the current implementation of the ordering guarantee and rises
  when the guarantee requires it.
- **`warning` below `critical` across pairs.** Unreachable without collapsing the model into absolute
  deductions; see floor-and-reach. A `warning` in a floored pair costs 20, a `critical` in
  `seo::route` costs 15.

## Corrections (fix with this design)

`docs/.../reporters.md` (en + ja) needs three fixes, all of which the audit above found:

- `"seo::route": 110` in the sample, and "five of the nine groups" in the prose — stale, and both
  will rot again on the next rule. Restate without counts, per the AGENTS.md convention.
- "the divisor a score used" is false for the three `*::project` entries, where nothing divides.
- The floor's value is written into the prose; point at `inventories` instead, which publishes it.

## Testing

The guard test in `packages/core/test/score.test.ts` keeps its assertion and gains the remedy in its
failure message. No other test changes: this design freezes behaviour that already ships.
