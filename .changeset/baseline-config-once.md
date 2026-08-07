---
'svelte-vitals': patch
---

`--baseline` now analyzes the baseline ref under the current checkout's `svelte-vitals.config.*` instead of re-loading the config inside the temporary worktree. This fixes the gate reporting every finding as new when the config imports `svelte-vitals` (as the `install` wizard's `.ts` scaffold does) — the worktree has no `node_modules` in its ancestry, so the import used to throw and the baseline comparison silently degraded to "report everything". It also makes a config-only edit not count as an "introduced" finding, since both sides of the comparison now run under the same rules.
