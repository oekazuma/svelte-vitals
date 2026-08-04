# Per-route category scores in the JSON report — design

**Date:** 2026-08-04
**Status:** approved
**Origin:** the third follow-up recorded by `2026-07-31-score-honesty-design.md`, whose successor
`2026-08-04-score-proportionality-design.md` sharpened it: "a reader who wants to know why a category moved
now has to reconstruct a ratio per key rather than a subtraction."

## The problem

The report says what each route scored and what each category scored. It does not say **what a route scored in
a category**, so the reader who wants to know why a category moved cannot get at the size of each route's
contribution.

Note precisely what is and is not missing. Every issue already carries its `category`, so _identifying_ the
routes with findings in a category is mechanical from the report as it stands. What is unrecoverable is
**magnitude**: a route's deficit is `(100 × failedWeight) / inventoryWeight`, and the inventory denominators —
110 for `seo::route`, 28 for `performance::route`, 5 for `seo::component` — appear nowhere in the output. So two
keys each carrying exactly one `warning` can be 95 points apart: against `seo::component`'s inventory of 5 that
one warning scores the key **0**, and against `seo::route`'s 110 it scores **95**. Nothing in the report lets a
reader see why.

That is not hypothetical. The field report that started this whole line of work observed a category displaying
100 while carrying 276 findings, and **could neither confirm nor reject its own hypothesis from the output**,
because per-route scores were aggregated before they were exposed. It arrived as a question rather than a bug
report for that reason.

Two changes since have made the gap worse rather than better:

- **`computeHealth` is deliberately not re-derivable** from the displayed category scores — it averages
  unrounded values and floors once, so it can sit up to a point above their mean.
- **A key's score is now a ratio, not a subtraction.** Under the old model a reader could add up `DEDUCTION`
  values and check the arithmetic by hand. Now they would have to know the severity-weighted inventory of
  every `(category, scope)` pair the route touched.

So the report's numbers are less checkable than they were, and this is the cheapest thing that makes them
checkable again.

## Design

Each entry in `routes[]` gains a `categories` map:

```jsonc
{
  "route": "/blog",
  "score": 96,
  "categories": { "seo": 95, "performance": 100 },
  "issues": [ … ]
}
```

`JsonReport['routes']` becomes
`Array<{ route: string; score: number; categories: Record<string, number>; issues: JsonIssue[] }>`.

**The wiring needs one change, and a first draft of this section got it wrong.** `scoresByCategory` is exported
and buckets by category exactly as needed, but it takes no `ScoreOptions` and calls
`computeScore(rs, config)` — so `applyCriticalCap` defaults to **true**. Used as exported it would contradict
the cap decision below: measured, a route carrying one failing `seo` `critical` comes back as `seo: 79` with
`scoreModel.criticalCap: 79`, where the same route's `routes[].score` is **86**.

So `scoresByCategory` gains an optional third parameter, `options: ScoreOptions = {}`, forwarded to
`computeScore`. Every existing caller — `computeHealth` among them — passes nothing and is unaffected, which
matters because the predecessor spec requires a capped category to keep pulling Health down. The reporter
passes `{ applyCriticalCap: false }`.

The alternative, bucketing inside `buildJsonReport` and calling `computeScore` per bucket, was rejected: it
would duplicate `scoresByCategory`'s `r.category ?? 'seo'` fallback in a second place, where the two could
drift.

Three decisions, each of which could reasonably have gone the other way:

**Scores only, no `scoreModel`.** The top-level `categories` carries `{ score, scoreModel }`, and mirroring it
here would add nothing: a route's results contain no project-scoped findings, so `sitePenalty` is structurally
0, and `routeAverage` restates `score` because there is one key. `criticalCap` would be null too — but only
because the cap is switched off above, which is a decision rather than a structural fact; the first draft of
this paragraph asserted it as one and was wrong.

**Only the categories that produced a result on that route.** A route with no `architecture` result must not
appear with `architecture: 100`. That would claim a measurement that never happened — the same dishonesty
`2026-07-31-score-honesty-design.md` exists to remove, at a smaller scale. `scoresByCategory` already buckets
only what is present, so this is its behaviour rather than an added filter, and it is worth stating precisely
because "add the missing categories as 100" is the obvious-looking improvement someone will propose.

**The critical cap stays off**, matching `routes[].score`. A cap that holds a whole category at 79 is a
site-level signal; applying it per route would make one route's `critical` look like every route's problem.

`routes[].score` itself does not change.

## `routes[].score` is not guaranteed to be the mean of `routes[].categories`

**Whether they agree depends on the shape of the project, and the two available measurements point opposite
ways** — so neither can be presented as the typical case.

| corpus                                                 | keys                          | agreement                                              |
| ------------------------------------------------------ | ----------------------------- | ------------------------------------------------------ |
| the repo's fixtures                                    | 51 across nine projects       | 98% (50/51) — but 46 of the 51 carry a single category |
| a 200-page project from the repo's own bench generator | 413, 400 of them two-category | **52% (213/413)**                                      |

**The rule is about ratios, not category counts.** A key agrees exactly when **every category on it scores the
same ratio**, because then the union of the parts and the mean of the parts are the same number. Two very
different-looking keys are both that case:

- a **single-category** key — the bucket _is_ the whole result set, so both numbers come from the identical
  `computeScore` call. Exact and unbreakable: 59 of 59 single-category keys across both corpora agree, and no
  counterexample is constructible.
- a **clean multi-category** key — every ratio is zero, so `{ architecture: 100, performance: 100 }` agrees for
  the same reason. **Clean keys are most keys on a healthy project.**

That second case is what an earlier draft missed, and missing it made the rule contradict the table above it:
200 of the synthetic corpus's 400 multi-category keys agree, all of them clean, while only 13 of its 213
agreements are single-category. A rule keyed on category count predicts 3% agreement for a corpus measured at
52%.

Neither corpus predicts what a given project will show. Minimal fixtures are mostly single-category, which is a
property of minimal fixtures; the synthetic generator's pages are uniformly flawed, which is not how a real
project looks. With 276 findings across 585 keys, most of the field project's keys are clean — and clean keys
agree.

**When the ratios do differ the mean usually disagrees, systematically once the gap exceeds a point** — every
dirty page in the synthetic corpus, six points apart. "Usually" is the right word, because three exceptions are
real and two of them are ordinary:

1. **A sub-point gap collapses under flooring.** One `seo` `info` beside a clean `performance` gives
   `{ seo: 99, performance: 100 }`; the raw mean is 99.545 and the raw union 99.275, and both display **99**.
   That is the most common shape of a lightly-flawed page.
2. **Equal observed inventories force agreement whatever the ratios**, for any number of categories — the
   identity is `Σ(fⱼ/i)/k = (Σfⱼ)/(k·i)`. Verified at `k = 2`, `i = 28` each, `f = 5` and `f = 10` (both
   display **73**) and at `k = 3`, `i = 30` each, `f = 3/12/24` (both exactly 56.666666666666664). For two
   categories these are provably the **only** exceptions besides equal ratios: mean and union coincide exactly
   when `(i₂ − i₁)(f₁i₂ − f₂i₁) = 0`. That proof is for `k = 2` only; exception 3 exhibits coincidences at
   `k ≥ 3` that neither condition explains. Reachable by ordinary configuration, since turning rules off
   shrinks an inventory.
3. **Sporadic exact coincidences exist under the pristine default registry**, with neither equal ratios nor
   equal inventories. One verified here end to end, on a component-only key carrying all five categories —
   `seo` 5/5, `performance` 0/9, `correctness` 56/96, `security` 35/35, `architecture` 6/8 — where the union
   and the mean are both a deficit of exactly 200/3 and agree as doubles, not merely after flooring.

   No count is given. A reviewer's exhaustive search reported one, then corrected it on a second pass after
   finding the first had silently skipped part of the space; the existence of such keys is what matters here,
   and a number this design cannot reproduce is the kind of figure it has already got wrong twice.

   Two cautions for anyone who recomputes: the coincidence depends on the **observed** inventory, not the
   category's nominal one — a key observing `performance` at 37 (its route and component pairs together) can
   coincide where the same failures at its component-only 9 give 56.43 against 63.69 — and "coincide" means
   equal as exact rationals. As doubles the two can sit one ulp apart, 63.69047619047619 against
   63.69047619047618, which is why the agreement metric throughout this section is the displayed value.

So the user-facing wording stays **not guaranteed** in both directions, and the reason is now a rule rather
than a frequency.

The disagreement, where it happens, is not a rounding artefact. Every dirty page key in the synthetic project
reads `score: 92` against a floored mean of 86 — `{ seo: 97, performance: 75 }` — because the union ratio
weights by inventory while the mean weights the categories equally.

The single measured instance, worked through:

| value                    | denominator                           | result  |
| ------------------------ | ------------------------------------- | ------- |
| `routes[].score`         | the union of observed pairs, 110 + 28 | **96**  |
| `categories.seo`         | 110                                   | **95**  |
| `categories.performance` | 28                                    | **100** |

The mean of 95 and 100 is 97.5, not 96. `routes[].score` is one ratio against everything the route was
measured against; each category score is a ratio against that category's own inventory. Both are correct and
they answer different questions.

Three drafts of this section were wrong in three different ways, recorded because the error moved each time.
The first stated the non-coincidence flatly and generalised it to "a mean of ratios with different denominators
is not the ratio of the sums", which is not a theorem. The second called it a rare exception, on the strength of
a fixture corpus that turned out to be atypical. The third keyed the rule to category count, which contradicted
its own measurements, because a clean multi-category key agrees. The honest form is the heading: **not guaranteed**, agreeing
by construction in one shape and disagreeing systematically in the other. The docs must use that wording in
both directions — a flat "it does not average" is contradicted by any single-category route and by any clean
one, and a flat "it does" by any page whose categories score differently by more than flooring absorbs.

This is the third level of the scoring model where an aggregate is not guaranteed to be re-derivable from the
parts below it — after `computeHealth` over category scores, and a category score over its key scores. Same
cause each time: division and flooring happen at each level.

## Cost

**61 bytes per route**, measured with the field implemented rather than estimated: the fixture's report goes
from 67,656 to 69,003 bytes over 22 routes — 1,347 bytes. At the field project's 351 routes that is roughly
21 KB. The first draft guessed 45 bytes and was 35% low across all three figures.

That cost is only safe to take because `872cf859` fixed the truncation that discarded everything past the
first 65,536 bytes of a piped report. Growing the report before that fix would have moved more of it past the
cliff.

`packages/core/src/reporter/app-shell.ts` spreads each route (`{ ...route, issues: … }`), so the field reaches
the HTML report's embedded snapshot and the dev dashboard without further wiring at runtime. Nothing renders
it yet; that is a separate decision about those surfaces, not a gap this design leaves.

**At compile time it is not free.** A required `categories` on `JsonReport['routes']` breaks eight literal
route constructions that a text search for the type name cannot find — four in
`packages/core/test/html-report.test.ts`, and four across `packages/vite/test/app-shell-static.test.ts` and
`packages/vite/test/ui-dashboard.test.ts`. The CLI and the markdown reporter compile clean. So the
implementation must `tsc --noEmit` **each package separately** after rebuilding core, which is how the
equivalent break was found late on an earlier branch.

## Testing

1. **A route's category score matches scoring that route's results in that category alone.** Assert an exact
   value derived from the formula, not from what the reporter printed.
2. **A category absent from a route's results is absent from its map** — not present as 100. This is the
   dishonesty guard; a test asserting only "seo is present" would pass on an implementation that filled every
   category in.
3. **`routes[].score` is unchanged** by this addition, on a fixture where it and the category scores disagree.
   That disagreement is the point of the section above, so the test pins both numbers on the same input.
4. **The critical cap is off per route, asserted on `routes[].categories[cat]` specifically.** A route carrying
   one failing `seo` `critical` must show `categories.seo` at the ratio's value — 86 on the current registry —
   not 79. Asserting `routes[].score` instead would pass on a broken implementation, because that path is
   already cap-free; this test only holds anything if it names the category map.
5. **`scoresByCategory`'s existing callers are unchanged.** Called without options it must still cap, because
   `computeHealth` depends on a capped category pulling Health down. Assert the capped value through
   `scoresByCategory(rs, config)` and the uncapped one through
   `scoresByCategory(rs, config, { applyCriticalCap: false })` on the same input.
6. **The field survives the HTML report's snapshot**, since `app-shell.ts` spreads the route object — one
   assertion that the embedded snapshot carries `categories` for a route, so the spread is not silently
   replaced by an explicit field list later.
7. **The documented shape matches.** `docs/src/content/docs/guides/(reporting)/reporters.md` and its Japanese
   counterpart show the `routes[]` shape; the sample must gain the field, and the prose must say what it means
   and that it is **not guaranteed** to average to `score` — not that it does not, which the reader's own
   report would contradict on most routes.

## Deliberately not solved

- **Rendering it.** The HTML report and the dev dashboard receive the field and ignore it. Whether a per-route
  category breakdown belongs in either UI is a design question about those surfaces.
- **Making the aggregates re-derivable.** The three-level non-derivability described above is a consequence of
  flooring at each level, and every alternative trades it for something worse — the predecessor spec worked
  through this for `computeHealth` and chose deficit space precisely to keep the top of the scale honest.
  Exposing the parts, which is what this change does, is the answer available.
- **A per-route `scoreModel`.** See above; every field would be constant.
