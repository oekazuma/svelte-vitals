---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Source analysis reads more of `src/app.html`'s `<head>`, which renders on every route. A `<script type="application/ld+json">` there now counts as the route's JSON-LD (`seo/json-ld` no longer reports it missing), with a dynamic value when its body holds a `%…%` placeholder, and a `<link rel="preconnect">` or `rel="dns-prefetch"` counts as the hint `performance/preconnect` looks for. A tag carrying a `%…%` placeholder (SvelteKit's own, such as `%sveltekit.assets%`, or one a `transformPageChunk` hook replaces, such as `%title%`) now counts as present with a dynamic value, judged by `treatDynamicAs`, instead of being ignored or read as the literal placeholder text. So a `<title>%title%</title>` is no longer measured by `seo/title-length` as seven characters, and a `<meta property="og:image" content="%sveltekit.assets%/og.png">` is no longer reported missing; a shell title or description filled by a hook is no longer reported by `seo/duplicate-title` or `seo/duplicate-description`, because its value is unknown.
