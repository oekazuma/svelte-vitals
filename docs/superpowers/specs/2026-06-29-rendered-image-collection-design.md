# Rendered-mode image collection — image-rule parity (vite)

**Date:** 2026-06-29
**Status:** Approved (1 PR, per maintainer)
**Packages:** `@svelte-vitals/vite` (rendered provider + dev hook), `@svelte-vitals/core` (none — rules unchanged)
**Issue:** #61 (SEO025 rendered-mode parity)

## Goal

Collect `<img>` elements in the **rendered (vite) provider** so the existing
image rules — **PERF001, PERF002, PERF005, PERF006, SEO025** — fire in rendered
mode (build analysis and the dev hook), not only in static (CLI) mode. No new
rules and no core changes; this closes a coverage gap where the vite plugin
silently skipped every image/alt check (`ctx.images` was unset).

## Background

- Image rules iterate `ctx.images ?? []` and no-op when it is unset
  (`image-rule.ts`, `perf005`). Only the CLI provider populates `ctx.images`
  (`collectImages` in `parse.ts` → `routes.ts` → `cli/index.ts`).
- The rendered provider (`parse-html.ts`) parses the whole document already
  (node-html-parser) and already scans `<body>` for headings (SEO027), but does
  not collect `<img>`; `analyze.ts` and the dev `handle.ts` build `ctx` without
  `images`.
- `ImageInfo` = `{ hasWidth, hasHeight, hasLoading, hasAlt, lazy, hasSrcset, line, file }`.

## Design

### Capture (`parse-html.ts`)

Add `images` to `ParsedHtmlHead`. Collect every `<img>` in the **body** (scoped
like the heading scan, so a stray `<head><img>` is ignored; document order, so
PERF005's "first image" heuristic matches the static provider):

```ts
images: (root.querySelector('body') ?? root).querySelectorAll('img').map((img) => ({
  hasWidth: img.hasAttribute('width'),
  hasHeight: img.hasAttribute('height'),
  hasLoading: img.hasAttribute('loading'),
  hasAlt: img.hasAttribute('alt'),
  lazy: img.getAttribute('loading') === 'lazy',
  hasSrcset: img.hasAttribute('srcset'),
  line: 0 // rendered mode does not track source lines
}));
```

Returned shape: `Omit<ImageInfo, 'file'>[]` — the caller fills `file`.

### Threading

- **`collect.ts`** (`collectRenderedHeads`): return `images: ResolvedImages[]`,
  one per route, `file` = the HTML rel path, mirroring how headings are threaded.
- **`analyze.ts`**: pass `images` into the rule context.
- **`hooks/handle.ts`**: build `images` from `parseHtmlHead(...).images` (file =
  route) and pass it into `runRules` context, so the dev overlay also reports
  image findings.

## Behavior change

PERF001/002/005/006 and SEO025 now emit in rendered mode. Rendered fixtures that
contain an `<img>` without dimensions/alt/srcset will newly report — update those
fixtures (additive) or accept the finding where it is correct. Pages with no
`<img>` are unaffected (image rules skip imageless routes).

## Testing

- `parse-html` unit: an `<img>` in the body is collected with the right flags;
  document order preserved; a page with no `<img>` yields `images: []`.
- `collect`: rendered route exposes `ResolvedImages` with `file` set.
- Cross-check: a rendered page with `<img>` missing width/height now trips
  PERF001; missing alt trips SEO025 (integration via `runRules` or the dev hook).
- Full `pnpm -r test` + typecheck + lint + docs build green; fixtures updated as
  needed (no assertions loosened).

## Out of scope

- Source-line numbers for rendered images (stays `line: 0`).
- The remaining #61 items (charset value, hreflang reciprocity, pixel-width).
