---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/each-key` and `correctness/each-index-key` no longer lose a constant list's exemption when a parameter or an `{#each}` item elsewhere in the component has the same name.
