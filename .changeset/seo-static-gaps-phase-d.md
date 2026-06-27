---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add SEO024–SEO027, the remaining statically-analyzable SEO checks:

- **SEO024** — Character encoding: flags a rendered page with no `<meta charset>`
  (lives in app.html, so rendered-only, like the viewport rule).
- **SEO025** — Image alt text: flags an `<img>` with no `alt` attribute (empty
  `alt=""` is valid decorative; static/CLI mode only, like the perf image rules).
- **SEO026** — hreflang validity: opt-in check of `<link rel="alternate"
hreflang>` alternates — malformed codes, or 2+ alternates without an x-default.
- **SEO027** — Heading hierarchy: flags zero or multiple `<h1>` per page (exactly
  one passes; layout-chain headings count). Introduces a page-body headings
  channel collected by both providers.
