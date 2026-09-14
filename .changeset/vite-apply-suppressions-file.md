---
'@svelte-vitals/vite': patch
'svelte-vitals': patch
---

`@svelte-vitals/vite` now applies `svelte-vitals-suppressions.json` (written by `svelte-vitals --update-suppressions`) the way the CLI does: the build gate loads the file from the project root, drops matching findings before scoring and `failOn`, and prints how many were suppressed; the live dashboard's whole-project layer applies it too and re-analyzes when the file changes. A malformed file fails `vite build` as it exits 2 in the CLI (the dashboard warns and ignores it instead). Only source-scan entries apply: route-level entries are skipped on every plugin surface (rendered route findings anchor to the built HTML, and the dashboard's live layer would re-surface them) and the plugin prints how many it skipped, so route-level accepts still go through `overrides`. `svelte-vitals` exports `loadSuppressions`, `applySuppressions`, `SUPPRESSIONS_FILE` and the `SuppressionEntry` type for this.
