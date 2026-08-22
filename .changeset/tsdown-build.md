---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Build the packages with tsdown instead of tsup. Public entry points and type surface are unchanged; only the internal chunk layout of `dist/` differs.
