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

**Any category carrying a finding changes, most of them downward and by more than a point; a clean 100 stays 100.** `seo` and `correctness` stay within a point of their old values; `architecture`, `security` and
`performance` move further, because their scales were the most compressed. A `--min-health` gate calibrated
against the old numbers will start failing — recalibrate it against the new scale. `routes[].score` in the
JSON report changes meaning the same way. Stored baselines are unaffected, since they key on findings rather
than scores.

Unchanged: the site-wide penalty stays in absolute points, a `critical` still caps a category at 79, and a
displayed 100 still means no finding among the checks that ran.
