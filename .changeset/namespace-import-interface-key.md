---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/namespace-import` no longer reads an interface or type-literal member named like the namespace (`interface Props { toast: toast.Options }`) as a whole-namespace use, so a namespace used only through static member access and type positions is not reported.
