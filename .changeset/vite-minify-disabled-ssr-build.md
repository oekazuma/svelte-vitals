---
'@svelte-vitals/vite': patch
---

Fix `performance/minify-disabled` never reporting during a real SvelteKit `vite build`. The plugin captured `build.minify` only from the client build's resolved config, but SvelteKit runs the client build as a separate `vite.build()` with a fresh plugin instance, so the instance that analyzes the prerendered output never saw it. The plugin now reads the user's `build.minify` in its `config` hook — the same value SvelteKit forwards to the client build — so a `minify: false` in `vite.config.*` is reported (and gated) in build mode again, including projects whose routes are all `csr: false`.
