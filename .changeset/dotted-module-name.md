---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

An import from a module whose name contains a dot (`$lib/dua.model`) now resolves to its `.ts`/`.js` file, so `correctness/each-key` exempts a constant list it exports like any other.
