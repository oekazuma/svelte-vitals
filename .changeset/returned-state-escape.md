---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/unmutated-state` and `performance/state-raw` no longer report a `$state` that a function returns (`return live`), since its caller holds the reference and may mutate it.
