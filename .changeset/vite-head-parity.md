---
'@svelte-vitals/vite': patch
---

Build-time analysis now matches `<meta name>` case-insensitively (`name="Robots"` is read as a robots meta) and finds a `sitemap.xml`/`robots.txt` `+server` endpoint inside a route group such as `src/routes/(marketing)/sitemap.xml/+server.ts`, as source analysis does.
