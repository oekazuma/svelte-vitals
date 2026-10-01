---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/prop-mutation` reads a prop declared `x = $bindable() as T` as bindable, like `x = $bindable()`.
