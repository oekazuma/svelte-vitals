# Design: Deeper static Performance — resource-hint correctness

The next increment of **pillar 1** (SEO + deep static Performance — the differentiated core). Today the Performance category has only PERF001 (`<img>` width/height → CLS) and PERF002 (`<img>` loading advisory). This adds two high-confidence, statically-analyzable checks for **resource-hint correctness** in the effective `<head>`: broken `preload` links that browsers ignore or double-fetch.

## Goal

Catch two concrete, well-known resource-hint bugs from the source / rendered `<head>`, before deploy, without a browser or runtime metrics:

- **PERF003** — a `<link rel="preload">` with no `as` attribute. Without `as`, the browser can't assign a priority/destination; the preload is ignored or causes a double fetch.
- **PERF004** — a `<link rel="preload" as="font">` with no `crossorigin` attribute. Fonts are always fetched in CORS mode, so a font preload without `crossorigin` fetches a *second*, unused copy — pure waste.

Both are `warning` severity (a real, fixable waste — not merely advisory), route-scoped, and emit nothing for routes that have no `preload` link (no signal, like the image rules).

## Why these two

The constraints — runtime-agnostic core, no CSS parsing, no browser/LCP knowledge, and **no false negatives** (never flag a dynamic value) — rule out most "deep perf" ideas (`font-display` needs CSS parsing; LCP preload needs runtime knowledge; preconnect-for-external-fonts needs the literal `href` origin, which the model deliberately doesn't store). PERF003/PERF004 decide purely on **attribute presence** plus the `as` **keyword** (a fixed vocabulary like `rel`, not a user literal) — fully consistent with svelte-vitals' presence/value model and its no-false-negative guarantee.

## Data model change (core)

`HeadTag` (`packages/core/src/head.ts`) gains two optional fields, set only for `kind: 'link'`:

- `as?: string` — the `as` keyword (`'font'`, `'script'`, `'style'`, `'image'`, …). A fixed vocabulary, safe to store (like `rel`). Absent when the `<link>` has no `as`.
- `hasCrossorigin?: boolean` — whether the `<link>` carries a `crossorigin` attribute (presence only; the value, e.g. `anonymous`, is irrelevant to the checks).

A dynamically-bound attribute (`as={x}` / `crossorigin={c}`) counts as **present** (so PERF003/004 never fire on it) — the same no-false-negative rule the image provider already uses for `width={w}`.

## Providers (both modes populate the new fields)

- **Static (CLI)** — `packages/cli/src/providers/source/parse.ts` (svelte/compiler walk of `<svelte:head>`): when building the `kind: 'link'` tag, also read `as` (keyword text, or mark present if dynamically bound) and set `hasCrossorigin` from attribute presence.
- **Rendered (vite)** — `packages/vite/src/providers/rendered/parse-html.ts` (node-html-parser over the prerendered/dev `<head>`): on each `<link>`, read `getAttribute('as')` and `hasAttribute('crossorigin')`.

Coverage note (honest, unchanged philosophy): static mode sees only hints written in `<svelte:head>`; resource hints placed in `app.html` are seen only in **rendered / plugin mode**. Both feed the same rule engine, so each check fires wherever the link tag is visible.

**Static-mode multi-`preload` limitation (v1):** the source-head composer (`packages/cli/src/providers/source/routes.ts`) collapses head tags into a singleton `Map` keyed by `link:${rel}` (correct for singleton tags like `canonical`), so multiple `<svelte:head>` `<link rel="preload">` tags collapse to one representative (last-wins) in static mode. **Rendered / plugin mode evaluates every preload** (its parser keeps a flat list). Since resource hints overwhelmingly live in `app.html` — invisible to static mode regardless — these rules are primarily a rendered/plugin-mode capability; the static-mode `<svelte:head>` case is a bonus with this documented limitation. De-duping multi-valued link tags in the static composer is a deferred follow-up; the rules themselves are unaffected (they scan whatever link tags `ResolvedHead.tags` contains).

## Rules (core, pure functions)

Add a small **head-link rule** helper (`packages/core/src/rules/perf/link-rule.ts`), analogous to `imageRule`/`headTagRule`, that scans each route's head for `kind: 'link'` tags matching a predicate and checks each against `ok`:

- It considers only routes whose head contains at least one **relevant** link (a `preload` link); routes with none emit nothing (no Performance signal — mirrors `imageRule`).
- A route whose relevant links all pass emits one passing result (seeds the route at 100 for the per-category score); a failing link emits a finding with the fix.

Rules:

- `perf003PreloadAs` — relevant: `rel === 'preload'`; `ok`: `tag.as !== undefined` (has an `as`). Severity `warning`.
- `perf004FontPreloadCrossorigin` — relevant: `rel === 'preload' && as === 'font'`; `ok`: `tag.hasCrossorigin === true`. Severity `warning`.

Each carries `recommendation`, `rationale`, and a `fix` (description + snippet, `lang: 'svelte'`), like the existing rules. Register both in `allRules` (`packages/core/src/rules/index.ts`) and export them from the core index.

Severity rationale: both are a *wasted/ineffective* hint (not a style preference), so `warning` — consistent with PERF001 (`warning`) and stronger than PERF002's `info` advisory.

## Testing

- **core rule tests** (`packages/core/test/perf-resource-hints.test.ts`): PERF003 flags a `preload` link with no `as`; passes one with `as`; PERF004 flags `preload as=font` without `crossorigin`, passes one with it; a route with no preload link emits nothing; a dynamically-bound `as`/`crossorigin` (present) is not flagged; a non-preload link (e.g. `stylesheet`, `preconnect`) is ignored by both.
- **provider extraction tests**: CLI `parse.ts` test — a `<svelte:head>` `<link rel="preload" as="font" crossorigin>` yields a HeadTag with `as: 'font'`, `hasCrossorigin: true`; a dynamic `as={x}` yields a present `as`. vite `parse-html.ts` test — the same from rendered HTML.
- **docs link integrity**: `packages/cli/test/docs-links.test.ts` already asserts every SEO/PERF rule has en + ja pages — PERF003/PERF004 pages must exist or it fails (so docs are part of this increment, below).

## Documentation

- Rule reference pages `docs/src/content/docs/rules/perf003.md` + `perf004.md` and their `ja/` counterparts (matching the existing PERF001/002 page template: title, severity, what it checks, why it matters, how to fix with a snippet).
- No guide changes needed (the Performance category is already described).

## Release

`@svelte-vitals/core` + `svelte-vitals` + `@svelte-vitals/vite` **minor** (new findings surface in static mode, the CLI, and the vite plugin/dev UI). `@svelte-vitals/mcp` cascades a patch via `workspace:*`.

## Non-goals / follow-ups

- Checks needing the literal `href` origin: external-font-CSS missing `preconnect`, `preconnect` `crossorigin` correctness, dns-prefetch hygiene. (Would require storing link hrefs — a model/philosophy change.)
- `font-display` / `@font-face` analysis — needs a CSS parser.
- LCP-image `preload` / `fetchpriority` — needs runtime knowledge; only advisable, overlaps PERF002.
- Render-blocking `<script>`/stylesheet analysis — SvelteKit manages these; noisy.
- Responsive-image `srcset`/`sizes` deepening — a separate image-area increment.
