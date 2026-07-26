---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Recalibrate the Architecture thresholds against real Svelte code: `architecture/prop-count` now flags more than 6 props (was 10) and `architecture/component-size` flags components longer than 200 lines (was 400).

Both numbers were previously guesses. They are now derived by measuring 2,239 components across 7 real Svelte 5 codebases and taking the median of each repository's 90th percentile — the same benchmark-based method ReactSniffer uses for React. At the old values these rules almost never fired on a typical Svelte project.

Expect new `info` findings and a correspondingly lower Architecture score on existing projects; each `info` finding deducts 1 point. Turn a rule off in `svelte-vitals.config.mjs` (`rules: { 'architecture/prop-count': 'off' }`) if its default does not suit your codebase — per-rule thresholds are not configurable yet.
