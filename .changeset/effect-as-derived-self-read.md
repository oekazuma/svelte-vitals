---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/effect-as-derived` no longer reports an `$effect` that assigns a state from its own previous value (`name = name.trim()`, `level = levels[i] ?? level`), which a `$derived` cannot read, as it already skips `+=`.
