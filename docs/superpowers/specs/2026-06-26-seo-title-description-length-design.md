# SEO Phase B — title / description length (SEO022, SEO023)

**Date:** 2026-06-26
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (rules + capture model), `@svelte-vitals/cli` (static capture), `@svelte-vitals/vite` (rendered capture), `@svelte-vitals/mcp` (surfaces new rules)

## Goal

Add two route-scoped SEO rules that validate the **length** of the document
`<title>` and the `<meta name="description">` content, the planned follow-up
("Phase B") to the JSON-LD content rules (SEO016–021). Length is a soft
optimization signal, so both rules are `info`.

- **SEO022 — Title length:** flag a static title shorter than 30 or longer than
  60 characters.
- **SEO023 — Description length:** flag a static meta description shorter than
  70 or longer than 160 characters.

Both rules check **both sides** (too short and too long) and run **only on
static text**. Presence/emptiness remains owned by SEO001 (title) and SEO002
(description); the length rules emit no signal when the value is dynamic or
absent.

## Background / current state

- `HeadTag` (`packages/core/src/head.ts`) carries `value: 'static' | 'dynamic' |
  'absent'` but **not** the literal text of a title or description. JSON-LD added
  a literal-capture field (`jsonld?: string`, set only when static); this design
  follows the same pattern for title/description text.
- Presence rules use the `headTagRule` factory (`seo002-005-008.ts`). The length
  rules need the literal text, so they are a separate, small factory.
- Static (CLI) capture: `packages/cli/src/providers/source/parse.ts`
  (`textFromNodes` for fragment text, `attrText` for attribute values).
- Rendered capture: `packages/vite/src/providers/rendered/parse-html.ts`
  (node-html-parser).

## Design

### 1. Capture model — `HeadTag.text`

Add an optional field to `HeadTag`:

```ts
/** Literal visible text of a static <title> or <meta name="description"> content, set only when static. Undefined when dynamic. */
text?: string;
```

- **Title:** the inner text of `<title>`.
- **Description:** the `content` attribute value of `<meta name="description">`.
- Set **only** when the value is static (no Svelte expression / interpolation).
  Dynamic → leave `text` undefined, exactly like `jsonld`.

#### Entity handling (important, differs from JSON-LD)

`<script type="application/ld+json">` is a **raw-text** element — browsers do not
decode entities — so JSON-LD capture uses `rawText`. By contrast, `<title>` is an
**RCDATA** element and `content="…"` is an **attribute**; in both, HTML entities
**are** decoded by the browser, and the decoded text is what appears in the SERP.
Length must be counted against that visible text, so rendered capture uses the
**decoded** forms:

- Title: `titleEl.text` (node-html-parser decodes RCDATA).
- Description: `el.getAttribute('content')` (already decoded).

Static (CLI) capture reads literal Svelte `Text` nodes / attribute text; these
contain no HTML entities in practice (authors write the literal characters), so
no extra decoding step is required there.

### 2. Length measurement — `visibleLength`

A pure, dependency-free helper (added next to the JSON-LD engine, e.g.
`packages/core/src/rules/seo/text-metrics.ts`):

```ts
/** Visible character count as a SERP would show it: trimmed, internal whitespace runs collapsed, counted by code point. */
export function visibleLength(s: string): number {
  const collapsed = s.trim().replace(/\s+/g, ' ');
  return [...collapsed].length;
}
```

- `trim()` + collapse `\s+` → single space mirrors how search engines render
  whitespace.
- `[...collapsed].length` counts Unicode code points (so a 2-code-unit emoji
  counts once, not twice). Grapheme clusters are not split further — acceptable
  approximation for a character heuristic.

### 3. Rules — `seo022-023.ts`

A small `lengthRule` factory builds both rules:

```ts
interface LengthRuleOptions {
  id: string;            // 'SEO022' | 'SEO023'
  title: string;
  label: string;         // PASS message
  noun: string;          // 'Title' | 'Description'
  match: (t: HeadTag) => boolean;
  min: number;
  max: number;
  recommendation: string;
  rationale: string;
}
```

Behavior per route (`scope: 'route'`, `severity: 'info'`, `category: 'seo'`):

1. Find the matching tag (title, or `meta[name=description]`).
2. If no tag, or `tag.text` is undefined (dynamic/absent) → **emit nothing**
   (no signal; presence is SEO001/002's concern).
3. `len = visibleLength(tag.text)`.
4. `len < min` → fail "too short"; `len > max` → fail "too long"; else → PASS.

Thresholds:

```ts
const TITLE = { min: 30, max: 60 };
const DESCRIPTION = { min: 70, max: 160 };
```

Messages:

- Fail short: `${noun} is too short (${len} chars; aim for ${min}–${max})`
- Fail long: `${noun} is too long (${len} chars; aim for ${min}–${max})`
- Pass: the `label` (e.g. `Title length`).

Detection objects reuse the existing convention (`PENALIZED = { presence:
'none', value: 'absent' }` for fails, `PASS = { presence: 'own', value:
'static' }` for passes), matching `seo016-021.ts`.

| ID | Check | Severity | Range |
|----|-------|----------|-------|
| SEO022 | Title length | info | 30–60 chars |
| SEO023 | Description length | info | 70–160 chars |

### 4. Registration & surfaces

- Export `seo022TitleLength`, `seo023DescriptionLength` from
  `rules/seo/seo022-023.ts`, re-export through `rules/index.ts` and
  `src/index.ts`, and add both to `allRules`.
- MCP `analyze` / `explain_rule` surface them automatically via `allRules` /
  rule metadata (no MCP code change beyond the version bump).
- Docs: 4 reference pages — `docs/src/content/docs/rules/seo022.md`,
  `…/seo023.md`, and the `ja/` equivalents — following the SEO016–021 page
  format (title, severity, What it checks, Why it matters, How to fix).

### 5. Capture sites

- **CLI** (`parse.ts`):
  - Title branch: set `text` from `textFromNodes(title fragment)` (already
    computes the static literal; undefined when dynamic).
  - Description branch (`<meta name="description">`): set `text` from
    `attrText(attributes, 'content')` when static.
- **vite** (`parse-html.ts`):
  - Title: `{ kind: 'title', …, ...(titleText ? { text: titleText } : {}) }`
    using `titleEl.text`.
  - Description meta: `…, ...(content ? { text: content } : {})` using
    `getAttribute('content')`.

Title and description each have a single stable tag key (`'title'`,
`'meta:name=description'`), so the static-mode collapse that affects multiple
JSON-LD scripts does not apply here.

### 6. Changeset

`@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`,
`@svelte-vitals/mcp` — **minor** (all surface the two new rules), matching the
SEO016 changeset shape.

## Testing

- **`visibleLength`** (core unit): trims, collapses internal whitespace,
  counts code points (emoji = 1), empty/whitespace → 0.
- **Capture** (cli `parse` + vite `parse-html`): title and description `text`
  captured when static; undefined when dynamic; title entities decoded in
  rendered mode (`Caf&eacute;` → counted as `Café`).
- **Rules** (core): for each of SEO022/SEO023 — too short (fail), in range
  (pass), too long (fail), dynamic (no signal), absent (no signal).
- Full suite + typecheck + lint + `docs build` green; no assertions loosened.

## Out of scope (YAGNI)

- Cross-route uniqueness/duplication of title/description.
- Pixel-width measurement (font-metrics table).
- Configurable thresholds.

These can be separate follow-ups if demand appears.
