---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

A less severe finding now costs less than a more severe one, and the report says how much of a project each
category touched.

A key's category score is the share of that category's severity weight that survived, so a finding's cost
depends on how much that category checks. Where a category checked very little, a single `info` could cost
more than a `warning` elsewhere — measured on a real project, an `info` took 13 points off a key while a
`warning` took 5 — and a category holding one rule scored a key **0** for one finding. A key is now never
scored against less than 25 points of checks, which orders `info` below `warning` everywhere and turns that
0 into 80.

Scores rise wherever a category checks few things. **A `--min-health` gate calibrated on the previous release
will pass more easily; recalibrate it.**

Because a score is a mean over every key, forty affected keys and one affected key can display alike. Each
category in the JSON report now carries `keys` and `affectedKeys`, which distinguish them exactly, and
an `inventories` map giving the divisor behind every key, so the arithmetic can be checked.
