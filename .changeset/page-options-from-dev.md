---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`export const ssr = dev` and `export const csr = dev` (with `dev` from `$app/environment`) are read as `false`, their value in every production build. Rules that exempt routes never rendered on the server (`security/server-module-state`, `security/shared-state-import`, `security/handler-state-write`, the browser-global checks) now exempt them. The Vite plugin now skips their prerendered app shells instead of reporting each as a page missing its `<title>`. `seo/ssr-disabled` reports `ssr = dev`: projects may see a new finding for it, and recorded suppressions for that rule may already cover it. A file exporting `ssr = dev` still has its module scope checked by `correctness/server-browser-global`, since SvelteKit imports it on the server to read the option. `performance/load-waterfall` now also exempts loads whose route turns `csr` off through a layout, following the nearest `csr` export as SvelteKit does; a layout's load is exempt only when every page under it has `csr` off. Where a node's universal and server modules both export `ssr` or `csr`, the universal one now wins, as in SvelteKit.
