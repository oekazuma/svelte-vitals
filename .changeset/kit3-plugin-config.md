---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

The options passed to `sveltekit()` in the Vite config are now read for `alias`, `files.lib` and `router.type`. That is SvelteKit 3's only config home, and SvelteKit 2.62+ accepts it too. `dev` and `building` are recognized from `$app/env` as well as from `$app/environment`.

In an app that passes options to `sveltekit()`, this changes three things. Modules behind an alias declared there are followed, so rules can report in files they did not reach before. A `$lib` alias declared there, which is how a SvelteKit 3 app keeps `$lib`, is used in place of the `src/lib` default. And `svelte.config.js` is no longer read for the hash router, since SvelteKit ignores that file once the plugin has options.
