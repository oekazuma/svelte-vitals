---
'svelte-vitals': patch
---

Internal refactor: component-facts source parsing (`parseComponentFacts` and its shared AST utilities) moved to `@svelte-vitals/core` so `@svelte-vitals/vite` can reuse it. No user-facing behavior change.
