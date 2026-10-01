---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A page whose `load` first exits on `if (!FLAG)`, where `FLAG` (or `FLAGS.member` of an object literal) is exported as the literal `false` by one of the app's own modules, is read as never rendering, so the route-level rules skip it like a page whose load always redirects.
