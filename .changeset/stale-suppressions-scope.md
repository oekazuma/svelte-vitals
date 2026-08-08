---
'svelte-vitals': patch
---

Scoped runs (`--diff`/`--staged`/`--baseline`) no longer report `svelte-vitals-suppressions.json` entries as stale just because the scope excluded their findings — staleness is now judged against the project-wide result set, so the documented CI recipe (`--diff origin/main --baseline origin/main`) no longer prints a misleading "N stale entries — re-run --update-suppressions to prune" on every run. `--route` runs, where even the project-wide set is collected route-narrowed, omit the stale count entirely rather than report an unreliable one. `--update-suppressions` combined with `--route` now refuses (exit 2) instead of silently pruning suppression entries outside that route.
