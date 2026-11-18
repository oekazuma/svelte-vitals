---
'svelte-vitals': patch
---

`correctness/unmutated-state` no longer reports a `$state` that is mutated through a local bound to the whole of it, as in `let items = $state([]); const list = items; list.push(x);`. Such a local was followed only when it held part of the state (`const row = items[i]`) or a `for…of` item. A local that is later reassigned is still not followed, since it may hold something else by the time it is written through.
