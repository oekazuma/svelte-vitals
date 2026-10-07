---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

An app whose `svelte.config.js` sets `kit.router.type: 'hash'` is read as never server-rendering, as with a root `ssr = false`, so the rules about code running during SSR no longer report it, and the Vite plugin skips its prerendered app shell as it does an `ssr = false` route's. A page whose component script, or a layout's above it, throws on every render (a top-level `throw`, `redirect()` or `error()`) is read as never rendering, and route-level checks skip it. The Vite plugin no longer fails its analysis on a large prerendered site: a rule returning hundreds of thousands of results overflowed the stack, and a JSON report longer than the longest string V8 can hold is now written route by route.
