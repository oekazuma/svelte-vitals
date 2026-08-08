---
'@svelte-vitals/core': patch
---

Recognize rune declarations behind TS casts (`as`, `satisfies`, `!`) — `let count = $state(0) as number` now feeds the same facts as the uncast form — and collect imports for `.svelte.ts`/`.svelte.js` runes modules, so import-based rules (`performance/heavy-import`, `performance/namespace-import`, `architecture/private-scope-import`, `architecture/route-component-import`) now see them. Both were silent false negatives: TypeScript-heavy components and runes modules could pass checks they should have failed. New findings may appear in TypeScript-heavy projects — they were previously missed, not newly introduced.
