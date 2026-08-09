---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

The independent collection passes (routes, components, Kit modules, source files) now run concurrently instead of sequentially, shortening analysis wall time on larger projects. Same file reads, same results — only the awaiting overlaps.
