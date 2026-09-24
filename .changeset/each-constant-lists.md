---
'@svelte-vitals/core': patch
---

`correctness/each-key` and `correctness/each-index-key` no longer report an `{#each}` over a `const` array literal declared in the component's own script (not exported) when nothing in the file can change it: every other mention is a member read or another `{#each}`. That is the inline literal the rules already skip, given a name. A mutating call, an assignment through the list, or passing or spreading it keeps it reported, as does a list imported from another file.
