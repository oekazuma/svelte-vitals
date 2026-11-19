---
'svelte-vitals': patch
---

`correctness/each-key` and `correctness/each-index-key` no longer report an `{#each}` over a `const` array nothing reorders when a class in the same file has a method or field of the same name (`const tabs = ['a', 'b']; class Store { tabs = []; }`). The member name was read as a use of the array, so it was no longer taken for a constant list.
