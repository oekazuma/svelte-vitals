---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1`, `a11y/id-duplication` and `a11y/duplicate-landmark` decide a component's `{#if}` on a member of an undestructured `$props()` binding (`let props = $props()`, `{#if props.withHeading}`) like one on a destructured prop.
