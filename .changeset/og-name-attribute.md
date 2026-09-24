---
'@svelte-vitals/core': patch
---

`seo/og-title`, `seo/og-description`, `seo/og-image` and `seo/og-url` no longer say "Missing" when the tag is written as `<meta name="og:…">`. The finding now says that the tag should use `property=` and how to change it, since Open Graph reads these keys from the `property` attribute. The attached fix edits the attribute instead of adding a second tag.

The finding keeps its rule id, route and location, so a `svelte-vitals-suppressions.json` entry recorded for the old "Missing" finding on that route already suppresses the new message.
