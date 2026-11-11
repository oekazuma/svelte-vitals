---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

The fix hints of `correctness/server-browser-global` and `correctness/instance-browser-global` now name `$app/env`, the module SvelteKit 3 moved `browser` to, next to `$app/environment`.
