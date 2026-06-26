---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Validate JSON-LD content, not just its presence (SEO008): SEO016 (valid JSON with @context/@type),
SEO017 (deprecated/restricted rich-result type), SEO018 (relative URLs under known keys), SEO019
(non-ISO-8601 dates under known keys), SEO020 (placeholder text), and SEO021 (required properties for
recognized @types). Only static, parseable JSON-LD is checked — a dynamically-built script is skipped.
