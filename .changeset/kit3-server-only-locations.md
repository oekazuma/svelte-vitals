---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`security/handler-state-write` and `security/shared-state-import` now treat SvelteKit's other server-only locations like `src/lib/server`: any `server` directory outside `src/routes` and `static`, and any file with a `server` segment in its name (`db.server.ts`). A handler's `.set()`/`.update()` on an export from one is reported only when that export is a store kept in memory. Findings that these locations now exempt in SvelteKit 2 projects disappear.

Two readings changed with it, in every server-only location including `src/lib/server`. An export initialized with `writable(…)` from `svelte/store` counts as a store kept in memory, so a handler writing to one is now reported there. And a write through a namespace import (`stores.user.set(…)` on `import * as stores`) is matched against the member it writes to. These are new findings of existing rules, so a project's recorded suppressions for those rules can already cover them.
