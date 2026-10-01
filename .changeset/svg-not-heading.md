---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1` and `seo/heading-level-skip` no longer read anything inside an `<svg>` (without a `<foreignObject>`) as a possible heading. An icon component that draws its shapes with `<svelte:element this={tag}>` (lucide's `Icon.svelte`) no longer makes every route that renders it skip the "Missing `<h1>`" check, so a route with icons and no `<h1>` is reported again.
