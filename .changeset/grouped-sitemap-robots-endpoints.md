---
'svelte-vitals': patch
---

`seo/sitemap-xml` and `seo/robots-txt` now find a `sitemap.xml` or `robots.txt` `+server` endpoint inside a route group, such as `src/routes/(marketing)/sitemap.xml/+server.ts`. Groups add no URL segment, so the endpoint serves `/sitemap.xml`, but the CLI reported the file as missing.
