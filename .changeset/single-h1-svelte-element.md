---
'svelte-vitals': patch
'@svelte-vitals/core': patch
---

`seo/single-h1` now reads a `<svelte:element this={…}>` as the element it resolves to when the tag expression is a string literal, or a conditional whose branches are both literals naming one heading level. A tag it cannot determine that way may be the page's `<h1>`, so the route is left unreported instead of flagged `Missing <h1>` — which is what the CLI used to do while `@svelte-vitals/vite` passed the same route.
