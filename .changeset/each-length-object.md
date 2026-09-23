---
'@svelte-vitals/core': patch
---

`correctness/each-key` and `correctness/each-index-key` no longer flag `{#each { length: n } as _}` or `{#each { length: n } as _, i (i)}`. Like `Array(n)` and `Array.from({ length: n })`, a `{ length: n }` object is a placeholder list with no item identity to key on.
