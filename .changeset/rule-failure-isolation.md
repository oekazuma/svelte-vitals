---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

A rule that throws no longer kills the analysis: the run completes without it, its id and error surface as a stderr warning, and its weight is removed from that run's Health denominator so the score is not silently inflated. Previously such a run died with exit 2; it now finishes with real results — a behavior change only for runs that were already failing.
