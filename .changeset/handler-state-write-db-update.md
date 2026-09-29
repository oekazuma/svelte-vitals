---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`security/handler-state-write` and `security/shared-state-import` count `.update(…)` as a store write only when its argument is an updater function (a function literal, or a function the module declares). A database client's `update` — `prisma.post.update({ … })`, `db.update(table).set({ … })` — writes no module state and is no longer reported, wherever the client is imported from.
