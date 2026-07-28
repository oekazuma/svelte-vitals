# Design: Rule index pages for the docs site

The docs site has one reference page per rule under `rules/<category>/<slug>.md`, but nothing at `/rules` or `/rules/<category>`. A reader who wants to know _what svelte-vitals actually checks_ has to expand the sidebar and read every leaf label; there is no page that lists the rules with their severity and a one-line summary. This adds those landing pages, generated from the rule registry so they cannot drift.

## Goal

Add a landing page at `/rules` and at each `/rules/<category>`, in both locales, listing every rule with its severity and summary. The listings are **generated** from `allRules` plus the per-locale rule-page frontmatter, and a test fails the build when a committed listing no longer matches what the generator would produce.

## Pages

Twelve new content files (six per locale):

```
docs/src/content/docs/rules/index.mdx                 → /rules
docs/src/content/docs/rules/seo/index.mdx             → /rules/seo
docs/src/content/docs/rules/performance/index.mdx     → /rules/performance
docs/src/content/docs/rules/correctness/index.mdx     → /rules/correctness
docs/src/content/docs/rules/security/index.mdx        → /rules/security
docs/src/content/docs/rules/architecture/index.mdx    → /rules/architecture
docs/src/content/docs/ja/rules/…                      → /ja/rules, /ja/rules/seo, …
```

Blume maps an `index` file to its folder's route and sorts it first within the folder, so these become the section landing pages with no config change.

`.mdx` (not `.md`) for all of them: the top-level page uses `Card`/`CardGroup`, and MDX keeps directives available if a page later needs a callout. Plain `.md` would render `:::note` as literal text.

**`/rules`** — hand-written intro, then a generated block containing:

- a `CardGroup` of the five categories: category label, one-line description, rule count, link to the category page;
- one `##` heading per category, each followed by that category's rule table.

**`/rules/<category>`** — hand-written intro, then a generated block containing the category description and that category's rule table.

**Table shape** — three columns:

| Column   | Source                                                          |
| -------- | --------------------------------------------------------------- |
| Rule     | `rule.id` as inline code, linked to the rule page               |
| Severity | `rule.severity`, rendered as 🔴 critical / 🟡 warning / 🔵 info |
| Summary  | the locale's rule page frontmatter `description`                |

Rows sort by rule id (alphabetical) — predictable to scan and to diff; severity stays visible as its own column. The severity glyphs match the console reporter and the CI job-summary tables, so the docs read the same way as the tool's output.

Links are root-relative in the style the guides already use: `/rules/seo/title-length` in en, `/ja/rules/seo/title-length` in ja.

No "has options" column. Per-rule options are documented on each rule page and in the configuration guide; a fourth column earns less than it costs.

## Sidebar

Add `meta.ts` to the rules folder and to each category folder, in both locales:

- `rules/meta.ts` — `{ title: 'Rules' }` / `{ title: 'ルール' }`, ordered after Guides.
- `rules/<category>/meta.ts` — the display label and `order` following core's `CATEGORIES` (seo, performance, correctness, security, architecture), matching the order the CLI reports categories in.

Without this, Blume humanizes the folder name and the SEO group reads `Seo`, and the five groups sort alphabetically rather than in report order.

## Generation

Two scripts in `packages/cli/scripts/`, mirroring the existing `gen-action-pin.mjs` / `resolve-action-pin.mjs` split:

- **`rules-index.mjs`** — pure rendering. Given a locale, `allRules`, and the docs content directory, it returns a map of file path → generated block text. No writes, so the guard test can call it directly.
- **`gen-rules-index.mjs`** — the entry point. Calls the renderer and rewrites each target file's generated block. Exposed as `pnpm --filter svelte-vitals run gen:rules-index`, run manually when rules change (like `update-action-pin`, not on every build).

They live in `packages/cli` because that package already owns the docs-consistency test (`packages/cli/test/docs-links.test.ts`) and depends on `@svelte-vitals/core`, whose `dist` the `test` job builds before running.

**Inputs**

- `allRules` from `@svelte-vitals/core` — rule id, category, severity. The single source of truth for which rules exist.
- Each locale's `rules/<category>/<slug>.md` frontmatter `description` — the summary column, already written in the right language for both locales.
- A `CATEGORY_DESCRIPTIONS` map inside `rules-index.mjs`, keyed by locale then category (ten short strings). The category blurbs have no other home: core has no localized prose, and duplicating them across the top-level page and the category pages would let the two drift.

**Generated block markers**

Each target file contains:

```
<!-- rules-index:start -->
…generated…
<!-- rules-index:end -->
```

The generator replaces only what is between the markers; everything else in the file — frontmatter, intro prose, any added notes — is hand-written and preserved.

**Escaping** — summaries contain raw angle brackets (`Every route should resolve a non-empty <title>.`). In MDX that parses as JSX and breaks the build, so the renderer escapes `<` → `&lt;`, `{` → `&#123;`, and `|` → `\|` inside table cells.

## Guard test

`packages/cli/test/rules-index.test.ts`:

- regenerates every block and asserts the committed file content between the markers matches, with a failure message naming the regeneration command;
- asserts every rule in `allRules` appears exactly once across the category tables.

`packages/cli/test/docs-links.test.ts` needs one change: its "no stray rule pages without a matching rule" case lists every file under the rules directories and expects each to be `<rule id>.md`. The new `index.mdx` and `meta.ts` files must be excluded from that check.

## Verification

- `pnpm test` — the new guard test plus the updated docs-links test.
- `pnpm lint` — oxlint/oxfmt over the new scripts and content.
- `pnpm --filter docs check` and `pnpm --filter docs build` — validates frontmatter, routes, and internal links, including every generated rule link.

Docs-only change, so no changeset.

## AGENTS.md

The "Adding a rule" checklist gains one step: after adding the en/ja rule pages, run `pnpm --filter svelte-vitals run gen:rules-index` and commit the regenerated index pages.

While editing that section, correct its stale filename convention: rule sources are `packages/core/src/rules/<dir>/<slug>.ts` (no `xxxNNN-` prefix), and the Performance directory is `perf/`, not `performance/`. The four registration sites and the `rules/<id>.md` doc paths it describes are still accurate and stay as written.
