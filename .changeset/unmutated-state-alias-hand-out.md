---
'svelte-vitals': patch
---

`correctness/unmutated-state` no longer reports a `$state` that is handed out through a local holding it or part of it. Passing such a local to a function, binding it, handing it out from a getter, or passing it to a component or a directive in the template (`const list = items; save(list)`, `<Child items={list} />`) now counts as handing out the state, and so does a write to an `{#each}` item over it. Returning such a local, or placing it in an object or array, counts when it is bound to the whole state (`const list = items; return list`), as for the state itself.
