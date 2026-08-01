---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Scores are now floored rather than rounded to nearest, so a displayed 100 means the deduction was exactly
zero. Previously a category could print a perfect 100 while carrying hundreds of findings: with 585 score
keys it took 293 `info` findings to move the number off 100, and a finding on every single key still showed 99.

**Every score moves down by 0 or 1 point.** If you gate CI with `--min-health` at or just above your
current score, lower the threshold by one. `--min-health 100` now fails on any finding at all, which is the
honest reading of 100.

Health is also computed differently, though the change is invisible on most projects: it averages the
unrounded category scores and floors once, instead of averaging scores that had each already been rounded.
The old double rounding could move Health two points where the parts moved one.

`architecture/unit-entry-file` no longer adds a score key for each conforming unit. Its pass is still
reported — it is the only evidence the rule ran at all — but it no longer inflates the denominator that
every other finding is averaged against.
