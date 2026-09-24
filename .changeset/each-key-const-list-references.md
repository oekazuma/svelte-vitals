---
'@svelte-vitals/core': patch
---

`correctness/each-key` and `correctness/each-index-key` no longer lose the exemption for a same-file `const` list when the file mentions an unrelated identifier of the same name, such as a property of another object (`config.levels`) or a parameter name in a type (`onChange: (levels: Level[]) => void`). Only references to the list itself decide whether it can change.
