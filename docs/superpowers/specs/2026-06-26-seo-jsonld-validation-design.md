# Design: JSON-LD validation (SEO Phase C)

Validate the **content** of a route's JSON-LD structured data, not just its presence (SEO008). This brings svelte-vitals to parity with the static, source-decidable structured-data checks a comprehensive SEO toolkit performs — within svelte-vitals' nature: pure static analysis of the resolved `<head>`, no browser, no web data, no new dependencies.

SEO008 (JSON-LD presence) stays as-is; SEO016–SEO021 validate the JSON-LD that _is_ present.

## Goal

For each route whose head contains a **static** `<script type="application/ld+json">`, capture its literal content and validate it. Six new rules:

| ID         | Check                                                                                                                                                                                              | Severity  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **SEO016** | **Validity** — the JSON-LD parses, and has both `@context` and `@type`                                                                                                                             | `warning` |
| **SEO017** | **Deprecated/restricted type** — `@type` is in a curated list whose rich results Google dropped/restricted (e.g. `HowTo`, `FAQPage`, `ClaimReview`)                                                | `info`    |
| **SEO018** | **Relative URL** — a value under a known URL key (`url`, `@id`, `image`, `logo`, `sameAs`, `contentUrl`, `thumbnailUrl`) is relative, not absolute                                                 | `warning` |
| **SEO019** | **Non-ISO-8601 date** — a value under a known date key (`datePublished`, `dateModified`, `dateCreated`, `startDate`, `endDate`, `uploadDate`, `validFrom`, `expires`) is not ISO-8601              | `info`    |
| **SEO020** | **Placeholder text** — a value contains obvious unreplaced placeholder/boilerplate (`lorem ipsum`, `your company`, `your-domain`, `example company`, etc.)                                         | `info`    |
| **SEO021** | **Required properties** — for a recognized `@type`, Google's required properties for its rich result are present (e.g. `Article`→`headline`+`datePublished`+`image`, `Product`→`name`+`offers`, …) | `warning` |

## No false negatives / no schema-soup

- Rules run only on a **static, parseable** JSON-LD object. A dynamic `{@html …}` / `{JSON.stringify(…)}` JSON-LD yields no literal content → **not captured → skipped** (never flagged).
- SEO018/SEO019 act only on a **closed, well-known key list** (above) — never on arbitrary strings — so a non-URL/non-date string is never mis-flagged.
- SEO020 uses a small, conservative placeholder vocabulary; only obvious template leftovers match.
- SEO021 validates only **recognized** `@type`s from the curated table; an unknown/custom `@type` is not flagged (no false positives), and the table lives in a dedicated data module (the only ongoing-maintenance surface, justified by direct rich-result eligibility impact).

## Capture (model + both providers)

- **`HeadTag.jsonld?: string`** (core `head.ts`) — the literal JSON-LD script content, set **only** when the script is static. Undefined for a dynamic script.
  - CLI (`parse.ts`): the jsonld branch already computes `value` via `valueFromNodes`; when that is `static` (no `ExpressionTag`), also join the `Text` nodes into the raw string and set `jsonld`.
  - vite (`parse-html.ts`): `script.text` is the literal content (rendered HTML is always literal) → set `jsonld: script.text`.

## Validation engine (core, pure)

A new internal module `packages/core/src/rules/seo/jsonld/` (no `node:`, no deps — `JSON.parse` only):

- **`parseJsonLd(raw: string): { ok: boolean; nodes: JsonLdObject[] }`** — `JSON.parse` in try/catch; on success, flattens to the list of structured-data objects: the top-level object, every member of a top-level array, and every member of an `@graph` array (so nested graphs are covered). `ok:false` on parse error.
- **`collectValues(nodes, keys): string[]`** — recursively walks each node (objects + nested objects + arrays) collecting string values found under any key in `keys` (used by SEO018 URL keys, SEO019 date keys; recursion handles nested entities like `Product.offers.priceCurrency`-style structures).
- **`REQUIRED_PROPS: Record<string, string[]>`** — the curated `@type` → required-property-names table (Article/BlogPosting/NewsArticle, Product, BreadcrumbList, Organization, WebSite, Event, Recipe, Person, VideoObject — ~10 types). A dedicated data file with a comment citing Google's structured-data docs.
- Helpers: `isAbsoluteUrl(s)`, `isIso8601(s)`, `hasPlaceholder(s)`, `DEPRECATED_TYPES: Set<string>`.

## Rules (core)

- **SEO016** — custom rule: for each head jsonld tag with raw content, `parseJsonLd`. If `!ok` → "JSON-LD is not valid JSON" finding; else if no node has `@context` → "missing @context"; else if no node has `@type` → "missing @type"; else pass (seeds the category). Distinct messages per failure mode.
- **SEO017–SEO021** — share a small `jsonldRule` helper that iterates heads' jsonld tags, parses (skips when `!ok` — SEO016 owns parse failures), runs a predicate over the flattened nodes, and emits a finding per offending node/value (or one per tag), mirroring the imageRule/linkRule emission contract (no relevant signal → nothing; pass → seed; fail → finding + fix). Each rule supplies its predicate:
  - SEO017: any node's `@type` ∈ `DEPRECATED_TYPES`.
  - SEO018: any `collectValues(nodes, URL_KEYS)` value fails `isAbsoluteUrl`.
  - SEO019: any `collectValues(nodes, DATE_KEYS)` value fails `isIso8601`.
  - SEO020: any string value (shallow scan of node values) matches `hasPlaceholder`.
  - SEO021: for each node whose `@type` ∈ `REQUIRED_PROPS`, every listed property is present on that node.

All six registered in `allRules` (`rules/index.ts`) and exported from the core index. SEO016/021 findings use `detection:{presence:'none',value:'absent'}` (penalized); passing/seeding uses `{presence:'own',value:'static'}` — same convention as the existing rules.

## Coverage note (honest)

Static (CLI) mode's head composition collapses multiple `<svelte:head>` JSON-LD scripts to one representative (`tagKey: 'jsonld'`, last-wins), so it validates one per route; **rendered / plugin mode validates every JSON-LD script**. Same documented static-vs-rendered limitation as the resource-hint rules. A dynamic JSON-LD (the common `{@html JSON.stringify(...)}` pattern) is not validated in static mode (no literal); plugin/rendered mode sees the final JSON and validates it.

## Testing

- **engine unit tests** (`packages/core/test/jsonld-engine.test.ts`): `parseJsonLd` ok/parse-error/`@graph`-flatten/array-flatten; `collectValues` nested recursion; `isAbsoluteUrl`/`isIso8601`/`hasPlaceholder`; the required-props table shape.
- **rule tests** (`packages/core/test/seo-jsonld-rules.test.ts`): SEO016 invalid-JSON/missing-@context/missing-@type/valid; SEO017 deprecated type; SEO018 relative vs absolute under each URL key; SEO019 non-ISO vs ISO under date keys; SEO020 placeholder hit/miss; SEO021 missing required prop per type / complete / unknown type ignored; all rules skip a dynamic (uncaptured) JSON-LD; `@graph` and nested-object cases.
- **provider capture tests**: CLI `parse.ts` — static jsonld → `jsonld` raw string set; dynamic `{@html ...}` → unset. vite `parse-html.ts` — `script.text` captured.
- **docs link integrity**: `packages/cli/test/docs-links.test.ts` requires en+ja pages for SEO016–021.

## Documentation

Rule pages `docs/src/content/docs/rules/seo0{16..21}.md` + `ja/` counterparts (12 pages), matching the SEO template.

## Release

`@svelte-vitals/core` + `svelte-vitals` + `@svelte-vitals/vite` + `@svelte-vitals/mcp` **minor**.

## Non-goals / follow-ups

- **Microdata / RDFa** structured data (body-markup formats) — svelte-vitals resolves the head + `<img>` only; body parsing is a separate capability.
- Schema property **value-type** validation beyond presence (e.g. `offers.price` is a number) — deeper than required-property presence; revisit if needed.
- The remaining static SEO gaps still open after this increment — **title/description length** (Phase B, literal-text capture), **hreflang single-page validity** (value capture), **image `srcset`/format/filename**, and **H1/heading hierarchy** (needs body-markup parsing) — each its own future increment.
