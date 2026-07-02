---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add **PERF010 (namespace import)** — the remaining Bundle slice of #69. Flags a
value `import * as X from '<bare package>'`, which keeps the whole module in the
bundle and defeats tree-shaking; named imports are preferred. Type-only and
non-bare (relative / `$lib` / `$app` / `#…`) namespace imports are not flagged.
Reported under `performance` (info). `ComponentFacts` gains `namespaceImports`.
