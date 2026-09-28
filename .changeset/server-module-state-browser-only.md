---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`security/server-module-state` no longer reports a reassignment only the browser reaches (inside `if (browser)`, on the right of `browser && …`, or after `if (!browser) return;`), the same guard `security/handler-state-write` already honours.
