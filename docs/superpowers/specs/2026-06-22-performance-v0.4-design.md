# Design: Performance v0.4 (first non-SEO Vitals category)

Issue: [#10](https://github.com/oekazuma/svelte-vitals/issues/10) (roadmap epic). This spec covers **only Performance v0.4** — the first category beyond SEO — plus the multi-category foundation it needs.

## Goal

Add static-analysis **Performance** checks for `<img>` elements (the highest-confidence, highest-impact performance signal a static checker can give), and establish the **multi-category foundation** (per-category findings + per-category scores + category-aware reporters) that Accessibility v0.5 and Upgrade v0.6 will reuse, culminating in the v1.0 weighted Health Report.

Static-analysis-only; **no runtime Core Web Vitals**. Static mode (CLI) first; plugin-mode image checks are a follow-up.

## Scope (v0.4)

Two route-scoped rules over `<img>` elements found in each route's `+page.svelte` and its `+layout.svelte` chain:

- **PERF001 — image dimensions (`warning`).** An `<img>` without an explicit `width` **and** `height` risks layout shift (CLS). A dynamically-bound dimension (`width={w}`) counts as present and **passes** — we never flag a dimension we can't prove is missing (mirrors the SEO "dynamic title passes" stance).
- **PERF002 — image loading hint (`info`).** An `<img>` with no `loading` attribute gets an advisory: set `loading="lazy"` for offscreen images, or keep it eager (and consider `fetchpriority="high"`) for the LCP image. `info` because static analysis cannot know which images are above the fold — this must not produce noisy false-positive failures.

**Out of scope for v0.4** (deferred, tracked under #10): `preload` checks, adapter-config checks, large-import/bundle-size analysis, plugin-mode (output-HTML) image checks, and the v1.0 weighted combined Health Report.

## Findings granularity

One finding **per offending `<img>`**, carrying `category: 'performance'`, `location` (the `.svelte` file the `<img>` is in), and `line` (1-based, from the AST node). Multiple bad images on a route therefore produce multiple findings; scoring dedups per `(route, rule id)` (existing behavior), so a route is not over-penalized for many images, while the report still lists each one with its line.

A `<img>` declared in a `+layout.svelte` appears on every child route, so it is reported per route it renders on (consistent with how inherited head findings already surface per route).

## Architecture & data flow

```text
src/routes/**/+page.svelte (+ layout chain)
  │  parseFile → ParsedFile { headTags, components, imports, images }   ← NEW: images
  ▼
routes.ts resolveRoute  → walks the chain, collects per-route images
  │  → ResolvedImages { route, images: Array<ImageInfo & { file }> }
  ▼
RuleContext { heads, images, project, config }   ← NEW: images
  ▼
runRules(rules) → SEO rules read heads; PERF rules read images
  │  → Result[]  (each Result now carries `category`; PERF results carry `line`)
  ▼
scoring + reporters: split results by category → per-category score + sections
```

### core — types

- **`ImageInfo`** (new, normalized, no AST): `{ hasWidth: boolean; hasHeight: boolean; hasLoading: boolean; line: number }`.
- **`ResolvedImages`** (new): `{ route: string; images: Array<ImageInfo & { file: string }> }` — one per route, mirroring `ResolvedHead`.
- **`RuleContext`** gains `images: ResolvedImages[]`.
- **`Result`** gains `category: Category` (required) and `line?: number` (optional, 1-based). Every existing SEO rule sets `category: 'seo'`; `headTagRule` and the project rules set it centrally.
- A small **`imageRule` factory** (parallels `headTagRule`) builds a route-scoped rule that maps each route's images to findings via a per-image predicate.

### cli — provider

- `parse.ts`: extend the template walk (the existing `collectComponents`/`CHILD_NODE_KEYS` traversal) to also collect `<img>` `RegularElement`s, recording attribute presence (`width`/`height`/`loading`) and the node's 1-based line (derived from `node.start` + the source, or the AST's location if present). Add `images: ParsedImage[]` to `ParsedFile`.
- `routes.ts`: in `resolveRoute`, collect images from every file in the chain (page + layouts) into one `ResolvedImages` for the route, tagging each image with its source `file`. Feed `images` into the `RuleContext` passed to `runRules`.

### core — scoring (per-category)

- Compute a score **per category** by running the existing `computeScore` over the category's result subset: `computeScore(results.filter(r => r.category === 'seo'), …)` and `computeScore(results.filter(r => r.category === 'performance'), …)`. The route-average + critical-cap model is reused unchanged; Performance has no `critical` rule, so the cap simply never binds.
- A new helper `scoresByCategory(results, config): Record<Category, ScoreResult>` (only for categories that have findings) centralizes this so reporters don't each re-filter.
- The CLI headline keeps the **SEO score as primary** (preserving existing output/exit semantics) and additionally surfaces the **Performance score**. The combined weighted Health Report is explicitly a v1.0 concern.

### core — reporters (category-aware)

All reporters group findings by `category` and show each category's score:

- **console**: an `SEO` section (unchanged formatting) followed by a `Performance` section (its score + findings, each with `file:line`).
- **json**: add a top-level `categories` map — `{ seo: { score, … }, performance: { score, … } }` — and tag each issue with its `category`; the existing top-level `score` stays = the SEO score for backward compatibility.
- **agent**: generalize the heading from "SEO fixes" to "fixes", group remediation by category then file.
- **sarif / github**: include Performance findings (the rule id + `line` already give SARIF/GitHub the location); no structural change beyond carrying the new findings.

`summary`/`hasFailureAtOrAbove`/exit codes are unchanged: PERF findings count by their effective severity, and under the default `--fail-on=critical` the warning/info PERF findings do not fail the build.

## Error handling

No new failure modes. Files that fail to parse already surface as execution errors (exit 2) in the existing pipeline; image collection rides the same parse and inherits that behavior.

## Testing (TDD)

- **core**: `imageRule`/PERF001/PERF002 over synthetic `ResolvedImages` (present dims pass; missing dims → penalized; dynamic dims pass; missing `loading` → info); `scoresByCategory` returns independent SEO/Performance scores; every rule exposes a `category`.
- **cli**: `parseFile` collects `<img>` attribute presence + line; a `<img>` in a layout surfaces on child routes; an `<img>` inside a block (`{#if}`/`{#each}`) is found (reuses the existing traversal-coverage approach).
- **reporters**: console shows a Performance section + score; json carries `categories` + per-issue `category`; agent groups by category.
- All existing SEO tests stay green (adding `category` to results and a Performance section must not change SEO output or scores).

## Roadmap / release

- README roadmap: note Performance checks shipping at `0.4` (first category beyond SEO); keep A11y/Upgrade and the v1.0 Health Report as upcoming.
- Changeset: `@svelte-vitals/core` minor (new rules, types, scoring, reporters) and `svelte-vitals` minor (image collection in the provider). `@svelte-vitals/vite` unchanged (plugin-mode image checks deferred).

## Non-goals / follow-ups

- Plugin-mode (`@svelte-vitals/vite`) image checks on prerendered HTML.
- `preload`, adapter-config, and large-import performance rules.
- Per-image precise locations beyond `line` (e.g. column), and report-level dedup of a shared layout image across routes.
- The v1.0 weighted combined Health Report (how SEO/Performance/A11y/Upgrade roll up into one number).
