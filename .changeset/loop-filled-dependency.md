---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/sequential-awaits` and `performance/load-waterfall` read a container that a callback over an earlier await's result fills (`lists.forEach((l) => ids.add(l.id))`) as carrying that result, so a later await that reads it is dependent.
