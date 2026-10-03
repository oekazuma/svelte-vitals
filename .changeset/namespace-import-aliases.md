---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/namespace-import` treats `@/…` and `~/…` specifiers as local aliases, not packages, and no longer reads an aliased named import of the same name (`import { Dialog as Primitive }`) as a whole use of the namespace.
