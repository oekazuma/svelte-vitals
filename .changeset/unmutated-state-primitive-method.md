---
'svelte-vitals': patch
---

`correctness/unmutated-state` reads two more uses of a `$state` correctly:

- A method call on a state whose initial value is a literal primitive (`0`, `''`, `null`) or is left out no longer counts as a mutation, since that value cannot be changed. A state used only that way is now reported, whether the call is on the state itself, on a local holding it, or in the template: `let n = $state(0); n.toFixed(2)`, or an element reference nothing binds, `let el = $state<HTMLElement>(); el.focus()`.
- A loop that rebinds the state without declaring it (`for (s of rows)`, `for ([s] of rows)`) now counts as a write, so such a state is no longer reported.
