---
'svelte-vitals': patch
---

`seo/single-h1` no longer reports "Missing `<h1>`" for a route whose `<h1>` comes from a component the CLI cannot follow, such as one from `node_modules`, when that component is given a literal heading tag as an attribute (`<Heading tag="h1">`). Like an undeterminable `<svelte:element>`, such a component may render the page's `<h1>`, so the route is left unreported. Components the CLI can resolve are still followed and judged by what they render.
