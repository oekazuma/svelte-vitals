---
'@svelte-vitals/core': patch
'@svelte-vitals/vite': patch
---

Refine the JSON-LD rules to cut false positives: SEO018 no longer flags `@id`
(a node identifier, often a relative fragment) and now accepts any URI scheme
(`data:`/`mailto:`/`urn:`) and protocol-relative URLs; SEO019 accepts schema.org
reduced-precision dates (`2026`, `2026-06`); SEO021 treats empty/blank required
values as missing. Rendered-mode capture reads `<script>` via `rawText` so HTML
entities (e.g. `&quot;`) are no longer decoded and the JSON stays intact.
