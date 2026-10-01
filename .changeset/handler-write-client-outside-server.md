---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`security/handler-state-write` no longer reports a handler's `.set()`/`.update()` on a repo-local import outside `src/lib/server` when the target module exports that binding as a client: `new` of a class imported from an installed package, or of a class the module declares that extends nothing and keeps no `Map`/`Set`/`WeakMap`/`WeakSet` field (`export const kv = new KvService()`), or a call into an installed package (`drizzle(url)`, `createClient(…)`) after resolving the app's `kit.alias` entries. Store factories from `svelte/store` or a `*store*` package stay reported.
