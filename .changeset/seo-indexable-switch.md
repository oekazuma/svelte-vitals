---
'svelte-vitals': minor
'@svelte-vitals/core': minor
'@svelte-vitals/vite': minor
---

New config switch `seo: { indexable: false }` for projects that never appear in a search result. It turns off `seo/canonical-url`, `seo/og-title`, `seo/og-description`, `seo/og-image`, `seo/og-url`, `seo/twitter-card`, `seo/json-ld`, `seo/sitemap-xml`, `seo/sitemap-in-robots`, `seo/title-length`, and `seo/description-length`, replacing the block of `'off'` entries a private app writes by hand. `seo/single-h1` and `seo/robots-txt` stay on, and an explicit `rules` entry still wins over the switch.
