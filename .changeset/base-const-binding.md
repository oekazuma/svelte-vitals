---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/base-path-navigation` follows `paths: { base }` to a top-level `const base = ''` and stays silent, as it does for an explicit `base: ''`.
