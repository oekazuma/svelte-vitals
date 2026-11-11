---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`security/handler-state-write` now treats SvelteKit 3's other server-only locations like `src/lib/server`: any `server` directory outside `src/routes` and `static`, and any file with a `server` segment in its name (`db.server.ts`). A handler's `.set()`/`.update()` on an export from one is reported only when that export is positively a store kept in memory. This applies to SvelteKit 2 projects too, although SvelteKit 2 itself knows only `$lib/server` and `*.server.*`: a finding on a write into one of these locations disappears there unless the export is such a store. When the target is a `.svelte.ts` module with module-scope `$state`, the import can then show up as a `security/shared-state-import` warning instead, which a recorded `handler-state-write` suppression does not cover.

Two readings changed with it.

- An export initialized with `writable(…)` from `svelte/store` counts as a store kept in memory, so a handler writing to one in a server-only location, `src/lib/server` included, is now reported. This is a new finding of an existing rule, so a project's recorded suppressions for it can already cover it.
- A write through a namespace import (`stores.user.set(…)` on `import * as stores`) is matched against the member it writes to, everywhere. In a server-only location that can add a finding; outside one, a write to a member that is a persistence client is no longer reported.
