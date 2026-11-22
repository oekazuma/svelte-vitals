---
'svelte-vitals': patch
---

`correctness/orphan-effect` now reports an `$effect` called as the argument of `$effect.root` (`$effect.root($effect(() => {}))`), which runs at module evaluation like any other top-level `$effect`. An `$effect` inside an `$effect.root(() => …)` callback is still not reported.
