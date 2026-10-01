---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`security/handler-state-write` no longer reports a handler's `.set()`/`.update()` on a repo-local import outside `src/lib/server` when the target module exports that binding as a client: `new` of a class other than `Map`/`Set`/`WeakMap`/`WeakSet` (`export const kv = new KvService()`), or a call into an installed package (`drizzle(url)`, `createClient(…)`). Store factories from `svelte/store` or a `*store*` package stay reported.
