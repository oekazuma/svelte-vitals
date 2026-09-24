---
'@svelte-vitals/core': patch
---

`ssr = false` in a nested layout (for example `src/routes/(app)/+layout.ts`) is now followed down the layout chain, the way SvelteKit applies it, instead of counting only at the root. Under such a layout, `security/shared-state-import`, `security/handler-state-write` and `correctness/server-browser-global` no longer flag the `load` of universal `+page.ts`/`+layout.ts` files, and `correctness/instance-browser-global` no longer flags that subtree's `+page`/`+layout` components. `security/server-module-state` now skips universal files that never render on the server, whether through their own `ssr = false`, the root layout's, or a nested layout's. A child that exports `ssr` as anything but `false` turns SSR back on for itself and the layouts it uses, and a `+page@`/`+layout@` reset that skips the layout is honoured. Server files, shared components under `src/lib`, and the module scope of universal files are still checked.
