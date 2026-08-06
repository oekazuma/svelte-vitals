# What a score means, and what it does not — design

**Date:** 2026-08-05
**Status:** withdrawn 2026-08-05 — superseded by `2026-08-05-score-floor-and-reach-design.md`.
Field review rejected its central justification: it described the model as coverage while the denominator
counts rules that evaluated nothing (6 of 8 in `architecture::component`, verified on the repo's own fixture).
It also refused to floor the denominator on grounds that its own table undermined — the magnitude signal it
protected expires once a pair reaches 14 rules, which the project is adding toward anyway. **The measurements
below stand and are the input to the successor**; only the conclusion is withdrawn.
**Origin:** a field measurement of the proportional score model on a real project (351 keys, 77 findings),
reported 2026-08-05. It answered the question
`2026-08-04-score-proportionality-design.md` left open under "severity recalibration".

## What the field measured

The measurement asked whether the thin `(category, scope)` pairs — the ones whose small inventories produce
extreme scores — actually fire. Three results, and the surprising one is not the one the question was about.

**The catastrophic case does not occur.** `seo::component` and `performance::project` each hold exactly one
rule, so one finding scores the key **0**. Neither fired: 0 keys of 351. `performance::component` (inventory 9) did not fire either. The only thin pair that fires is `architecture::component`, on 41 of 351 keys, and
entirely through `architecture/component-size` and `architecture/prop-count`.

**Severity is inverted across categories, and it is visible.** An `architecture` `info` costs a key **13
points** (inventory 8); a `seo` `warning` costs **5** (inventory 110). A finding the rule set labels less
severe costs 2.6× more. This is not theoretical — it is what 41 of 351 keys show.

**The previous release worked.** `architecture` reads 98, having read **100 with the same 43 findings** before
the proportional model shipped. The lie is gone. The dilution is not: 41 affected keys move the category by
two points.

## The decision: the model does not change

The obvious response to the inversion is to floor the denominator — score against `max(inventory, K)` so thin
pairs stop charging so much. Measured against the field's own numbers, **there is no K that works.**

| K         | an `architecture` `info` costs | a `seo` `warning` costs | 41 affected keys | 1 affected key | distinguishes? |
| --------- | ------------------------------ | ----------------------- | ---------------- | -------------- | -------------- |
| 8 (today) | 12.5                           | 5                       | 98               | 99             | **yes**        |
| 11        | 9.1                            | 5                       | 98               | 99             | yes            |
| 12        | 8.3                            | 5                       | 98               | 99             | yes            |
| 14        | 7.1                            | 5                       | **99**           | 99             | **no**         |
| 20        | 5.0                            | 5                       | **99**           | 99             | **no**         |

The model reproduces the field's reported category score exactly at K = 8, which is what makes the rest of the
table trustworthy: 41 keys deficit `100/8` and 2 keys deficit `200/8` over 351 keys gives 98.47, and the field
reported 98.

Read the table's two ends. **K ≤ 12 keeps the magnitude signal and keeps the inversion. K ≥ 14 softens the
inversion and destroys the signal** — 41 affected keys and one affected key both display 99. At K = 20, where
an `info` finally costs exactly what a `seo` `warning` costs, the category can no longer tell one finding from
forty-one.

That is not a tuning failure. **In a coverage model a finding costs `1 / inventory`, so as long as one pair
holds 8 rules and another holds 26, no severity weighting can order them across categories.** The only way to
make severity comparable across pairs is to equalise the inventories — by adding rules, or by flooring — and
flooring shrinks the deduction by exactly the amount it equalises. The two properties are the same knob turned
opposite ways.

So the choice is which property to keep, and this design keeps the magnitude signal, for three reasons in
descending weight:

1. **Flooring would undo, one release later, what the previous release shipped and this measurement just
   confirmed in the field.** The separation between one finding and forty-one is one point today and zero at
   K = 20. Not halved — gone.
2. **The inversion is a correct reading, not an arithmetic error.** `architecture` 87 beside `seo` 95 says
   "12.5% of what we check here failed, against 4.5% there", and that is true. The score has never claimed to
   rank findings by severity; it reports coverage. What is missing is that nobody wrote that down.
3. **The alarming symptom is theoretical.** A floor would trade a property that occurs on 41 keys for
   insurance against one that occurs on none.

`K = 10` deserves naming because it is the one setting that closes the zero-point cases while keeping the
signal — `seo::component`'s lone `warning` would score 50 rather than 0, and `architecture` would still read
98 against 99. It is not adopted: 50 is nearly as alarming as 0 for a single `warning`, and neither occurs.
Recorded so the option is visible if a zero ever appears in the field.

## What changes: the documentation

The measurement's real finding is that the semantics are undocumented. Three things a reader cannot learn from
the output:

**A score is coverage, not severity.** Per-key scores are comparable **within** a category and not across it.
`architecture 87` next to `seo 95` on the same key does not mean the architecture problem is worse; it means
architecture checks fewer things there, so each one is a larger share. The reporters guide and the health
report guide both describe the score without saying this.

**Repeated findings from one rule cost the same as one.** The deduction is per distinct rule id on a key, with
duplicates taking the maximum. A key with eight `correctness/each-index-key` findings scores exactly what a key
with one scores. This is deliberate — a rule either passes on a key or does not — and it is stated in
`2026-08-04-score-proportionality-design.md`, but nowhere a user reads. The field measurement discovered it by
observation, which is how a user will too.

**Magnitude is visible at the category level, not within a key.** "One finding and several hundred now display
differently" holds because more keys become affected, not because a key gets worse as findings accumulate on
it. Both halves need saying together, or the first half reads as a promise the second half breaks.

## The field corpus, recorded as the third measurement

`2026-08-04-route-category-scores-design.md` records two corpora for how often `routes[].score` equals the mean
of `routes[].categories`, and says neither predicts a given project. The field is the third, and it lands
between them:

| corpus                       | keys compared                    | agreement |
| ---------------------------- | -------------------------------- | --------- |
| the repo's fixtures          | 51, of which 46 single-category  | 98%       |
| a 200-page synthetic project | 413, of which 400 multi-category | 52%       |
| **a real project**           | **328 multi-category of 351**    | **85%**   |

The real project is multi-category almost everywhere — 263 keys carry two categories, 64 carry three — so its
85% is not the fixtures' single-category artefact. It is high because most keys are clean, which is what the
"clean keys agree by construction" rule predicts and what the synthetic corpus, whose pages are uniformly
flawed, could not show.

**One correction the field forces.** The design's only worked example has `routes[].score` **below** the mean
(96 against 97.5). The field's deviations run the other way — 30 keys at +1, 10 at +4, 1 at +7, against 8 keys
spread over −1, −3 and −5. The direction has a rule, verified here: with one clean partner category,
`sign(score − mean) = sign(i_clean − i_failing)`. The example has the large-inventory category failing, which
is the minority case; the field's typical key has thin `architecture` failing beside a fat clean partner, which
pushes the union ratio up. A reader calibrating on that example would expect the wrong sign.

## Deliberately not solved

- **The inversion itself.** Kept, for the reasons above, and now documented rather than silent. If it proves
  worse in use than the magnitude signal is worth, the decision reverses to `K = 20` and the previous release's
  gain is spent — that is the trade, stated so it can be made deliberately rather than discovered.
- **The thin pairs.** `architecture::component` at 8 rules and `seo::component` at 1 are a **rule-inventory
  gap, not a scoring defect**. The coverage number is honest about how little is checked there. Closing it
  means more rules in those pairs, which is the project's direction anyway.
- **Dilution.** 41 affected keys moving a category two points is the mean over 351 keys doing what a mean does.
  Making the category reflect the _share_ of affected keys as well as their depth is a different aggregation
  and a separate design.
- **Rendering `routes[].categories`.** Unchanged from the previous design; the HTML report and the dashboard
  receive it and ignore it.

## Testing

This design changes documentation, so the tests are the docs-gating suites that already exist
(`packages/cli/test/docs-links.test.ts`, `rules-index.test.mjs`, `docs-embed.test.mjs`) plus one check the
prose cannot get from a test runner:

**Does the prose answer the confusion that produced this design?** The field reader arrived at "severity has
stopped meaning anything" from a correct observation and an undocumented model. The documentation earns its
place only if a reader in that position comes away understanding why an `info` can cost more than a `warning`
and why that is not a defect. That is a field question, not a unit test, and this design should not be
implemented until it is answered.
