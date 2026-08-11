---
'@svelte-vitals/core': patch
---

seo/json-ld-validity's unknown-`@type` hint now also catches small typos, not just casing: a bare `@type` within edit distance 2 of a real schema.org type gets a `Did you mean 'X'?` suggestion (e.g. `Unknown @type 'Artcle'` now suggests `'Article'`). The free case-insensitive exact match still runs first; the typo scan only runs when that misses. Message-text-only change — finding keys, severities, and gates are untouched.
