---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
'@svelte-vitals/mcp': patch
---

`performance/heavy-import` no longer reports a type-only import. The rule's claim is bundle weight, and
`import type { Moment } from 'moment'` — or a declaration whose every specifier is inline-typed — is
erased at build and adds nothing, so reporting it was a false positive.

Projects using type-only imports of a configured heavy package will see **fewer** findings, and a health
score that rises accordingly. No configuration change is needed.

`architecture/private-scope-import` deliberately keeps reporting type-only imports: that rule is about
coupling between parts of a tree, which a type import creates just the same.
