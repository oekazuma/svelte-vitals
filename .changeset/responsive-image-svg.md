---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/responsive-image` no longer reports an SVG `<img>`: a vector image scales to any size from one file, so a `srcset` has nothing to choose between. An image counts as SVG when its `src` path ends in `.svg` (query and fragment ignored) or is an inline `data:image/svg+xml` URI, and, in source analysis, when `src={logo}` names a binding imported from a `.svg` file or the literal tail of a mixed value ends in `.svg` (`src="{base}/rss.svg"`). The other image rules still check SVG images as before.
