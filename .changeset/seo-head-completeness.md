---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add six SEO checks decidable from the resolved `<head>` and project facts: SEO010 surfaces a
route set to `noindex` (verify intentional), SEO011 Twitter Card, SEO012 Open Graph description,
SEO013 Open Graph URL, SEO014 viewport, and SEO015 (robots.txt should reference your sitemap).
SEO010 only fires on a statically-resolvable `noindex`/`none` (never a dynamic value); robots/
viewport tags placed in `app.html` are covered in plugin/rendered mode.
