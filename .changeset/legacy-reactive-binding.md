---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/instance-browser-global` treats a name a legacy component's `$: name = …` declares as the component's own binding, so `$: history = state.history` is no longer read as `window.history`.
