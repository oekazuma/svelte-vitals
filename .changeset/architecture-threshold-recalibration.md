---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Recalibrate the Architecture thresholds against real Svelte code: `architecture/prop-count` now flags more than 6 props (was 10) and `architecture/component-size` flags components longer than 200 lines (was 400).

Both numbers were previously guesses. They are now derived by measuring 2,239 components across 7 real Svelte 5 codebases and taking the median of each repository's 90th percentile — the same benchmark-based method ReactSniffer uses for React. At the old values these rules almost never fired on a typical Svelte project.

Expect new `info` findings on existing projects. The Architecture score itself will barely move: component-scoped rules score per file (each flagged file loses 1 point for an `info` finding, then per-file scores are averaged across the project), so more than half of a project's components would have to be flagged before the Architecture score drops by even a single point. Nothing fails by default, since `failOn` defaults to `'critical'` — but if you run with `--fail-on info` or `failOn: 'info'` in `svelte-vitals.config.mjs` (including the Vite plugin's build mode, where it fails the `vite build`), components that passed before this change will now fail. Turn a rule off in `svelte-vitals.config.mjs` (`rules: { 'architecture/prop-count': 'off' }`) if its default does not suit your codebase — per-rule thresholds are not configurable yet.
