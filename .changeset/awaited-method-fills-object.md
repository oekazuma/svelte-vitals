---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/sequential-awaits` reads a method of an object the load created itself, awaited for its effect alone (`const auth = getAuth(); await auth.initialize()`), as filling that object, so a later await that reads it is dependent rather than reported as independent. In a universal load, `performance/load-waterfall` now reports such a chain as dependent.
