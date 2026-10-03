---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/prop-mutation` no longer reports a mutating method name (`clear`, `delete`, `set`, …) called with `await` or chained with `.then`/`.catch`/`.finally`: the array, Set and Map methods are synchronous, so such a call is a client's own API (`await db.items.clear()`), not a mutation of the prop.
