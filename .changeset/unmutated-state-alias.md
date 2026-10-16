---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

`correctness/unmutated-state` now counts a mutation through a local that holds part of the state — a `for…of` variable over it (`for (const day of days) day.blocks = []`) or a `const` taken from a member or element of it (`const day = days[i]; day.blocks.push(…)`, also through another such local) — as mutating the state, and no longer reports it as never mutated.
