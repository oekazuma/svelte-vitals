---
'@svelte-vitals/core': minor
---

Export `parseComponentFacts` (and the Svelte-AST utilities it's built on — `attrValue`, `attrValueOf`, `attrTextOf`, `findAttr`, `lineOf`, `CHILD_NODE_KEYS`, `valueFromNodes`, `textFromNodes`, `attrText`) from the package root. This is the same `.svelte`-source parser the CLI has always used for Correctness/Security/Architecture/Bundle-Performance rules, relocated from `svelte-vitals` so `@svelte-vitals/vite` can use it too. `@svelte-vitals/core` gains a new `svelte` dependency (for `svelte/compiler`'s `parse`) — a pure parsing call, so this doesn't affect the package's runtime-agnostic status.
