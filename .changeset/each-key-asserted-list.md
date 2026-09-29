---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/each-key` and `correctness/each-index-key` read a member access through a type assertion (`(LIST as readonly string[]).includes(x)`) as a read, so a constant list its module casts keeps its exemption; a mutating call through one (`(list as string[]).push(x)`) still counts.
