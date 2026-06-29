# @svelte-vitals/mcp

## 0.5.0

### Minor Changes

- 9fb4622: Add PERF005–PERF008, four static Performance checks (#60):

  - **PERF005** LCP image eager loading: flags the first `<img>` (likely LCP) when
    it is `loading="lazy"` (static/CLI mode).
  - **PERF006** Responsive image: flags an `<img>` without `srcset` (info; static/CLI mode).
  - **PERF007** Render-blocking script: flags a `<head>` `<script src>` without
    `defer`/`async`/`type="module"`, in app.html (rendered) or `<svelte:head>` (static).
  - **PERF008** Preconnect third-party origin: flags a well-known third-party
    origin (Google Fonts) referenced without a `preconnect`/`dns-prefetch` (info).

  The head model gains `kind: 'script'`, `href`, and `blocking`; `<img>` capture
  gains `lazy` and `hasSrcset`.

### Patch Changes

- Updated dependencies [9fb4622]
  - @svelte-vitals/core@0.15.0
  - svelte-vitals@0.14.0

## 0.4.0

### Minor Changes

- 0fbc25d: Validate JSON-LD content, not just its presence (SEO008): SEO016 (valid JSON with @context/@type),
  SEO017 (deprecated/restricted rich-result type), SEO018 (relative URLs under known keys), SEO019
  (non-ISO-8601 dates under known keys), SEO020 (placeholder text), and SEO021 (required properties for
  recognized @types). Only static, parseable JSON-LD is checked — a dynamically-built script is skipped.
- 069e0db: Add SEO024–SEO027, the remaining statically-analyzable SEO checks:

  - **SEO024** — Character encoding: flags a rendered page with no `<meta charset>`
    (lives in app.html, so rendered-only, like the viewport rule).
  - **SEO025** — Image alt text: flags an `<img>` with no `alt` attribute (empty
    `alt=""` is valid decorative; static/CLI mode only, like the perf image rules).
  - **SEO026** — hreflang validity: opt-in check of `<link rel="alternate"
hreflang>` alternates — malformed codes, or 2+ alternates without an x-default.
  - **SEO027** — Heading hierarchy: flags zero or multiple `<h1>` per page (exactly
    one passes; layout-chain headings count). Introduces a page-body headings
    channel collected by both providers.

- 8aeeabb: Add SEO022 (title length, 30–60 chars) and SEO023 (meta description length,
  70–160 chars). Both check only static text — the literal title/description is now
  captured onto the head model — and flag both too-short and too-long values; a
  dynamic title/description is skipped (presence stays owned by SEO001/SEO002).
  Static literal `title`/`description` props on `svelte-meta-tags` and `svelte-seo`
  components are measured too (a `titleTemplate` correctly suppresses title
  measurement). Length is counted by grapheme cluster, so emoji (ZWJ/flag/skin-tone
  sequences) count as one character.

### Patch Changes

- Updated dependencies [67a5a0e]
- Updated dependencies [0fbc25d]
- Updated dependencies [069e0db]
- Updated dependencies [8aeeabb]
  - @svelte-vitals/core@0.14.0
  - svelte-vitals@0.13.0

## 0.3.0

### Minor Changes

- e627343: Add six SEO checks decidable from the resolved `<head>` and project facts: SEO010 surfaces a
  route set to `noindex` (verify intentional), SEO011 Twitter Card, SEO012 Open Graph description,
  SEO013 Open Graph URL, SEO014 viewport, and SEO015 (robots.txt should reference your sitemap).
  SEO010 only fires on a statically-resolvable `noindex`/`none` (never a dynamic value); robots/
  viewport tags placed in `app.html` are covered in plugin/rendered mode.

### Patch Changes

- Updated dependencies [e627343]
  - @svelte-vitals/core@0.13.0
  - svelte-vitals@0.12.0

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
