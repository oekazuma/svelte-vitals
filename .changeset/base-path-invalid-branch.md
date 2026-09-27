---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/base-path-navigation` no longer treats a `paths.base` branch SvelteKit refuses to load as a base: a literal that does not start with `/`, or ends with `/` (`base: process.env.TAURI ? './' : ''`). Such a config fails to load in that branch, so the app is only ever served at the root, and its root-relative links are not reported.
