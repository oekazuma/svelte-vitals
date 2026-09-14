---
'@svelte-vitals/vite': patch
---

`vite build` no longer reports a route with `ssr = false` as missing its `<title>`, description, `<h1>` and landmarks. SvelteKit prerenders such a route as the empty app shell, so the rendered pass now skips it (a `+layout` with `ssr = false` skips its whole subtree, the root layout skips every route) and prints one warning listing the skipped routes, pointing at `npx svelte-vitals` for their source analysis. The source-level rules still run over the whole project, and an all-shell SPA still writes its report and goes through the `failOn` gate.
