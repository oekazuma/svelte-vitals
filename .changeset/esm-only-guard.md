---
'@svelte-vitals/core': patch
'@svelte-vitals/vite': patch
'svelte-vitals': patch
'@svelte-vitals/mcp': patch
---

Formalize the ESM-only stance (#20): drop the legacy top-level `main`/`types` from
`@svelte-vitals/core` and `@svelte-vitals/vite` so every package is `exports`-only,
add `sideEffects: false` across all packages for consistent tree-shaking, and document
the ESM-only (Node 18+, `require()` unsupported by design) requirement in each README.
CI now guards type-resolution with `@arethetypeswrong/cli` (esm-only profile) alongside
publint.
