---
'svelte-vitals': patch
---

`correctness/unmutated-state` no longer reports a `$state` that is mutated through a local bound to the whole of it, as in `let items = $state([]); const list = items; list.push(x);`. Such a local was followed only when it held part of the state (`const row = items[i]`) or a `for…of` item. A local declared in the script, whole or part, is now also followed into template handlers, so `<button onclick={() => list.push(x)}>` counts as a mutation. A local that is reassigned anywhere in the component is still not followed, since it may hold something else by the time it is written through.
