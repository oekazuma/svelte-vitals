---
'svelte-vitals': patch
---

`correctness/server-browser-global`, `security/handler-state-write`, `security/server-module-state` and `security/shared-state-import` now check a universal `+layout.ts` that exports `ssr = false` when a page under it turns SSR back on, since the layout's `load` runs on the server for that page. Such a layout can now be reported where it was skipped before. A layout every page under it inherits `ssr = false` from is still skipped.
