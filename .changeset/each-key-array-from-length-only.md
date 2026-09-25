---
'@svelte-vitals/core': patch
---

`correctness/each-key` and `correctness/each-index-key` treat `Array.from(<length-only list>)`, such as `Array.from(new Array(n))` or `Array.from(Array(n).keys())`, as a length-only placeholder list, like `Array.from({ length: n })`.
