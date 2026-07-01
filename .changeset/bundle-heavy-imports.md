---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add **PERF009 (heavy dependency import)** — the Bundle slice of #69. Flags an
`import` from a well-known heavy / non-tree-shakeable package (`lodash`, `moment`),
matched by exact specifier so subpath imports like `lodash/debounce` pass.
Reported under the `performance` category (info). `ComponentFacts` gains `imports`
(module specifiers from the instance + module scripts).
