# @svelte-vitals/vite

## 0.3.1

### Patch Changes

- Updated dependencies [2857e16]
  - @svelte-vitals/core@0.8.0

## 0.3.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [6f3aeec]
  - @svelte-vitals/core@0.7.0

## 0.2.1

### Patch Changes

- Updated dependencies [396a783]
  - @svelte-vitals/core@0.6.0

## 0.2.0

### Minor Changes

- 3c7c36e: Add a dev-time SvelteKit handle, `svelteVitalsHandle` (exported from `@svelte-vitals/vite/hooks`). Added to `src/hooks.server.ts`, it analyzes each visited page's rendered `<head>` in dev and prints SEO warnings for the current route to the terminal — request-driven, dev-only, and never mutates the response.

## 0.1.2

### Patch Changes

- Updated dependencies [762d4d1]
  - @svelte-vitals/core@0.5.0

## 0.1.1

### Patch Changes

- Updated dependencies [eb97f09]
- Updated dependencies [e60d033]
  - @svelte-vitals/core@0.4.0

## 0.1.0

### Minor Changes

- fcb0494: Plugin mode: `@svelte-vitals/vite` analyzes prerendered HTML during `vite build` and runs the full SEO rule set (library-agnostic), gating the build via `failOn`. Console/JSON reports with a per-route score; only prerendered routes are covered. `outFile` is resolved against the project root (parent directories are created), and an internal analysis failure is reported as a warning rather than failing the build (distinct from a real finding). The core console reporter gained an optional `mode` label for the header line, and now exports the shared `ROBOTS_SOURCE_PATHS` / `SITEMAP_SOURCE_PATHS` project-rule path lists used by both modes.

### Patch Changes

- Updated dependencies [fcb0494]
  - @svelte-vitals/core@0.3.0
