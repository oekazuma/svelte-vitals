---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/each-key` and `correctness/each-index-key` now skip `{#each}` over a constant list imported as `./state.svelte` from a `state.svelte.ts`/`.svelte.js` runes module, and over a constant list that its module or component also iterates with `for (… of LIST)`.
