---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/each-key` and `correctness/each-index-key` keep the exemption for a constant list a module exports and hands to a call (`export const KINDS = [...] as const; z.enum(KINDS)`). As the docs say, only the module's own writes take the exemption away.
