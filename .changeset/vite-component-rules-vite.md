---
'@svelte-vitals/vite': minor
---

Build mode now additionally scans `.svelte` source under `src/` and runs Correctness, Security, Architecture, and the two component-scoped Performance rules (PERF009/PERF010) — the same rules the CLI and MCP already run — enabled by default alongside the existing rendered-HTML SEO/Performance checks. The dev overlay is unchanged (still SEO/Performance-only, rendered-HTML-based). Use the existing `rules` option to opt individual rules out, e.g. `{ CORRECT002: 'off' }`.
