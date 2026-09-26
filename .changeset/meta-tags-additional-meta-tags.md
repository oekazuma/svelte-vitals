---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

The `svelte-meta-tags` adapter now reads `additionalMetaTags`: each inline `{ property | name, content }` entry counts as that `<meta>`, so an `og:image` or `twitter:image` passed there is no longer reported missing. An entry or list it cannot read inline counts as a meta of any name, which only keeps meta tags from being reported missing.
