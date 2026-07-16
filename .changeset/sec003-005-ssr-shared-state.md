---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add SEC003–005: SSR shared-state leak detection for SvelteKit server/universal route files. SEC003 (critical) flags load/action/endpoint handlers writing to imported module state; SEC004 (warning) flags module-scope `let`/`var` reassigned from functions in Kit server files; SEC005 (warning) flags server-side imports of `.svelte.ts` modules holding module-scope `$state`. Kit route/hooks files are now analyzed via a new `KitModuleFacts` channel.
