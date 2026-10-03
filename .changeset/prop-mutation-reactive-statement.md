---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/prop-mutation` no longer reports a legacy-mode mutating call that the same `$:` statement reassigns the prop with (`$: data = data.sort(…)`), as it already did within one function.
