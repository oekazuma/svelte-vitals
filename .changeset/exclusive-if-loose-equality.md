---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1` and `seo/heading-level-skip` also read `{#if}` blocks comparing one value with `==` to different numbers (`{#if step == 0}`, `{#if step == 2}`) as arms of one block; loose comparisons to strings can both hold (`x == '0'`, `x == '00'`) and are not.
