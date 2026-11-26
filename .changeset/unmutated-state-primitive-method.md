---
'svelte-vitals': patch
---

`correctness/unmutated-state` no longer counts a method call on a `$state` whose initial value is a primitive as a mutation, since a primitive cannot be changed. A state used only that way (`let n = $state(0); n.toFixed(2)`, directly, through a local holding it, or in the template) is now reported.
