---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/each-key` and `correctness/each-index-key` keep the imported-constant-list exemption when the exporting module reads the list through a `const` alias (`const labels = custom ?? DAYS`, or one branch of `?:`); a write through the alias still keeps the list keyed.
