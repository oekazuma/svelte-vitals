---
'@svelte-vitals/core': patch
---

`seo: { indexable: false }` now also turns off `seo/description-presence`, `seo/duplicate-title`, `seo/duplicate-description`, `seo/hreflang` and `seo/ssr-disabled`. Each only matters for a page that appears in a search result, so a project that declares itself not indexed no longer gets these findings. An explicit `rules` entry still re-enables any of them.
