---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add CORRECT006 (critical): flag orphan `$effect` calls that throw `effect_orphan` at runtime — a top-level `$effect` in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>`, and a module-scope `new` of a class whose constructor creates a bare `$effect`. `.svelte.ts`/`.svelte.js` runes modules are now analyzed by the component-facts pipeline.
