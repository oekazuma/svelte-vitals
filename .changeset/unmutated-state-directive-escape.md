---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
'@svelte-vitals/mcp': patch
---

`correctness/unmutated-state` no longer flags `$state` passed to a `use:`/`transition:`/`animate:` directive — the receiving code holds the proxy reference and may mutate it invisibly, so the previous `$state.raw` suggestion could break it.
