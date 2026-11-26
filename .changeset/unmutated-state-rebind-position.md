---
'svelte-vitals': patch
---

`correctness/unmutated-state` follows a local holding part of a `$state` up to where the code rebinds it, instead of dropping the local everywhere once any rebinding takes it elsewhere:

- A write made through the local before such a rebinding now counts, so the state is no longer reported: `let d = s.items; d.push(1); d = [];`. So does a write after a rebinding that may not have run: one under an `if`, one in a loop the write comes after, or one inside a function while the write is at the top level. A write inside a function is still not followed when another scope rebinds the local, since a handler may run after it.
- A destructuring or a loop that rebinds the local (`[d] = [[]]`, `for (d of rows)`) now ends it like an assignment, for the rest of its block or for the loop's body, so a state written only through the rebound local is now reported: `for (d of [[]]) d.push(1)`. A loop or destructuring over the same state (`for (d of s.items)`, `[d] = s`) keeps following it, as a part of it. One over a new array reads as leaving the state even when the elements come from it (`[a, b] = [b, a]`, `for (d of [...s.items])`), so such a state is now reported.
