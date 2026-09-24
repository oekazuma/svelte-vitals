---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/each-key` and `correctness/each-index-key` no longer report an `{#each}` over a constant list imported from a module in the project: an `export const LIST = [ … ]` array literal (`as const` and `satisfies` included) that the module never writes, imported through `$lib` or another `kit.alias`, a relative path or a barrel, and iterated as `LIST` or `ns.LIST` of a namespace import. The component itself is held to the same reads a same-file constant list is. Lists from packages or JSON files, and exports that are not array literals, are still reported.
