---
'@svelte-vitals/core': patch
---

`correctness/base-path-navigation` no longer reports a root-relative literal that already starts with a literal `kit.paths.base` (for example `goto('/admin/auth')` under `base: '/admin'`). Such a link points inside the app, and the suggested `resolve()` wrap would have doubled the base. A computed base still reports every root-relative literal.
