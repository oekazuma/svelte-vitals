---
'svelte-vitals': patch
---

`security/handler-state-write` now reads an export built with `new` of a class reached through an installed package's import, such as `export const cluster = new Redis.Cluster([…])` after `import Redis from 'ioredis'`, as a client, as it already did for `new PrismaClient()`. A handler's `cluster.set(…)` on that export of a repo-local module outside the server-only locations was reported as a write to shared module state.
