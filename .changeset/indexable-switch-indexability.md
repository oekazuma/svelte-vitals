---
'@svelte-vitals/core': patch
---

`seo: { indexable: false }` now also turns off `seo/indexability`. The switch already states that the project's `noindex` is intentional, so the rule's "verify this is intentional" finding no longer keeps a rendered build below 100.
