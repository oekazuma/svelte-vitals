---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/responsive-image` no longer reports the fallback `<img>` of a `<picture>` whose `<source>` elements carry a `srcset`: the browser picks from those candidates.
