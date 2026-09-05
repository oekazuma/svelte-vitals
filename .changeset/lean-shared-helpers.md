---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`svelte-vitals` now exports `createNodeRuntime`, the Node adapter behind its own analysis, and `@svelte-vitals/vite` uses it instead of carrying a copy, so this `@svelte-vitals/vite` release requires this `svelte-vitals` release. `@svelte-vitals/core`'s `./internal` entry adds `isPlainObject`, which the CLI now imports. No findings change.
