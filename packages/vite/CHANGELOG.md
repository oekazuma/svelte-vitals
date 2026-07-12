# @svelte-vitals/vite

## 0.14.1

### Patch Changes

- Updated dependencies [58ccebc]
  - svelte-vitals@0.24.1

## 0.14.0

### Minor Changes

- 5d9f0d1: Live dashboard: `svelteVitals()`'s `ui` option now defaults to `true` — the dashboard at `/__svelte-vitals/` is on during `vite dev` unless you pass `ui: false`. `svelteVitalsHandle` no longer prints findings to the terminal (the dashboard supersedes that output); it still feeds the dashboard's per-route accuracy when enabled.

  CLI: the `install` wizard's `vite-dev-overlay` target is renamed `vite-hooks`, with copy describing its real effect (dashboard accuracy) instead of terminal warnings.

### Patch Changes

- c2ee668: Live dashboard: the "Overview" pane now lists every finding across the whole project (all routes plus site-wide checks) instead of only site-wide checks, and the severity/category filter chips actually filter that list. Previously the chips rendered on Overview but had nothing to act on for most projects (no site-wide findings), which made them look broken. Each finding now shows its route, clickable to jump straight to that route's detail pane.
- c2ee668: Live dashboard: replace the plain bolt-glyph brand mark with the same wordmark used on the docs site, for visual consistency.

  CLI mascot: give the `happy`/`ecstatic` reaction faces a cleaner rounded-bracket smile (`╰──╯`/`╰───╯`) instead of a repeated `◡` arc, which read as a wavy scallop rather than one smile.

- Updated dependencies [ca6d1af]
- Updated dependencies [c2ee668]
- Updated dependencies [7da8bb7]
- Updated dependencies [085c622]
- Updated dependencies [08aa27e]
- Updated dependencies [5d9f0d1]
  - svelte-vitals@0.24.0

## 0.13.1

### Patch Changes

- Updated dependencies [7acad5a]
  - @svelte-vitals/core@0.23.0
  - svelte-vitals@0.23.0

## 0.13.0

### Minor Changes

- a3b4eff: Redesign the live UI dashboard (`ui: true`) into a searchable, sortable master/detail layout with dark mode, syntax-highlighted fix snippets, and a live analysis-in-progress indicator.
- 45ec323: `svelteVitals({ ui: true })` now prints the live dashboard's URL right after Vite's own `Local:`/`Network:` lines every time `vite dev` starts, so the dashboard is discoverable without knowing the `/__svelte-vitals/` path in advance.

## 0.12.2

### Patch Changes

- Updated dependencies [2652572]
- Updated dependencies [2652572]
  - svelte-vitals@0.22.1
  - @svelte-vitals/core@0.22.1

## 0.12.1

### Patch Changes

- Updated dependencies [d9efc77]
  - svelte-vitals@0.22.0

## 0.12.0

### Minor Changes

- 7e3b423: The dev dashboard (`svelteVitals({ ui: true })`) now runs whole-project static analysis: from the moment `vite dev` starts it shows all routes across every category (SEO, Performance, Correctness, Security, Architecture) with a real project Health — no page visit required. Saving a source file triggers a debounced re-analysis, and visiting a page refines that route with live (rendered) results. Route headings show a `measured` (live) or `static` provenance badge. If the analysis fails, the dashboard falls back to the previous live-only behavior without breaking the dev server. To support the badges, core's `buildHtmlDocument` gains an optional third argument (`opts?: { routeBadges?: Record<string, 'measured' | 'static'> }`); output is unchanged when it is omitted.
- f0af627: Surface the resolved `@svelte-vitals/core` version so it's possible to tell whether the CLI and the Vite dev overlay are running the same rule engine. `svelte-vitals --version` now prints `<cli version> (core <core version>)`, and the dev overlay's dashboard footer (`/__svelte-vitals/`) shows `core v<version>` alongside its own version. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases (e.g. a package-manager cooldown like pnpm's `minimumReleaseAge` resolving `@latest` down to an older release) — previously there was no way to notice this without diffing lockfiles, so the two surfaces could silently disagree on findings. See the "Version drift" section in the dev overlay docs.

### Patch Changes

- Updated dependencies [7e3b423]
- Updated dependencies [f0af627]
- Updated dependencies [ea90a6d]
  - @svelte-vitals/core@0.22.0
  - svelte-vitals@0.21.0

## 0.11.1

### Patch Changes

- Updated dependencies [8dc631c]
  - @svelte-vitals/core@0.21.0

## 0.11.0

### Minor Changes

- 3b33e4c: Raise the supported Node.js floor from 18.20.8 (EOL) to >=22.13.0 — the oldest maintained LTS line the pinned pnpm can run on. CI now exercises Node 22 (floor), 24, and 26.

### Patch Changes

- e476a2e: Deduplicate `collectComponentFacts` into `@svelte-vitals/core`; behavior is unchanged.
- aa1e0a4: Harden the dev UI middleware: reject non-loopback origins/hosts, fully validate ingested findings against what the dashboard renderer dereferences, and never let a malformed payload crash the dashboard.
- Updated dependencies [18b11af]
- Updated dependencies [7f1697d]
- Updated dependencies [e476a2e]
- Updated dependencies [6b2d0a7]
- Updated dependencies [3b33e4c]
- Updated dependencies [4513f97]
  - @svelte-vitals/core@0.20.0

## 0.10.0

### Minor Changes

- 2f94444: Build mode now additionally scans `.svelte` source under `src/` and runs Correctness, Security, Architecture, and the two component-scoped Performance rules (PERF009/PERF010) — the same rules the CLI and MCP already run — enabled by default alongside the existing rendered-HTML SEO/Performance checks. The dev overlay is unchanged (still SEO/Performance-only, rendered-HTML-based). Use the existing `rules` option to opt individual rules out, e.g. `{ CORRECT002: 'off' }`.

### Patch Changes

- Updated dependencies [19e304c]
- Updated dependencies [2f94444]
  - @svelte-vitals/core@0.19.0

## 0.9.2

### Patch Changes

- Updated dependencies [32712e2]
- Updated dependencies [54c77d8]
- Updated dependencies [bc6fa86]
  - @svelte-vitals/core@0.18.0

## 0.9.1

### Patch Changes

- Updated dependencies [90e3e7e]
- Updated dependencies [32698e0]
- Updated dependencies [382c397]
  - @svelte-vitals/core@0.17.0

## 0.9.0

### Minor Changes

- 660f040: Collect `<img>` elements in rendered (vite) mode so the image rules — PERF001,
  PERF002, PERF005, PERF006, and SEO025 — now run during build analysis and in the
  dev hook, not only in static (CLI) mode (#61). Previously the vite plugin
  silently skipped every image/alt check.
- 6ee3d04: Add SEO028–SEO030 (#61), reusing existing capture (no parser changes):

  - **SEO028** Duplicate title: flags routes that share an identical static `<title>`.
  - **SEO029** Duplicate description: flags routes that share an identical static
    meta description.
  - **SEO030** Heading order: flags a skipped heading level (e.g. `<h2>` straight
    to `<h4>`); single-`<h1>` presence stays SEO027.

### Patch Changes

- Updated dependencies [4dc7773]
- Updated dependencies [7cabf35]
- Updated dependencies [6ee3d04]
  - @svelte-vitals/core@0.16.0

## 0.8.0

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

## 0.7.0

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

- 67a5a0e: Refine the JSON-LD rules to cut false positives: SEO018 no longer flags `@id`
  (a node identifier, often a relative fragment) and now accepts any URI scheme
  (`data:`/`mailto:`/`urn:`) and protocol-relative URLs; SEO019 accepts schema.org
  reduced-precision dates (`2026`, `2026-06`); SEO021 treats empty/blank required
  values as missing. Rendered-mode capture reads `<script>` via `rawText` so HTML
  entities (e.g. `&quot;`) are no longer decoded and the JSON stays intact.
- Updated dependencies [67a5a0e]
- Updated dependencies [0fbc25d]
- Updated dependencies [069e0db]
- Updated dependencies [8aeeabb]
  - @svelte-vitals/core@0.14.0

## 0.6.0

### Minor Changes

- e627343: Add six SEO checks decidable from the resolved `<head>` and project facts: SEO010 surfaces a
  route set to `noindex` (verify intentional), SEO011 Twitter Card, SEO012 Open Graph description,
  SEO013 Open Graph URL, SEO014 viewport, and SEO015 (robots.txt should reference your sitemap).
  SEO010 only fires on a statically-resolvable `noindex`/`none` (never a dynamic value); robots/
  viewport tags placed in `app.html` are covered in plugin/rendered mode.

### Patch Changes

- Updated dependencies [e627343]
  - @svelte-vitals/core@0.13.0

## 0.5.0

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

## 0.4.0

### Minor Changes

- 22127fc: Add a live UI dashboard: `svelteVitals({ ui: true })` serves a svelte-vitals report at
  `/__svelte-vitals/` during `vite dev`, fed by `svelteVitalsHandle`, that updates live as you
  navigate. It reuses the same renderer as the CLI's `--reporter html`. Dev-only and
  rendered-based (SEO `<head>` rules for visited routes); the dev overlay's behavior is
  unchanged when the UI is not enabled.

## 0.3.5

### Patch Changes

- Updated dependencies [e6ee630]
  - @svelte-vitals/core@0.11.0

## 0.3.4

### Patch Changes

- Updated dependencies [0555127]
  - @svelte-vitals/core@0.10.1

## 0.3.3

### Patch Changes

- Updated dependencies [d86ced5]
  - @svelte-vitals/core@0.10.0

## 0.3.2

### Patch Changes

- Updated dependencies [31904f9]
  - @svelte-vitals/core@0.9.0

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
