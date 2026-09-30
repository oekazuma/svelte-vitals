---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/lcp-image` places a page's images at its layout's `{@render children()}` when the layout renders its children in one place, so a layout image after the page content is no longer read as the route's first image.
