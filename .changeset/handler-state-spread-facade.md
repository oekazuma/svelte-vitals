---
'svelte-vitals': patch
'@svelte-vitals/core': patch
---

`security/handler-state-write` no longer treats an object literal built from spreads under `src/lib/server` (`export const DatabaseWrites = { ...models, ...handlers }`) as a hand-rolled in-memory store, so `.set()`/`.update()` calls through such a database facade (`DatabaseWrites.stores.update(...)`) are no longer reported as critical findings. A spread literal that declares its own container property (`{ ...defaults, hits: new Map() }`) is still reported.
