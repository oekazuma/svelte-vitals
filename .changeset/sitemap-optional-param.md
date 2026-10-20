---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/sitemap-xml` now counts a `+server` endpoint whose route name takes an optional parameter, such as `src/routes/sitemap[[page]].xml/+server.ts`, as serving `/sitemap.xml`: SvelteKit answers the bare name through it too. It no longer reports such a project as missing a sitemap.
