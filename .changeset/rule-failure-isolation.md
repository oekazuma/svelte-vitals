---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A rule that throws no longer kills the analysis: the run completes without it, its id and error surface as a warning, and its weight is removed from that run's Health denominator so the score is not silently inflated — in both the CLI and the vite plugin's build mode. Previously the CLI died with exit 2 and the vite plugin skipped the entire analysis (and its build gate) with a single "analysis failed" warning; both now finish with real results for every other rule.
