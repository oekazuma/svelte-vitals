---
'@svelte-vitals/core': patch
---

A root `src/routes/+layout.ts` (or `+layout.server.ts`) that exports `ssr = false` now counts as turning SSR off for the whole app, as long as no other `+page`/`+layout` file exports `ssr` with a different value. In such an app `correctness/instance-browser-global` no longer flags components, `security/handler-state-write` and `security/shared-state-import` no longer flag universal `+page.ts`/`+layout.ts` files, and `correctness/server-browser-global` no longer flags their `load` functions: none of that code runs on the server. Module scope of a universal file is still checked, because SvelteKit imports it on the server when it cannot read the page options statically. Server files (`+page.server.ts`, `+server.ts`, `hooks.server.ts`) are still checked.
