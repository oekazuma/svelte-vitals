---
'svelte-vitals': patch
---

Fix monorepo app detection (`discoverApps`, and `install --app`) to recognize a SvelteKit app that has no `svelte.config.{js,ts}` — current `sv create` output folds SvelteKit's adapter/compiler config directly into the `sveltekit()` plugin call in `vite.config.ts` and no longer emits a separate `svelte.config` file. Detection now also accepts a `package.json` declaring `@sveltejs/kit`, mirroring `detectProject`'s existing rule. Previously such an app was silently invisible to `svelte-vitals` (from a monorepo root) or `svelte-vitals install --app <dir>` (explicit `--app` failed with "not a SvelteKit app").
