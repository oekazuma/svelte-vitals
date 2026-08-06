---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

A less severe finding now costs less than a more severe one **within the same (category, scope) pair**, and
the report says how much of a project each category touched.

A key's category score is the share of that category's severity weight that survived, checks grouped by
category and scope — the keys of the new `inventories` map, like `seo::route`. **Within one pair** a
`warning` costs five times an `info` and a `critical` fifteen times, so a more severe finding always costs
more, there. **Across pairs it does not**: a pair that checks very little is scored against a floor of 25, so
a `warning` there can cost more than a `critical` in a large pair — a `warning` in a floored pair costs 20
while a `critical` in `seo::route` costs 13.64. A key is now never scored against less than 25 points of
checks: in a one-rule pair the three severities give **96** (`info`), **80** (`warning`) and **40**
(`critical`), where a lone `warning` used to score **0**.

Scores rise wherever a category checks few things. **A `--min-health` gate calibrated on the previous release
will pass more easily; recalibrate it.**

Because a score is a mean over every key, forty affected keys and one affected key can display alike. Each
category in the JSON report now carries `keys` and `affectedKeys`, which distinguish them exactly, and
an `inventories` map giving the divisor behind every key of a pair, so a route's per-category score can be
checked by hand (a route's own `score`, which can span more than one pair, cannot).
