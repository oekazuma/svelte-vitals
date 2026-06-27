# SEO Phase D — remaining static gaps vs claude-seo (SEO024–SEO027)

**Date:** 2026-06-26
**Status:** Approved — implemented in one PR (per maintainer)
**Packages:** `@svelte-vitals/core` (rules + capture model), `@svelte-vitals/cli` (static capture), `@svelte-vitals/vite` (rendered capture), `@svelte-vitals/mcp` (surfaces new rules via `allRules`)

## Goal

Close the SEO checks that are **statically analyzable in a SvelteKit codebase**,
covered by [claude-seo](https://github.com/AgriciDaniel/claude-seo), and not yet
in svelte-vitals. claude-seo is a live, API/crawl/agent-driven audit suite; the
vast majority of its coverage (CrUX, Lighthouse, Search Console/GA4, backlinks,
local/GBP, E-E-A-T, headless rendering) is **out of scope** for a dependency-free
static linter. The remaining overlap that _does_ fit our model is four checks:

| ID     | Check                         | Severity | Scope | Modes        |
| ------ | ----------------------------- | -------- | ----- | ------------ |
| SEO024 | Character encoding (charset)  | warning  | route | rendered     |
| SEO025 | Image alt text                | warning  | route | static (CLI) |
| SEO026 | hreflang / x-default validity | warning  | route | both         |
| SEO027 | Heading hierarchy (single H1) | warning  | route | both         |

All four are `category: 'seo'`. Each emits **no signal** when its subject is
absent in a mode that cannot see it (no false positives), mirroring the existing
`appliesTo` and image-collection conventions.

## Background / current state (architecture facts)

- **Rules see `<head>` + (optionally) images, never page body.** `RuleContext`
  (`packages/core/src/rule.ts`) is `{ heads: ResolvedHead[]; images?:
ResolvedImages[]; project; config }`. `ResolvedHead` exposes only head tags.
- **Image rules are CLI-only.** `ctx.images` is collected by the static provider
  (`collectImages` in `packages/cli/src/providers/source/parse.ts` walks the whole
  AST) and threaded via `packages/cli/src/index.ts`. The rendered (vite) provider
  parses only `<head>` (`parse-html.ts`) and never sets `ctx.images`; `imageRule`
  iterates `ctx.images ?? []`, so it silently no-ops in rendered mode.
- **`imageRule` hardcodes `category: 'performance'`** (`rules/perf/image-rule.ts`).
- **`ImageInfo`/`ParsedImage` do not capture `alt`** — only `hasWidth`,
  `hasHeight`, `hasLoading`, `line` (+ `file`).
- **`appliesTo` is the established pattern for app.html-only tags.** SEO014
  (viewport) uses `appliesTo: (head) => head.source === 'rendered'` because the
  viewport meta lives in `app.html` and is invisible to static route analysis
  (`rules/seo/seo010-015.ts:101`). charset behaves identically.
- **`<meta charset>` is currently dropped by both parsers.** It has neither `name`
  nor `property`; the rendered parser does `if (!name && !property) continue`
  (`parse-html.ts`), and the static parser only records `name`/`property` metas.
  So charset is not captured today.
- **`<link>` `rel` is captured in both modes, but `hreflang` is parsed-then-
  discarded.** `HeadTag` has no `hreflang` field.
- **Project facts** (`Project` in `packages/core/src/types.ts`) are `hasRobotsTxt`,
  `hasSitemap`, `htmlLang: Detection`, `robotsReferencesSitemap?`. `htmlLang` is
  read from `app.html` (static) / rendered `<html lang>` (vite).

## Design

### SEO024 — Character encoding (charset)

A page needs a declared character encoding; without it browsers may guess and
render mojibake. In SvelteKit the tag lives in `src/app.html`
(`<meta charset="utf-8" />` ships in the default template), so it is only visible
in **rendered** analysis — exactly the viewport situation.

**Capture (both parsers, so the tag is modeled even though only rendered evaluates it):**

- Static (`parse.ts` meta branch): if a `<meta>` has a `charset` attribute, push
  `{ kind: 'meta', name: 'charset', value: <static|dynamic|absent of charset attr> }`.
- Rendered (`parse-html.ts` meta loop): before the `if (!name && !property)
continue` guard, detect `meta.getAttribute('charset')` and push
  `{ kind: 'meta', name: 'charset', presence: 'own', value: 'static' }`.

**Rule:** `headTagRule` matching `t.kind === 'meta' && t.name === 'charset'`,
`appliesTo: (head) => head.source === 'rendered'`, `severity: 'warning'`.
(We assert presence only; we do not police `utf-8` vs other encodings — any
declared charset clears the rule.)

> Value note: SvelteKit ships charset by default, so the real-world hit rate is
> low; SEO024 catches projects whose `app.html` dropped it. Cheapest of the four
> and completes the claude-seo "Character Set Declaration" item.

### SEO025 — Image alt text

An `<img>` with no `alt` attribute is invisible to image search and screen
readers. Static analysis can only assert **attribute presence**; an explicit
empty `alt=""` is a valid decorative-image signal and **passes**. Spread props
(`{...rest}`) are treated as possibly-providing-alt (no false positive), matching
how `collectImages` already treats width/height/loading under spread.

**Capture:** add `hasAlt: boolean` to `ParsedImage` (`parse.ts`) and `ImageInfo`
(`packages/core/src/images.ts`). In `collectImages`: `hasAlt = hasSpread ||
Boolean(findAttr(attrs, 'alt'))`.

**Factory change:** generalize `imageRule` to accept an optional
`category?: Category` (default `'performance'`) so this SEO rule reports under
`seo`. The PASS/FAIL Result `category` fields use the option.

**Rule:** `imageRule({ id: 'SEO025', category: 'seo', severity: 'warning', ok:
(img) => img.hasAlt, ... })`. **CLI/static only** (consistent with PERF001/002 —
`ctx.images` is unset in rendered mode, so the rule no-ops there). Documented as a
known mode limitation, like the perf image rules.

### SEO026 — hreflang / x-default validity

International pages use `<link rel="alternate" hreflang="…" href="…">`. The rule
is **opt-in**: it emits nothing unless the route has at least one
`rel="alternate"` link with an `hreflang` (monolingual sites are never flagged).
When present it validates:

1. Each `hreflang` value is well-formed: `x-default`, or a BCP-47 subset
   (language + optional script + optional region, where region is 2 alpha or a
   3-digit UN M49 code, e.g. `es-419`). Malformed → fail.
2. If two or more alternates exist and none is `x-default` → fail
   (recommend adding `x-default`).

**Capture:** add `hreflang?: string` to `HeadTag` (`packages/core/src/head.ts`).

- Static (`parse.ts` link branch): `const hreflang = attrText(node.attributes,
'hreflang')` and spread it when present.
- Rendered (`parse-html.ts` link loop): `const hreflang =
link.getAttribute('hreflang')` and spread it when present.

**Rule:** custom route-scoped rule (not `headTagRule` — it inspects a _set_ of
link tags and validates values). Collects `head.tags.filter(t => t.kind ===
'link' && t.rel === 'alternate' && typeof t.hreflang === 'string')`; if empty →
emit nothing; else PASS or one FAIL per problem. `severity: 'warning'`,
`scope: 'route'`. Works in **both** modes (link tags are captured in both).

### SEO027 — Heading hierarchy (single H1)

Exactly one `<h1>` per page is a core on-page signal; zero (no main heading) or
two-plus (diluted topic) are both flagged. (Skipped-level checks, e.g. h2→h4, are
**out of scope** for this phase — start with the highest-value H1 count.)

This is the only check that requires **page body** content, which no provider
exposes today. We add a new route-scoped channel parallel to images:

**New core types** (`packages/core/src/headings.ts`):

```ts
export interface HeadingInfo {
  level: number;
  line: number;
  file: string;
}
export interface ResolvedHeadings {
  route: string;
  headings: HeadingInfo[];
}
```

**Context:** add `headings?: ResolvedHeadings[]` to `RuleContext` (optional, like
`images`). A mode that does not collect headings leaves it unset and the rule
no-ops.

**Capture (both modes — body is reachable in both):**

- Static (`parse.ts`): add `collectHeadings(ast)` mirroring `collectImages` —
  traverse `CHILD_NODE_KEYS`, match `RegularElement` with `name` in
  `h1`–`h6`, record `level` + `line`. Thread through `routes.ts` (per layer,
  with `file`) and `index.ts` into `ctx.headings`.
- Rendered (`parse-html.ts` / `collect.ts`): `root.querySelectorAll('h1,h2,h3,
h4,h5,h6')` from the full document (node-html-parser parses the whole doc;
  today we only query `<head>`). Thread through `analyze.ts` into `ctx.headings`.

**Rule:** custom route-scoped rule. Per route in `ctx.headings ?? []`: let `h1 =
headings.filter(h => h.level === 1).length`. `h1 === 1` → PASS; `h1 === 0` → FAIL
"Missing `<h1>`"; `h1 > 1` → FAIL "Multiple `<h1>` (N)". `severity: 'warning'`.
A route with no headings collected at all (channel unset) emits nothing.

> Layout note: headings from layout files in the chain count toward the route
> (same as images). A route whose `<h1>` is in `+layout.svelte` is correctly
> credited.

### Registration & surfaces (all four)

- New rule files under `packages/core/src/rules/seo/`; export from
  `rules/index.ts` (`allRules` + re-export) and `src/index.ts`.
- MCP `analyze`/`explain_rule` surface them automatically via `allRules`.
- Docs: 8 reference pages (en + ja for SEO024–027) in the SEO016–023 format
  (title, severity, What it checks, Why it matters, How to fix), each noting mode
  applicability where relevant (SEO024 rendered-only, SEO025 static-only).
- Changeset: `core`/`cli`/`vite`/`mcp` **minor**.

## Testing

- **SEO024:** rendered head with/without `<meta charset>` → pass/fail; static head
  emits nothing (appliesTo). Parser tests: charset captured as
  `{kind:'meta', name:'charset', …}` in both modes.
- **SEO025:** `<img alt="x">` pass; `<img alt="">` pass (decorative); `<img>` with
  no alt fail; `{...rest}` spread pass; rendered mode emits nothing.
- **SEO026:** no alternates → nothing; valid set with x-default → pass; malformed
  hreflang → fail; 2+ alternates w/o x-default → fail. Capture tests for
  `hreflang` in both parsers.
- **SEO027:** 0/1/2 h1 → fail/pass/fail; h1 in layout counts; no-headings →
  nothing. Capture tests: headings collected in both modes incl. layout chain.
- Clean-page fixtures may need a valid `<h1>` / `alt` / charset added (additive,
  no assertions loosened), as in Phase B.
- Full `pnpm -r test` + `typecheck` + `lint` + `docs build` green.

## Out of scope (YAGNI)

- Skipped heading levels (h2→h4), multiple-h1 in `<template>`/shadow content.
- Non-utf-8 charset policing.
- hreflang return-link reciprocity / cross-page graph (needs multi-route join).
- Image alt **quality** (length, keyword stuffing) — presence only.
- Rendered-mode image collection (alt stays CLI-only this phase).
- Everything live/network/API in claude-seo (CrUX, Lighthouse, GSC/GA4,
  backlinks, local/GBP, E-E-A-T, redirects, security headers).

## Suggested delivery

Two PRs to keep review tractable, or one if preferred:

- **PR1 (head/image rules):** SEO024 charset, SEO025 image alt, SEO026 hreflang —
  small, additive capture extensions to existing channels.
- **PR2 (body channel):** SEO027 heading hierarchy — introduces the new
  `ctx.headings` channel in both providers.
