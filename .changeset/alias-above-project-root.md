---
'svelte-vitals': patch
'@svelte-vitals/core': patch
---

A `kit.alias` whose value climbs above the project root (`$plugins: '../../plugins'` in a monorepo app) now resolves, for files inside the directory it names and relative imports between them. Source analysis used to stop at the project root, so a route that renders its `<title>`, meta tags or `<h1>` through such an alias was reported as missing them, including critical `seo/title-presence` findings. Those components' tags and headings now count toward every head and heading rule, which can surface findings such as `seo/title-length` or `seo/indexability` from them, and the import-following rules (`architecture/private-scope-import`, `architecture/route-component-import`, `security/shared-state-import`, `security/handler-state-write`) now see modules there too. Nothing else above the project root is read.
