---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1` now counts, in a component's `{#if}` that one prop decides (`{#if isHome}`, `{#if !title}`, `{#if variant === 'detail'}`), only the arm that prop selects, when the use passes the prop literally or not at all (its default, or `undefined`). A navigation bar whose `<h1>` renders only on the home page is no longer counted as a second `<h1>` on every other page. A prop passed as an expression or spread, bound, or written by the component itself still leaves every arm counted. A page whose only `<h1>` sat in such an arm can now be reported as missing one.
