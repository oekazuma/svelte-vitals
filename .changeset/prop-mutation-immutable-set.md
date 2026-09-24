---
'@svelte-vitals/core': patch
---

`correctness/prop-mutation` no longer reports `value = value.set({ … })`, where a method called with a single patch object has its result assigned straight back to the prop. That is the shape of an immutable date/time API such as `@internationalized/date`, whose `set` returns a new value and changes nothing. `map = map.set(key, value)` is still reported: `Map#set` mutates the map and returns it.
