---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/sequential-awaits` and `performance/load-waterfall` now follow a result through a `for…of`/`for…in` loop variable and into a list filled with `push()` (or `unshift`, `splice`, `add`, `set`). An await that uses such a list, built from an earlier await's data, is recognised as dependent on it: `performance/sequential-awaits` no longer reports it as needlessly sequential, and in a universal `load` `performance/load-waterfall` now counts it as a step of a request chain.
