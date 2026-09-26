---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/each-key` and `correctness/each-index-key` now treat copying a constant list into a new array literal (`[...tabs, extra]`) as a read, in the component and in the module an imported list comes from. Such a copy cannot reorder the original, so an `{#each}` over the list is no longer reported. Passing the list, or spreading it anywhere else, still keeps it reported.
