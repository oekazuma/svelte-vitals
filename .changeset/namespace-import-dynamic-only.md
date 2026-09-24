---
'@svelte-vitals/core': patch
---

`performance/namespace-import` now reports an `import * as X` only when `X` is used as a whole: indexed by a variable, passed on, spread or enumerated. A namespace read only through static member access (`X.foo()`, `{X.foo}`, `<X.Component />`) tree-shakes like named imports, and on a corpus of 16 real SvelteKit apps every one of the rule's 16 findings was that case.
