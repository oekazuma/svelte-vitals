---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Landmark collection now resolves ARIA fallback role lists (`role="section main"`) the way user agents do — the first token naming a concrete role — instead of taking the first token unconditionally. A list whose first token is abstract or unrecognized (`role="section main"`) now resolves to `main` in both the source and rendered providers, matching browser behavior, so `a11y/duplicate-landmark` and `a11y/top-level-landmark` no longer miss or misreport landmarks introduced through such lists.
