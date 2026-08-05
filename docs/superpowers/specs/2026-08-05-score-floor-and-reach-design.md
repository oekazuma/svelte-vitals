# A floor under the denominator, and reach beside the score — design

**Date:** 2026-08-05
**Status:** approved
**Supersedes:** `2026-08-05-score-semantics-design.md`, withdrawn after field review.
**Origin:** a field measurement on a real project (351 keys, 77 findings) and the review of the withdrawn
design, both 2026-08-05.

## The problem, in the order it has to be solved

**A finding labelled less severe costs more.** On the field project an `architecture` `info` takes **13
points** off a key while a `seo` `warning` takes **5**. That is 41 of 351 keys, not a corner case. The
severity a rule declares and the damage it does have come apart.

**The denominator counts checks that never ran.** `architecture::component` holds 8 rules, of which **6
evaluate nothing** — verified on the repo's own fixture, where `.rules` reports `0 findings / 0 passed` for
six of the eight. The withdrawn design justified the model as "the share of what we check here that failed";
what is actually checked there is two things, not eight.

**The two are the same knob.** In a ratio model a finding costs `1 / inventory`. Making the denominator
honest shrinks it, which makes each finding cost _more_ — measured on the field project, dropping
`architecture::component` from 8 to the 4 configured rules moves an `info` from 13 points to 25, and to the 2
evaluated rules moves it to 50. Every fix for the honesty problem makes the severity problem worse, and the
obvious fix for the severity problem — a larger denominator — makes the score move less. The withdrawn design
tried to settle the second without the first and had to refuse both.

## The design

### 1. Floor the denominator at 25

```
inventoryWeight = max(observedInventory, failedWeight, 25)
```

The existing `max(observedInventory, failedWeight)` stays; 25 joins it.

**This orders `info` below `warning` everywhere.** The worst `info` costs `100/25 = 4.00`; the cheapest
`warning` costs `500/110 = 4.55`, in `seo::route`. Every pair, after the floor:

| pair                      | inventory | floored to | one `info` | one `warning` | one `critical` |
| ------------------------- | --------- | ---------- | ---------- | ------------- | -------------- |
| `seo::route`              | 110       | 110        | 99         | 95            | 86             |
| `correctness::component`  | 96        | 96         | 98         | 94            | 84             |
| `security::component`     | 35        | 35         | 97         | 85            | 57             |
| `performance::route`      | 28        | 28         | 96         | 82            | 46             |
| `seo::project`            | 16        | **25**     | 96         | 80            | 40             |
| `performance::component`  | 9         | **25**     | 96         | 80            | 40             |
| `architecture::component` | 8         | **25**     | 96         | 80            | 40             |
| `seo::component`          | 5         | **25**     | 96         | 80            | 40             |
| `performance::project`    | 5         | **25**     | 96         | 80            | 40             |

The zero-point cases disappear with it: `seo::component`'s lone `warning` scored **0** and now scores **80**.

**`warning` is not ordered below `critical`, and no floor achieves that.** A `warning` in a floored pair costs
20; a `critical` in `seo::route` costs 13.64. Ordering those would need the floor at ~37, where eight of the
nine pairs sit on the floor and the model has become absolute deductions wearing a ratio's clothes. So it is
left unordered, deliberately, because the case requires a thin pair carrying a `warning` beside a thick pair
carrying a `critical` — and **no thin pair fired at all in the field**: `seo::component`,
`performance::project` and `performance::component` were 0 keys of 351.

**The floor also settles the honesty problem, which is why it is the only change here.** Every pair whose
denominator was polluted by never-evaluated rules is a thin pair, and every thin pair now sits on the floor —
so excluding unconfigured rules would produce the identical number. Excluding them was the field's own
suggestion and it is the right instinct; the floor reaches it without making the denominator depend on
configuration, which would have meant a project's existing findings getting lighter as it declared more
conventions.

### 2. Report reach beside the score

Each category in the JSON report gains the count of keys it touched and the count it penalized:

```jsonc
"categories": {
  "architecture": { "score": 99, "scoreModel": { … }, "keys": 351, "affectedKeys": 41 }
}
```

**This is where magnitude now lives.** The score is a mean over every key, so it is `share × depth` — 41
affected keys of 351 move a category by less than a point once the floor is in. That is not a defect to be
tuned away; it is what a mean of mostly-clean keys says. Splitting the product's two factors out is what makes
both legible: `41 of 351` distinguishes one finding from forty-one exactly, where the score cannot.

It also removes the reason the withdrawn design refused to floor. That refusal was to protect the score's
resolution — 29 affected keys per displayed point at inventory 8, 71 at 25. With reach reported, resolution
stops carrying the signal and the floor costs nothing that matters.

### 3. Say what the number means

Three facts a reader cannot get from the output today, all of which the field measurement discovered by
observation:

- **A category score is a proportion of severity weight, not a severity ranking.** Comparable within a
  category; across categories it says which category has a larger share of its own checks failing.
- **Repeated findings from one rule cost the same as one.** The deduction is per distinct rule id on a key,
  duplicates taking the maximum. A key with eight `correctness/each-index-key` findings scores what a key with
  one scores. Stated in `2026-08-04-score-proportionality-design.md`; stated nowhere a user reads.
- **The per-pair inventory is not derivable from the report.** A reader who wants to check `96 = 100 − 100/25`
  cannot, because neither the inventory nor the floor appears anywhere. `scoreModel` gains
  `inventoryWeight`, so the arithmetic is checkable.

The one-paragraph version, which goes in the reporters guide in both languages:

> A category's score on a key is the share of that category's severity weight that survived. One `info` costs
> a twenty-fifth of the weight at most, one `warning` five times that, one `critical` fifteen times — so a
> more severe finding always costs more than a less severe one within a category, and a category that checks
> very few things is scored against a floor rather than against those few. Repeated findings from the same
> rule on the same key cost what one costs. Beside the score, `affectedKeys` says how much of the project the
> category touched: the score is depth, that is reach.

## What this costs

**Scores rise.** On the field project `architecture` goes from 98 to **99**, and its worst keys from 87 to
**96**. Every thin-pair key moves up. That is the trade for severity behaving, and the reach count is what
keeps the change from hiding anything: 41 of 351 was invisible before and is now printed.

**A `--min-health` gate calibrated on the current release will pass more easily.** Recalibrate.

## Testing

1. **`info` costs less than `warning` in every pair.** Assert the ordering across all nine pairs
   programmatically from the registry rather than as nine literals, so a new rule cannot silently break it.
2. **The floor binds only below 25.** `seo::route` at 110 is unchanged; `architecture::component` at 8 scores
   as if 25. Assert both on the same input.
3. **A lone `warning` in a one-rule pair scores 80, not 0.** This is the case the field could not produce and
   the floor exists for.
4. **`affectedKeys` counts keys with at least one penalized result in that category**, and `keys` counts every
   key the category touched. A category with one finding and one with forty must differ here even when their
   scores do not — that is the whole point of the field, so assert both scores equal and both reaches
   different on one input.
5. **`scoreModel.inventoryWeight` is the floored value**, so a reader recomputing `100 − 100·f/i` gets the
   displayed score. Assert on a floored pair and an unfloored one.
6. **The invariant survives.** No penalized finding → 100. One `info` among many passes → never 100.
7. **`sitePenalty` is untouched** — still absolute points, still subtracted after the mean.

## Deliberately not solved

- **`warning` below `critical` across categories.** See above: unreachable without collapsing the model, and
  unobserved in the field.
- **Excluding unconfigured rules from the denominator.** Subsumed by the floor for every pair where it would
  change a number, and rejected on its own because it would make findings lighter as a project declares more.
- **Dilution.** The score is a mean and stays one. Reach is the answer to "how much", not a rounder score.
- **Rendering reach in the HTML report or the dashboard.** They receive the field and ignore it.
