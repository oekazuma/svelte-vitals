---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add SEO028–SEO030 (#61), reusing existing capture (no parser changes):

- **SEO028** Duplicate title: flags routes that share an identical static `<title>`.
- **SEO029** Duplicate description: flags routes that share an identical static
  meta description.
- **SEO030** Heading order: flags a skipped heading level (e.g. `<h2>` straight
  to `<h4>`); single-`<h1>` presence stays SEO027.
