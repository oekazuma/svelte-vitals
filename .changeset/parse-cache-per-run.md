---
'svelte-vitals': patch
---

Parse each source file at most once per static-mode run: shared layouts and components imported by many routes were previously re-parsed per route.
