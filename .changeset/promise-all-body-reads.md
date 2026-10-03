---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/load-waterfall` and `performance/sequential-awaits` no longer count `await Promise.all([a.json(), b.json()])`, which only reads the bodies of responses already received, as a hop.
