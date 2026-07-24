---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
'@svelte-vitals/mcp': patch
---

Scope resolution now treats `{@const ...}` declarations as shadowing bindings for their enclosing fragment, so a write to an `{@const}` alias is no longer misattributed to a same-named top-level `$state` (fewer false positives across the component-analysis rules).
