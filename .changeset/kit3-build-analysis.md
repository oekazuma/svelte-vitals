---
'@svelte-vitals/vite': patch
---

The build-time analysis now runs under SvelteKit 3. SvelteKit 3 prerenders in Vite's `buildApp` phase, after every `closeBundle`, so the plugin found no prerendered pages there and printed no report, wrote no `outFile` and never failed the build.
