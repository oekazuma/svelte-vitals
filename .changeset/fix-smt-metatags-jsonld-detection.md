---
'svelte-vitals': patch
---

Detect Open Graph (`og:description`, `og:url`), `twitter:card`, and JSON-LD tags emitted by `svelte-meta-tags` (`MetaTags` / `JsonLd`) in static mode. Inline `openGraph` / `twitter` object literals are now introspected key-by-key, non-literal configs fall back to broad coverage, and the `JsonLd` component is recognized — resolving SEO008/011/012/013 false positives (#91). The same `openGraph`/`twitter` introspection applies to `svelte-seo`.
