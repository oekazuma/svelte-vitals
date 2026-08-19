---
'@svelte-vitals/vite': patch
'@svelte-vitals/core': patch
---

The dev dashboard's live layer (`svelteVitalsHandle`) now runs only the route-scoped rules a single rendered page can answer. `seo/duplicate-title` and `seo/duplicate-description` used to pass on every visited route — one page's head has nothing to collide with — and that pass replaced the static finding in the dashboard, hiding a real duplicate once both routes were visited. Project-scope rules (`seo/robots-txt`, `seo/sitemap-xml`, `seo/html-lang`) no longer run in the live layer either; they used to add a per-visited-route copy of a site-wide result. Core gains `Rule.crossRoute` (internal surface) for the uniqueness rules.
