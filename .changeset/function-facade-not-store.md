---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`security/handler-state-write` no longer reports a `.set()` on an export under `$lib/server` that is an object literal whose properties are all functions (`export const data = { get, set }`): such a facade holds no data, and `.set()` calls its own method.
