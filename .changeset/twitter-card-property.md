---
'@svelte-vitals/core': patch
---

`seo/twitter-card` no longer reports a route as missing its card when the tag is written `<meta property="twitter:card">`. X reads `property=` as a fallback, so the card renders.
