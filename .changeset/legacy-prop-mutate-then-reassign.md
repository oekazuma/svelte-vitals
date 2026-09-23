---
'@svelte-vitals/core': patch
---

`correctness/prop-mutation` no longer flags a mutating method call on a legacy `export let` prop when the same function also reassigns the prop (`files.splice(i, 1); files = files;`). That reassignment is the documented legacy-mode way to trigger the update, and the rule's own fix advice.
