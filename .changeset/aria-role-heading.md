---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/heading-level-skip` reads an element with `role="heading"` as a heading of its `aria-level` (2 without one), in source analysis and in the Vite plugin's rendered pass; one whose `aria-level` is an expression holds its place without a level. `seo/single-h1` does not count it as an `<h1>`.
