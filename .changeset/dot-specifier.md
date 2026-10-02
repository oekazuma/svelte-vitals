---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

An import from `'.'` or `'..'` (a directory's own index module) now resolves like `'./index'`, so the components and constant lists it re-exports are followed.
