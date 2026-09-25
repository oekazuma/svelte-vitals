---
'@svelte-vitals/core': patch
---

`performance/namespace-import` no longer counts a same-named local as a use of the namespace: a function parameter, an `{#each}` item or index, a snippet parameter, an `{@const}` or a `let:` directive that shadows `X` in `import * as X` (e.g. `{#each items as _}` next to an otherwise unused `import * as _ from 'lodash-es'`). The rules that already honour template-local shadowing now also treat a `let:` directive's binding as a local.
