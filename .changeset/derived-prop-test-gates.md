---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1`, `a11y/id-duplication` and `a11y/duplicate-landmark` decide a component's `{#if}` on a `$derived` that holds a prop test (`const embedded = $derived(variant === 'embedded')`, `{#if embedded}`) like the test itself, when the use passes the prop literally.
