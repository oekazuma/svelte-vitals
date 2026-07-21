---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add PERF011 (Load waterfall) and PERF013 (Sequential independent awaits): a forward-taint analysis of `load` functions flags dependent await chains in universal loads (move them to a server load) and independent sequential awaits in any load (parallelize with `Promise.all`).
