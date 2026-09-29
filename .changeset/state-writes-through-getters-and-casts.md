---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/unmutated-state` no longer reports a `$state` that a getter hands out (`{ get rows() { return rows; } }`) unless it holds a primitive, since whoever reads the getter can write through it. Writes through a type assertion or a non-null assertion (`(data as T).x = 1`, `bind:value={q.limit!}`, `game!.decks = …`) now count as writes wherever a rule tracks them, so `correctness/prop-mutation` can report such writes to a prop; projects with recorded suppressions for that rule may already have these findings suppressed.
