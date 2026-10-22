---
'@svelte-vitals/core': patch
'@svelte-vitals/vite': patch
---

The build-mode HTML check no longer skips a prerendered page that sets `ssr = true` under a layout with `ssr = false`. It used to treat every route under such a layout as the empty app shell, so a site whose root layout turns SSR off for an app dashboard while its landing, legal and docs pages turn it back on had none of those pages checked. Each page now takes the nearest `ssr` export along its own files and its layout chain, as the CLI reads it. Only a literal `ssr = true` turns SSR back on there; an `ssr` export the analyzer cannot evaluate (an imported value) is read as inheriting, so the page is skipped as a shell under a disabled layout. A route no source page matches is still skipped when an `ssr = false` module covers it.
