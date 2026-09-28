---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1` now also decides a component's `{#if typeof prop === 'string'}` and `{#if prop.length > 0}` (and `>=`, `<`, `<=`, `===`, `!==` against a number) from the use: a literal value, an object or array literal (for `typeof`), or the prop's default. A table card whose `<h1>` renders only when a `title` is passed no longer counts as an extra `<h1>` on pages that pass none, and such a page can now be reported as missing one.
