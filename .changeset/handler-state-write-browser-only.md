---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`security/handler-state-write` and `security/shared-state-import` no longer report a write only the browser reaches: one after an early return such as `if (!browser) return;` in a universal `load`, inside `if (browser)`, or on the right of `browser && …`. In the browser each visitor has their own copy of the module, so such a write is not shared across requests. A write on the server side of the guard (`if (!browser) user.set(…)`) is still reported.
