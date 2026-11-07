---
'svelte-vitals': patch
---

`seo/single-h1` no longer reports "Missing `<h1>`" on a route that renders a component its `load` data provides (`<data.post.component />`, or `<svelte:component this={data.content}>`), typically a markdown module chosen with `import.meta.glob`, since the source does not show which headings it renders. "Multiple `<h1>`" is reported on such a route as before.
