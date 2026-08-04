# Per-route category scores in the JSON report — design

**Date:** 2026-08-04
**Status:** approved
**Origin:** the third follow-up recorded by `2026-07-31-score-honesty-design.md`, whose successor
`2026-08-04-score-proportionality-design.md` sharpened it: "a reader who wants to know why a category moved
now has to reconstruct a ratio per key rather than a subtraction."

## The problem

The report says what each route scored and what each category scored. It does not say **what a route scored in
a category**, so the one number a reader wants when a category looks wrong — which routes dragged it there —
has to be guessed from the issue list.

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
`Array<{ route: string; score: number; categories: Record<string, number>; issues: JsonIssue[] }>`, filled by
calling the already-exported `scoresByCategory` on that route's own results.

Three decisions, each of which could reasonably have gone the other way:

**Scores only, no `scoreModel`.** The top-level `categories` carries `{ score, scoreModel }`, and mirroring it
here would be symmetric and useless: a route's results contain no project-scoped findings, so `sitePenalty` is
always 0, and the critical cap is disabled on this path, so `criticalCap` is always null. `routeAverage` would
restate `score`. Three fields that cannot vary are noise, not symmetry.

**Only the categories that produced a result on that route.** A route with no `architecture` result must not
appear with `architecture: 100`. That would claim a measurement that never happened — the same dishonesty
`2026-07-31-score-honesty-design.md` exists to remove, at a smaller scale. `scoresByCategory` already buckets
only what is present, so this is its behaviour rather than an added filter, and it is worth stating precisely
because "add the missing categories as 100" is the obvious-looking improvement someone will propose.

**The critical cap stays off**, matching `routes[].score`. A cap that holds a whole category at 79 is a
site-level signal; applying it per route would make one route's `critical` look like every route's problem.

`routes[].score` itself does not change.

## The relationship that will surprise a reader, stated so it is not discovered as a bug

**`routes[].score` is not the mean of `routes[].categories`.** Measured on one route carrying a failing `seo`
`warning` beside a passing `performance` route rule:

| value                    | denominator                           | result  |
| ------------------------ | ------------------------------------- | ------- |
| `routes[].score`         | the union of observed pairs, 110 + 28 | **96**  |
| `categories.seo`         | 110                                   | **95**  |
| `categories.performance` | 28                                    | **100** |

The mean of 95 and 100 is 97.5, which is not 96. `routes[].score` is one ratio computed against everything the
route was measured against; each category score is a ratio computed against that category's own inventory.
Both are correct and they answer different questions.

This is the third place in the scoring model where an aggregate is not re-derivable from the parts below it —
after `computeHealth` over category scores, and a category score over its key scores. The pattern is the same
each time and has the same cause: flooring and division happen at each level, and a mean of ratios with
different denominators is not the ratio of the sums. Recorded here rather than left for a reader to file.

## Cost

About 45 bytes per route — measured against the repo's own fixture, 22 routes, roughly 1 KB on a 67,656-byte
report. At the field project's 351 routes, roughly 16 KB.

That cost is only safe to take because `872cf859` fixed the truncation that discarded everything past the
first 65,536 bytes of a piped report. Growing the report before that fix would have moved more of it past the
cliff.

`packages/core/src/reporter/app-shell.ts` spreads each route (`{ ...route, issues: … }`), so the field reaches
the HTML report's embedded snapshot and the dev dashboard without further wiring. Nothing renders it yet; that
is a separate decision about those surfaces, not a gap this design leaves.

## Testing

1. **A route's category score matches scoring that route's results in that category alone.** Assert an exact
   value derived from the formula, not from what the reporter printed.
2. **A category absent from a route's results is absent from its map** — not present as 100. This is the
   dishonesty guard; a test asserting only "seo is present" would pass on an implementation that filled every
   category in.
3. **`routes[].score` is unchanged** by this addition, on a fixture where it and the category scores disagree.
   That disagreement is the point of the section above, so the test pins both numbers on the same input.
4. **The critical cap is off per route.** A route carrying a `critical` scores what the ratio gives, not 79.
5. **The field survives the HTML report's snapshot**, since `app-shell.ts` spreads the route object — one
   assertion that the embedded snapshot carries `categories` for a route, so the spread is not silently
   replaced by an explicit field list later.
6. **The documented shape matches.** `docs/src/content/docs/guides/(reporting)/reporters.md` and its Japanese
   counterpart show the `routes[]` shape; the sample must gain the field, and the prose must say what it means
   and that it does not average to `score`.

## Deliberately not solved

- **Rendering it.** The HTML report and the dev dashboard receive the field and ignore it. Whether a per-route
  category breakdown belongs in either UI is a design question about those surfaces.
- **Making the aggregates re-derivable.** The three-level non-derivability described above is a consequence of
  flooring at each level, and every alternative trades it for something worse — the predecessor spec worked
  through this for `computeHealth` and chose deficit space precisely to keep the top of the scale honest.
  Exposing the parts, which is what this change does, is the answer available.
- **A per-route `scoreModel`.** See above; every field would be constant.
