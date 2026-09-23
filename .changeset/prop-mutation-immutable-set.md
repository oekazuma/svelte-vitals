---
'@svelte-vitals/core': patch
---

`correctness/prop-mutation` no longer reports `value = value.set({ … })`, where a method's result is assigned straight back to the prop. That is the shape of an immutable API such as `@internationalized/date`, whose `set` returns a new value and changes nothing.
