---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

A `<link>`'s `rel` is now read as a list of space-separated keywords, as HTML defines it. `<link rel="dns-prefetch preconnect">` counts as a preconnect for `performance/preconnect` (which reported the hint itself as an un-preconnected third-party origin), and `seo/canonical-url`, `seo/hreflang`, `performance/preload-missing-as` and `performance/font-preload-crossorigin` match their keyword inside such a list too.
