---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/each-key` and `correctness/each-index-key` keep the exemption for a constant list a module exports and hands to an imported or built-in function (`export const KINDS = [...] as const; z.enum(KINDS)`). Handing it to a function the module declares still takes the exemption away, since that function could reorder it.
