# SEO follow-ups batch 1 — uniqueness & heading order (SEO028–SEO030)

**Date:** 2026-06-29
**Status:** Approved (1 PR, per maintainer)
**Packages:** `@svelte-vitals/core` (rules only — no capture changes), `svelte-vitals` / `@svelte-vitals/vite` / `@svelte-vitals/mcp` (surface via `allRules`)
**Issue:** #61

## Goal

Three SEO rules that **reuse existing capture** (the `text` field from Phase B and
the `ctx.headings` channel from Phase D) — no parser/model changes:

| ID     | Check                                    | Severity | Scope | Modes |
| ------ | ---------------------------------------- | -------- | ----- | ----- |
| SEO028 | Duplicate `<title>` across routes        | warning  | route | both  |
| SEO029 | Duplicate meta description across routes | warning  | route | both  |
| SEO030 | Skipped heading level (e.g. h2 → h4)     | info     | route | both  |

## Design

### SEO028 / SEO029 — cross-route uniqueness

A route-scoped rule still receives **all** routes in `ctx.heads`, so it can detect
duplicates across the site. Build a shared `uniquenessRule` factory:

- For each head, find the matching tag (`kind: 'title'`, or `kind: 'meta' && name
=== 'description'`) with a captured `text`. Normalize with the same trim +
  whitespace-collapse used by `visibleLength` (case-sensitive).
- Group routes by normalized text. A group of **2+ routes** → each route fails
  ("Title is duplicated across N routes"). A route whose text is unique → pass.
- Routes whose title/description is dynamic/absent (no `text`) → emit nothing
  (uniqueness is unknowable; presence is SEO001/002's concern).

Most effective in rendered mode (titles are concrete); in static mode dynamic
`{data.title}` routes are simply skipped (no false positives).

`detection`: fails use `PENALIZED`, passes use `PASS` (shared `detection.ts`).
`location`: the matching tag's `file ?? head.file`.

### SEO030 — skipped heading level

Reuses `ctx.headings` (document-ordered levels). Walking the route's headings in
order, flag a heading whose level jumps more than +1 over the previous heading
(e.g. `<h2>` directly followed by `<h4>`). The first heading has no predecessor,
so the check starts at the second; missing/multiple `<h1>` stays SEO027's concern.

- Route with headings and no skip → pass; with a skip → one fail per skip
  (`info`); route with no headings → emit nothing.

## Registration & surfaces

- New files `packages/core/src/rules/seo/seo028-029-uniqueness.ts` and
  `seo030-heading-order.ts`; export via `rules/index.ts` (`allRules` + re-export)
  and `src/index.ts`. MCP surfaces via `allRules`. 6 docs pages (en+ja). Changeset
  core/cli/vite/mcp **minor**.

## Testing

- SEO028/029: two routes same title → both fail; unique titles → pass; dynamic
  title route → nothing; a single route → pass.
- SEO030: h1→h2→h3 → pass; h2→h4 → fail; no headings → nothing.
- Full `pnpm -r test` + typecheck + lint + docs build green. Clean-page fixtures
  stay clean (per-route unique titles already differ).

## Out of scope (still tracked in #61)

- Rendered-mode `<img>` collection (SEO025/PERF parity) — larger, belongs with a
  Performance/parity batch.
- hreflang return-link reciprocity (cross-route graph).
- charset value policing (non-utf-8); pixel-width title/description measurement.
