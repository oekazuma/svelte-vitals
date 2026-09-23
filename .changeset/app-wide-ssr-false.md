---
'@svelte-vitals/core': patch
---

A root `src/routes/+layout.ts` (or `+layout.server.ts`) that exports `ssr = false` now counts as turning SSR off for the whole app, as long as no other `+page`/`+layout` file exports `ssr` with a different value. In such an app `correctness/instance-browser-global` no longer flags components, and `correctness/server-browser-global`, `security/handler-state-write` and `security/shared-state-import` no longer flag universal `+page.ts`/`+layout.ts` files: none of that code runs on the server. Server files (`+page.server.ts`, `+server.ts`, `hooks.server.ts`) are still checked.
