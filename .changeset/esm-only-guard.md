---
'@svelte-vitals/core': minor
'@svelte-vitals/vite': minor
'svelte-vitals': patch
'@svelte-vitals/mcp': patch
---

Formalize the ESM-only stance (#20): drop the legacy top-level `main`/`types` from
`@svelte-vitals/core` and `@svelte-vitals/vite` so every package is `exports`-only,
add `sideEffects: false` across all packages for consistent tree-shaking, declare
`"engines": { "node": ">=18" }` on every package so the documented runtime floor is
machine-enforceable, and document the ESM-only (Node 18+, `require()` unsupported by
design) requirement in each README. CI now guards type-resolution with
`@arethetypeswrong/cli` (esm-only profile) alongside publint.

`core` and `vite` get a `minor` bump because dropping top-level `main`/`types` can
affect consumers/tools that resolve entry points without `exports` support (e.g.
`moduleResolution: node`); `svelte-vitals` and `@svelte-vitals/mcp` only gain the
additive `sideEffects: false` and `engines` declaration, so they stay `patch`.
