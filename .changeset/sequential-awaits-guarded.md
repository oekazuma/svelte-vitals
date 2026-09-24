---
'@svelte-vitals/core': patch
---

`performance/sequential-awaits` no longer reports an await that only runs when an earlier await's result says so, such as `list[0]?.org ?? (await loadOrg())` or `canRegister ? await validate() : null` where `canRegister` comes from an earlier await. The earlier result decides whether the request starts at all, so the two cannot run in parallel. `performance/load-waterfall` now counts such an await as a dependent hop.
