---
'svelte-vitals': patch
---

`seo/single-h1` and `seo/heading-level-skip` read a `<svelte:boundary>`'s `failed` and `pending` snippets as alternatives to its content, not as rendering beside it. An error-page `<h1>` in a root layout's `{#snippet failed()}` no longer adds a second `<h1>` to every page, and no longer stands before the page's first heading as a level skip.
