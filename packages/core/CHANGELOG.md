# @svelte-vitals/core

## 0.26.0

### Minor Changes

- b10c26a: Add CORRECT006 (critical): flag orphan `$effect` calls that throw `effect_orphan` at runtime — a top-level `$effect` in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>`, and a module-scope `new` of a class whose constructor creates a bare `$effect`. `.svelte.ts`/`.svelte.js` runes modules are now analyzed by the component-facts pipeline.

## 0.25.0

### Minor Changes

- 28e92c0: `svelte-vitals --reporter html` and the vite live dashboard now share one renderer (core's new `renderAppShell`), so the two surfaces can't drift apart again. The static HTML report gets the dashboard's full UI — master/detail layout with a searchable, sortable route list, severity/category filters, dark mode, and the per-finding copy-to-clipboard AI Prompt — while staying fully self-contained and offline; the only difference is that the live-update machinery (SSE connection, `measured` refinement, the connection/analyzing indicators) is absent when there is no dev server behind the page. `@svelte-vitals/core` gains `renderAppShell`/`AppSnapshot`/`RouteBadge`/`APP_SCRIPT`/`APP_STYLE` exports; `buildHtmlDocument`/`formatHtmlReport` keep their signatures but emit the new document. The dashboard itself is unchanged, now served from the shared shell.

## 0.24.0

### Minor Changes

- bf6932d: Fix PERF009 (heavy dependency import) always reporting `line: 0` for its findings. `ComponentFacts` gains `importSpans` (module specifiers with their real source line), and PERF009 now uses it instead of the line-less `imports`. Because `componentRule`'s suppression check only looks up an inline directive when a finding's `line > 0`, this also fixes `// svelte-vitals-disable-next-line PERF009` silently never suppressing a PERF009 finding.

### Patch Changes

- fda64dd: Console reporter: stop printing the "↯ = set dynamically (verified at runtime)." footnote in compact (default, non-`--verbose`) mode. The `↯` marker itself only ever appears in the verbose `Passed` listing — showing the footnote without it visible anywhere in the output was confusing.

## 0.23.0

### Minor Changes

- 7acad5a: Console output now groups findings by rule and caps what's shown by default (top 5 rules per severity, the Passed section collapsed to a count, `--by-route` capped to the worst 10 routes) — pass `--verbose` for the old uncapped listing. The Health score also gets a short pulse-line reveal animation on an interactive terminal (disable with `--no-animation`).

## 0.22.1

### Patch Changes

- 2652572: The Markdown reporter's findings table (used for the GitHub Actions job summary and sticky PR comment) now appends each finding's `recommendation` to its message, matching what the console/github/agent reporters already show. Previously the table only showed the terse `message` (e.g. "Missing robots.txt"), dropping the actionable "how to fix it" text.

## 0.22.0

### Minor Changes

- 7e3b423: The dev dashboard (`svelteVitals({ ui: true })`) now runs whole-project static analysis: from the moment `vite dev` starts it shows all routes across every category (SEO, Performance, Correctness, Security, Architecture) with a real project Health — no page visit required. Saving a source file triggers a debounced re-analysis, and visiting a page refines that route with live (rendered) results. Route headings show a `measured` (live) or `static` provenance badge. If the analysis fails, the dashboard falls back to the previous live-only behavior without breaking the dev server. To support the badges, core's `buildHtmlDocument` gains an optional third argument (`opts?: { routeBadges?: Record<string, 'measured' | 'static'> }`); output is unchanged when it is omitted.
- f0af627: Surface the resolved `@svelte-vitals/core` version so it's possible to tell whether the CLI and the Vite dev overlay are running the same rule engine. `svelte-vitals --version` now prints `<cli version> (core <core version>)`, and the dev overlay's dashboard footer (`/__svelte-vitals/`) shows `core v<version>` alongside its own version. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases (e.g. a package-manager cooldown like pnpm's `minimumReleaseAge` resolving `@latest` down to an older release) — previously there was no way to notice this without diffing lockfiles, so the two surfaces could silently disagree on findings. See the "Version drift" section in the dev overlay docs.

## 0.21.0

### Minor Changes

- 8dc631c: Add a `--reporter md` Markdown summary reporter (Health score, per-category scores, severity counts, and a findings table) and a `svelte-vitals ci install` command that scaffolds a GitHub Actions workflow gating pull requests on newly introduced findings — inline annotations, a job summary, and a sticky PR comment, using `--diff`/`--baseline`/`--reporter github`/`--reporter md` under the hood.

## 0.20.0

### Minor Changes

- 7f1697d: Add CORRECT005: flag mutation of a non-`$bindable` prop destructured from `$props()` (member writes, `delete`, or a mutating method call like `.push()`). Plain reassignment of the prop itself is not flagged — Svelte's docs explicitly sanction that pattern for ephemeral state; only mutation is prohibited. Catches a class of bug the compiler never reports: mutating a plain-object prop is a silent no-op, and mutating a reactive-state-proxy prop only warns at runtime if that code path is exercised.
- 3b33e4c: Raise the supported Node.js floor from 18.20.8 (EOL) to >=22.13.0 — the oldest maintained LTS line the pinned pnpm can run on. CI now exercises Node 22 (floor), 24, and 26.

### Patch Changes

- 18b11af: Fix CORRECT001 (keyed each block): stop flagging itemless `{#each}` blocks (the "render N times" pattern, e.g. a chess board) — there is no item identity to key on, so this was a false positive on an officially documented Svelte pattern. Also corrected the rule's rationale text, which described the unkeyed mechanism backwards.
- e476a2e: Deduplicate `collectComponentFacts` into `@svelte-vitals/core`; behavior is unchanged.
- 6b2d0a7: Fix PERF010 (namespace import) rationale: it previously claimed a namespace import always defeats tree-shaking, which over-states the real behavior — bundlers like Rollup/Vite do tree-shake statically-accessed namespace imports. The message now accurately describes when tree-shaking breaks (the namespace object escapes or is accessed dynamically). No detection or severity change.
- 4513f97: Fix a false-positive/false-negative source shared by CORRECT004 (unmutated `$state`) and CORRECT005 (mutated non-bindable prop): both matched writes by identifier name alone, so a local binding that reused a tracked `$state`/prop name — a function parameter, a block-scoped `let`/`const` redeclaration, a `for`/`for-of`/`for-in` loop variable, a `catch` clause's parameter, or an `{#each ... as x}` loop variable — was misattributed as a write to the outer binding. CORRECT005 now correctly skips flagging a mutation of such a shadowing local instead of raising a false positive; CORRECT004 now correctly still flags a `$state` as constable when only a shadowing local was ever written, instead of a false negative. `{#snippet}`/`{:then}`/`{:catch}` bindings are not yet tracked — a known, documented remaining gap.

## 0.19.0

### Minor Changes

- 19e304c: Add an inline `svelte-vitals-disable-next-line` comment to suppress a specific component-scoped rule's finding on the following line (`// ...` in `<script>`, `<!-- ... -->` in markup) — a targeted escape hatch for intentional patterns a rule can't infer statically, such as a mount-only `$effect` used to avoid a hydration mismatch. Covers CORRECT001–004, SEC001–002, ARCH001–002, and PERF009–010. Fixes #92.
- 2f94444: Export `parseComponentFacts` (and the Svelte-AST utilities it's built on — `attrValue`, `attrValueOf`, `attrTextOf`, `findAttr`, `lineOf`, `CHILD_NODE_KEYS`, `valueFromNodes`, `textFromNodes`, `attrText`) from the package root. This is the same `.svelte`-source parser the CLI has always used for Correctness/Security/Architecture/Bundle-Performance rules, relocated from `svelte-vitals` so `@svelte-vitals/vite` can use it too. `@svelte-vitals/core` gains a new `svelte` dependency (for `svelte/compiler`'s `parse`) — a pure parsing call, so this doesn't affect the package's runtime-agnostic status.

## 0.18.0

### Minor Changes

- 32712e2: Rich console output: the default `console` reporter now colorizes the Health/category
  scores, severity sections, and pass/fail markers, and shows an "Analyzing…" spinner
  during the scan. All of it auto-disables under `NO_COLOR`, a non-TTY stdout, a
  non-`console` reporter, or `--no-color` (and honors `FORCE_COLOR`). Color is an
  injected `Palette` (identity by default), so `@svelte-vitals/core` stays
  dependency-free and other reporters are unchanged.
- 54c77d8: Add **CORRECT003 (effect used as onMount)** — the Correctness/reactivity slice of
  #69. Flags an `$effect`/`$effect.pre` whose non-empty body reads no reactive value
  (no `$state`/`$derived`/`$props`, no store subscription, no bare function call), so
  it never re-runs and should be `onMount`. Reported under `correctness` (warning).
  `EffectFact` gains `mountOnly`.
- bc6fa86: Add **CORRECT004 (unmutated $state)** — a Correctness/reactivity rule from #69.
  Flags a `let x = $state(...)`that is never written or escaped anywhere in the
component (no reassignment, member/method mutation, bind, call-arg, or
component-prop pass), so its reactivity is unused — use`const`(or`$state.raw`if only reassigned wholesale). Reported under`correctness`(info).`ComponentFacts`gains`constableStates`.

## 0.17.0

### Minor Changes

- 90e3e7e: Add an **Architecture** category — the third "Svelte Doctor" code-health category,
  reusing the component-body scan (CLI/static mode). Deterministic, high-precision
  size metrics that flag bloated "god components":

  - **ARCH001** Component size: flags a `.svelte` file over 400 lines (info).
  - **ARCH002** Prop count: flags a component destructuring more than 10 props from
    `$props()` (info).

  `ComponentFacts` gains `loc` and `propCount`; the console reporter shows an
  Architecture score line.

- 32698e0: Add **PERF009 (heavy dependency import)** — the Bundle slice of #69. Flags an
  `import` from a well-known heavy / non-tree-shakeable package (`lodash`, `moment`),
  matched by exact specifier so subpath imports like `lodash/debounce` pass.
  Reported under the `performance` category (info). `ComponentFacts` gains `imports`
  (module specifiers from the instance + module scripts).
- 382c397: Add **PERF010 (namespace import)** — the remaining Bundle slice of #69. Flags a
  value `import * as X from '<bare package>'`, which keeps the whole module in the
  bundle and defeats tree-shaking; named imports are preferred. Type-only and
  non-bare (relative / `$lib` / `$app` / `#…`) namespace imports are not flagged.
  Reported under `performance` (info). `ComponentFacts` gains `namespaceImports`.

## 0.16.0

### Minor Changes

- 4dc7773: Add a **Correctness** category — the first analysis of Svelte component bodies
  (not just `<head>`), broadening svelte-vitals toward a deterministic, agent-native
  code-health scanner. A new static (CLI) scan reads every `.svelte` under `src/`
  into a component-facts channel and adds two rules:

  - **CORRECT001** Keyed each block: flags an `{#each}` with no key (reordering an
    unkeyed list destroys/recreates DOM and loses element state).
  - **CORRECT002** Effect used to derive state: flags an `$effect` whose body only
    assigns to `$state` — the "useEffect → $effect" anti-pattern; use `$derived`.

  Correctness findings are scored per source file and surface under the new
  `correctness` category in the Health report. (CLI/static mode only.)

- 7cabf35: Add a **Security** category — the second "Svelte Doctor" code-health category,
  reusing the component-body scan (CLI/static mode):

  - **SEC001** Raw HTML render: flags `{@html …}` (an unescaped-HTML XSS surface;
    sanitize the value).
  - **SEC002** javascript: URL: flags a literal `javascript:` URL in an
    `href`/`src`/`action`/`formaction` attribute.

  The component-rule factory is now shared between the Correctness and Security
  categories, and the console reporter shows a Security score line.

- 6ee3d04: Add SEO028–SEO030 (#61), reusing existing capture (no parser changes):

  - **SEO028** Duplicate title: flags routes that share an identical static `<title>`.
  - **SEO029** Duplicate description: flags routes that share an identical static
    meta description.
  - **SEO030** Heading order: flags a skipped heading level (e.g. `<h2>` straight
    to `<h4>`); single-`<h1>` presence stays SEO027.

## 0.15.0

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

## 0.14.0

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

## 0.13.0

### Minor Changes

- e627343: Add six SEO checks decidable from the resolved `<head>` and project facts: SEO010 surfaces a
  route set to `noindex` (verify intentional), SEO011 Twitter Card, SEO012 Open Graph description,
  SEO013 Open Graph URL, SEO014 viewport, and SEO015 (robots.txt should reference your sitemap).
  SEO010 only fires on a statically-resolvable `noindex`/`none` (never a dynamic value); robots/
  viewport tags placed in `app.html` are covered in plugin/rendered mode.

## 0.12.0

### Minor Changes

- ef895c1: Add two static resource-hint Performance checks: PERF003 flags a `<link rel="preload">`
  with no `as` attribute (the browser ignores or double-fetches it), and PERF004 flags a
  `<link rel="preload" as="font">` with no `crossorigin` (the font preload is wasted and the
  file downloads twice). Both surface in the CLI, the static report, and the vite plugin /
  dev UI. Static mode evaluates hints in `<svelte:head>`; resource hints in `app.html` are
  covered in plugin/rendered mode.

## 0.11.0

### Minor Changes

- e6ee630: Add a visual HTML report: `svelte-vitals --reporter html` writes a self-contained,
  styled HTML page (Health score, per-category and per-route scores, findings with
  fixes) you can open in a browser. Output path defaults to `svelte-vitals-report.html`;
  override with `--out-file <path>` or `--out-file -` for stdout. The core gains
  `buildHtmlDocument` / `formatHtmlReport` for reuse by other surfaces.

## 0.10.1

### Patch Changes

- 0555127: Add a documentation site (Starlight, bilingual en/ja) at
  https://oekazuma.github.io/svelte-vitals/ with rule references and guides, and point every
  finding's `docsUrl` (and the SARIF `informationUri`) at it — previously these linked to an
  unpublished domain. Rule doc slugs are lowercased (e.g. `/rules/seo001`).

## 0.10.0

### Minor Changes

- d86ced5: **Remove the Accessibility (a11y) category.** svelte-vitals now focuses on SEO and
  Performance; accessibility is well covered by the Svelte compiler, eslint-plugin-svelte,
  and axe. This removes the a11y collector (the aggregated Svelte `a11y_*` compiler
  warnings), the `a11y` category from the score/Health breakdown and reporters, and the
  `--ignore a11y_*` / allow-list a11y handling. `Category` is now `'seo' | 'performance'`,
  and the Health score averages SEO + Performance. **Breaking:** a11y findings and the
  `categories.a11y` entry no longer appear in any reporter or the MCP `analyze` output.

## 0.9.0

### Minor Changes

- 31904f9: Add the combined **Health Report** (#10): a single weighted Health score across the
  SEO, Performance, and Accessibility categories (equal weights by default, overridable
  via `Config.weights`), surfaced as the headline in the console/agent reporters and the
  MCP `analyze` output, with an optional `--min-health <0-100>` CI gate.

  **Breaking (JSON report):** the top-level `score` is now the combined Health score (it
  was the SEO score); the top-level `scoreModel` is removed; a `weights` field is added.
  Per-category scores remain under `categories` (e.g. `categories.seo.score` /
  `categories.seo.scoreModel`).

## 0.8.0

### Minor Changes

- 2857e16: Add the Performance category (v0.4, #10): static `<img>` checks — **PERF001** (missing
  `width`/`height`, CLS risk; warning) and **PERF002** (missing `loading` attribute; info
  advisory) — with dynamically-bound attributes counting as present. Introduces the
  multi-category foundation: `Result.category`/`line`, the `ImageInfo`/`ResolvedImages` IR,
  `RuleContext.images`, `imageRule`, `scoresByCategory`, and category-aware reporters
  (per-category scores; JSON `categories` map). Existing SEO findings, scores, and output
  are unchanged.

## 0.7.0

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

## 0.6.0

### Minor Changes

- 396a783: Add `@svelte-vitals/mcp`, a Model Context Protocol server exposing `analyze` and `explain_rule` tools over stdio (#24). Core gains `buildJsonReport`, `explainRule`, `RuleInfo`, and `docsUrlFor`; the JSON report's per-finding objects now include `docsUrl`; the CLI gains `analyzeProject` for reuse.

## 0.5.0

### Minor Changes

- 762d4d1: Add SARIF 2.1.0 (`--reporter sarif`) and GitHub Actions workflow-command (`--reporter github`) reporters. The `github` reporter is auto-selected under GitHub Actions for inline PR annotations; SARIF can be uploaded to GitHub code scanning.

## 0.4.0

### Minor Changes

- e60d033: Agent-native output. Every rule now carries a structured `fix` (instruction + snippet), surfaced in the JSON report and in a new `--reporter agent` Markdown remediation document built for handing findings to an AI coding agent. The CLI auto-selects the agent reporter when run under a known AI-agent harness (`CLAUDECODE`), overridable via `SVELTE_VITALS_REPORTER` or `--reporter`.

### Patch Changes

- eb97f09: Agent reporter polish: an invalid `--reporter <value>` now fails fast with exit 2 instead of silently falling back to auto-detection; the agent Markdown report orders findings most-severe-first (critical-bearing files first, severity-sorted within each file) and tells the agent to prioritize critical issues; tag-like tokens (`<title>`, `<meta …>`, `<svelte:head>`) in the agent report are wrapped in inline code so Markdown renderers no longer strip them; rule `fix` templates are now copied per finding rather than shared by reference; and when the agent reporter is auto-selected from the environment (not requested explicitly), a one-line hint is printed to stderr explaining how to override.

## 0.3.0

### Minor Changes

- fcb0494: Plugin mode: `@svelte-vitals/vite` analyzes prerendered HTML during `vite build` and runs the full SEO rule set (library-agnostic), gating the build via `failOn`. Console/JSON reports with a per-route score; only prerendered routes are covered. `outFile` is resolved against the project root (parent directories are created), and an internal analysis failure is reported as a warning rather than failing the build (distinct from a real finding). The core console reporter gained an optional `mode` label for the header line, and now exports the shared `ROBOTS_SOURCE_PATHS` / `SITEMAP_SOURCE_PATHS` project-rule path lists used by both modes.

## 0.2.0

### Minor Changes

- 08b6d74: Static-mode finishing: scored SEO report.

  - New rules SEO002–SEO009 (description, canonical, og:image, og:title, robots.txt, sitemap.xml, JSON-LD, `<html lang>`).
  - Scoring model (§12): per-route scores, route average, site penalty, and a critical cap, surfaced in the console header and JSON.
  - JSON reporter (`--json` / `--reporter json`) and `--by-route` per-route tree.
  - New flags: `--fail-on`/`--fail-on-warning`, `--rules`/`--ignore`. `treatDynamicAs: 'warn'` now reports dynamic values as warnings.

## 0.1.0

### Minor Changes

- e3228ca: Detection layers 2–4: resolve head metadata set via components, not just literal `<svelte:head>`.

  - Built-in adapters for `svelte-meta-tags` (`MetaTags`) and `svelte-seo`.
  - Transitive resolution of custom `src/` components (depth-limited, cycle-guarded).
  - `--meta-components` flag to declare opaque meta components, plus `--treat-dynamic-as` and `--route` flags.
  - Components recognized as meta sources suppress false "missing" verdicts; unknown components do not.

## 0.0.1

### Patch Changes

- 4786248: Initial release: the static-mode SEO foundation.

  - `npx svelte-vitals` scans a SvelteKit project and checks `<title>` presence (SEO001) by statically parsing `<svelte:head>` with `svelte/compiler`, resolving the full layout chain (`+layout.svelte` → … → `+page.svelte`).
  - Two-axis detection (presence × value): a dynamic title such as `<title>{data.title}</title>` is recognized and never reported as missing; it passes with a `↯` marker. Only genuinely missing or empty metadata is flagged.
  - Runtime-agnostic `@svelte-vitals/core` (types, rule engine, reporter) with a `Runtime` I/O abstraction, plus a Node adapter in the CLI. Exit codes: `0` ok, `1` critical finding, `2` execution error.
