# @svelte-vitals/mcp

## 0.2.0

### Minor Changes

- ef895c1: Add two static resource-hint Performance checks: PERF003 flags a `<link rel="preload">`
  with no `as` attribute (the browser ignores or double-fetches it), and PERF004 flags a
  `<link rel="preload" as="font">` with no `crossorigin` (the font preload is wasted and the
  file downloads twice). Both surface in the CLI, the static report, and the vite plugin /
  dev UI. Static mode evaluates hints in `<svelte:head>`; resource hints in `app.html` are
  covered in plugin/rendered mode.

### Patch Changes

- Updated dependencies [ef895c1]
  - @svelte-vitals/core@0.12.0
  - svelte-vitals@0.11.0

## 0.1.8

### Patch Changes

- Updated dependencies [e6ee630]
  - @svelte-vitals/core@0.11.0
  - svelte-vitals@0.10.0

## 0.1.7

### Patch Changes

- Updated dependencies [0555127]
  - @svelte-vitals/core@0.10.1
  - svelte-vitals@0.9.1

## 0.1.6

### Patch Changes

- Updated dependencies [d86ced5]
  - @svelte-vitals/core@0.10.0
  - svelte-vitals@0.9.0

## 0.1.5

### Patch Changes

- Updated dependencies [31904f9]
  - @svelte-vitals/core@0.9.0
  - svelte-vitals@0.8.0

## 0.1.4

### Patch Changes

- Updated dependencies [a7bc1e6]
  - svelte-vitals@0.7.0

## 0.1.3

### Patch Changes

- Updated dependencies [2857e16]
  - @svelte-vitals/core@0.8.0
  - svelte-vitals@0.6.0

## 0.1.2

### Patch Changes

- Updated dependencies [337c29d]
  - svelte-vitals@0.5.2

## 0.1.1

### Patch Changes

- 6f3aeec: Formalize the ESM-only stance (#20): drop the legacy top-level `main`/`types` from
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

- Updated dependencies [6f3aeec]
  - @svelte-vitals/core@0.7.0
  - svelte-vitals@0.5.1

## 0.1.0

### Minor Changes

- 396a783: Add `@svelte-vitals/mcp`, a Model Context Protocol server exposing `analyze` and `explain_rule` tools over stdio (#24). Core gains `buildJsonReport`, `explainRule`, `RuleInfo`, and `docsUrlFor`; the JSON report's per-finding objects now include `docsUrl`; the CLI gains `analyzeProject` for reuse.

### Patch Changes

- Updated dependencies [396a783]
  - @svelte-vitals/core@0.6.0
  - svelte-vitals@0.5.0
