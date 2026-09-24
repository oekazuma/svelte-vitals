---
'@svelte-vitals/core': patch
---

`correctness/each-key` and `correctness/each-index-key` no longer report a length-only placeholder list written as `Array(n).fill(x)` or `[...Array(n).keys()]`: like `Array(n)`, every item is either the same value or its own index, so there is no identity a key could track.
