---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1` and `seo/heading-level-skip` also read `{#if}` blocks comparing one value with `==` to different literals of one type (`{#if step == 0}`, `{#if step == 2}`) as arms of one block.
