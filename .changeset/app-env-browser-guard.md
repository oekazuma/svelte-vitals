---
'@svelte-vitals/core': patch
---

`correctness/server-browser-global` and `correctness/instance-browser-global` now recognise `browser` imported from SvelteKit 3's `$app/env` as a guard, the same as `browser` from `$app/environment`. Guarded reads such as `if (browser && location.hash)` in a SvelteKit 3 app were reported as running on the server.
