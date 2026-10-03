---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1`, `a11y/id-duplication` and `a11y/duplicate-landmark` decide a component's `{#if}` that joins prop tests with `&&` or `||` (`{#if showcase && layout === 'cover'}`) when the use decides each of them, as they already did for a single prop's test.
