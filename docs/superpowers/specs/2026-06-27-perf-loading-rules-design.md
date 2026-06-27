# Performance batch 2 — loading & connection rules (PERF005–PERF008)

**Date:** 2026-06-27
**Status:** Approved (1 PR, per maintainer)
**Packages:** `@svelte-vitals/core` (rules + capture model), `@svelte-vitals/cli` (static capture), `@svelte-vitals/vite` (rendered capture), `@svelte-vitals/mcp` (surfaces via `allRules`)
**Issue:** #60

## Goal

Deepen the **Performance** category (today: PERF001–004 — image dimensions, image
loading, preload `as`, font preload `crossorigin`) with four more
**static-analysis-only** rules, in two groups:

- **Image loading** (CLI/static, reuses `ctx.images`): PERF005, PERF006.
- **Render-blocking & connection** (head-based): PERF007 (rendered), PERF008 (both).

No runtime Core Web Vitals — heuristics only, with no false positives when a
signal is invisible to a mode (mirrors `appliesTo` / image-channel conventions).

| ID      | Check                              | Severity | Scope | Modes        |
| ------- | ---------------------------------- | -------- | ----- | ------------ |
| PERF005 | LCP image not lazy-loaded          | warning  | route | static (CLI) |
| PERF006 | Responsive images (`srcset`)       | info     | route | static (CLI) |
| PERF007 | Render-blocking `<script>` in head | warning  | route | rendered     |
| PERF008 | Preconnect for third-party origins | info     | route | both         |

## Background (architecture facts)

- Perf image rules use `imageRule` over `ctx.images` (`ImageInfo`), collected by
  the static provider only (`collectImages` in `parse.ts`). `imageRule` now takes
  an optional `category`. `ImageInfo` carries `hasWidth/hasHeight/hasLoading/hasAlt/line/file`.
- `HeadTag` kinds are `'title' | 'meta' | 'link' | 'jsonld'`. Links capture
  `rel/as/hasAs/hasCrossorigin/hreflang`; the literal `href` URL is **not** stored.
  Non-JSON-LD `<script>` tags are **not** captured.
- `appliesTo: (head) => head.source === 'rendered'` is the pattern for app.html-only
  signals (SEO014 viewport, SEO024 charset).

## Design

### PERF005 — LCP image not lazy-loaded (CLI, warning)

Lazy-loading the LCP/above-the-fold image delays it. We approximate the LCP image
as the **first `<img>` in document order** for the route. If that image has
`loading="lazy"`, flag it and recommend removing `lazy` (and adding
`fetchpriority="high"`). Complements PERF002, which recommends `loading="lazy"`
for _offscreen_ images and already notes "keep the LCP image eager".

- **Capture:** add `lazy: boolean` to `ImageInfo`/`ParsedImage` (`loading` literal
  equals `lazy`; a spread or dynamic `loading={…}` → `lazy: false`, never flagged).
- **Rule:** custom route-scoped rule over `ctx.images`; inspect `images[0]` only.
  Emit nothing for routes with no images. Heuristic documented (first image ≈ LCP).

### PERF006 — Responsive images (CLI, info)

A large content `<img>` without `srcset` ships one fixed asset to every viewport.
Advisory (`info`): flag an `<img>` with no `srcset` (and no spread). Decorative /
tiny images can't be told apart statically, so severity stays `info`.

- **Capture:** add `hasSrcset: boolean` to `ImageInfo`/`ParsedImage`
  (`hasSpread || Boolean(findAttr(attrs,'srcset'))`).
- **Rule:** `imageRule({ category: 'performance', severity: 'info', ok: (i) => i.hasSrcset })`.

### PERF007 — Render-blocking `<script>` in head (rendered, warning)

A `<script src>` in `<head>` without `defer`, `async`, or `type="module"` blocks
HTML parsing. SvelteKit's own scripts are module/deferred; this catches
hand-added blocking scripts (typically in `app.html`), so it's rendered-only.

- **Capture (parse-html):** for each `<head> <script>` with a `src` that is **not**
  `defer`/`async`/`type=module`, push `{ kind: 'script', presence: 'own', value:
'static', blocking: true }`. Add `kind: 'script'` and `blocking?: boolean` to
  `HeadTag`. (JSON-LD scripts keep their existing `kind: 'jsonld'` path.)
- **Rule:** custom route-scoped rule; fail once per route that has any
  `kind: 'script' && blocking` tag, else (rendered head with none) pass. Static
  heads emit nothing (`appliesTo` rendered).

### PERF008 — Preconnect for third-party origins (both, info)

Referencing a well-known third-party origin (e.g. Google Fonts) without a
`preconnect`/`dns-prefetch` for it adds a connection-setup round-trip. Precise by
construction: only a small **allowlist** of common third-party hosts is checked.

- **Capture:** add `href?: string` to `HeadTag` — the literal `href` (link) / `src`
  (script) URL when static. Static: `attrText(attrs,'href'|'src')`. Rendered:
  `getAttribute('href'|'src')`.
- **Rule:** custom route-scoped rule. Collect referenced origins from head tags
  whose `href` host is in `THIRD_PARTY_ORIGINS` (initial list:
  `fonts.googleapis.com`, `fonts.gstatic.com`). Collect origins already covered by
  `rel="preconnect"`/`dns-prefetch` links. For each referenced third-party origin
  with no covering hint → one `info` finding. Emit nothing when no third-party
  origin is referenced.

## Registration & surfaces

- New rule files under `packages/core/src/rules/perf/`; export from
  `rules/index.ts` (`allRules` + re-export) and `src/index.ts`. MCP surfaces them
  via `allRules`. 8 docs pages (en+ja, PERF005–008). Changeset core/cli/vite/mcp **minor**.

## Testing

- PERF005: first img lazy → fail; first img eager → pass; non-first lazy img →
  not flagged; no images → nothing; dynamic `loading` → not flagged.
- PERF006: img without srcset → info; with srcset / spread → pass.
- PERF007: blocking head script → fail; `defer`/`async`/`module`/inline → pass;
  static mode → nothing. Capture test for `kind:'script'` + `blocking`.
- PERF008: third-party origin without preconnect → info; with preconnect →
  pass; first-party / no third-party → nothing. Capture test for `href`.
- Existing image-test fixtures gain `lazy`/`hasSrcset`; clean-page fixtures stay
  clean (additive). Full `pnpm -r test` + typecheck + lint + docs build green.

## Out of scope (YAGNI)

- `decoding="async"` hint (low signal, noise-prone).
- General cross-origin detection beyond the allowlist (needs the site's own origin).
- Preload/`fetchpriority` correctness beyond the PERF005 recommendation text.
- CSS `@import` / `font-display` / render-blocking stylesheets.
- Rendered-mode image collection (PERF005/006 stay CLI-only this batch).
