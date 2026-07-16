---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add CORRECT007 (critical): flag Svelte lifecycle/context calls (`onMount`, `getContext`, `setContext`, …) that run outside component initialisation and throw `lifecycle_outside_component` at runtime — at module scope in runes modules and `<script module>`, in constructors of module-scope-instantiated classes, and inside SvelteKit load/action/endpoint handlers (the classic `getContext`-in-`load` trap).
