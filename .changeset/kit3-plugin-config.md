---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

SvelteKit 3: `alias`, `files.lib` and `router.type` are read from the options passed to `sveltekit()` in the Vite config, and `dev` and `building` are recognized from `$app/env`.
