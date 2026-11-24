---
'svelte-vitals': patch
---

`correctness/unmutated-state` no longer reports a `$state` that is handed out through a local holding it or part of it. Passing such a local to a function, binding it, handing it out from a getter, or passing it to a component or a directive in the template (`const list = items; save(list)`, `<Child items={list} />`) now counts as handing out the state, and so does a write to an `{#each}` item over it. Returning such a local, or placing it in an object or array, counts when it is bound to the whole state and never rebound to a part of it (`const list = items; return list`), as for the state itself.

A template handler now reads what it returns, places in an object or array, or hands out from a getter the way the script does. Placing a state that holds an object (`onclick={() => setContext('k', { items })}`) counts as handing it out, so that state is no longer reported. Returning a state that may hold a primitive, or handing it out from a getter, hands out a copy, so a handler that only does that no longer keeps the state from being reported.
