---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A component that declares a local without an initializer under the name of one of its `$state`s (`let err = $state();` and, in a function, `let err;`) no longer fails to parse, so its findings are reported instead of being skipped.
