---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Imports from `'.'` and `'..'` now resolve to the index module of the directory they name, so the components and constant lists it re-exports are followed.
