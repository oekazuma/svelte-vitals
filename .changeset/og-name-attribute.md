---
'@svelte-vitals/core': patch
---

`seo/og-title`, `seo/og-description`, `seo/og-image` and `seo/og-url` no longer say "Missing" when the tag is written as `<meta name="og:…">`. The finding now says that the tag should use `property=` and how to change it, since Open Graph reads these keys from the `property` attribute.
