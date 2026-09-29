---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/json-ld` now also reads `{@html}` as JSON-LD when the source calls it structured data (`{#each structuredData as ld}{@html ld}{/each}`), or when it renders a script binding built by a function named for JSON-LD (`const siteLd = jsonLd(data)`).
