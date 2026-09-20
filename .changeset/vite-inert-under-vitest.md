---
'@svelte-vitals/vite': patch
---

The plugin no longer runs its analysis, or prints rule notices, during a Vitest run. Vitest resolves the project's Vite config and starts a dev server to run tests, which used to start the dashboard's whole-project analysis and log into the test output. `vite dev` and `vite build` are unaffected.
