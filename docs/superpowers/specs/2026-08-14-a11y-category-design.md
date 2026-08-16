# Design: Accessibility category (a11y) — Phase 1

**Supersedes** `2026-06-23-remove-a11y-design.md`. What that removal dropped was v0.5's
aggregation of the Svelte compiler's `a11y_*` warnings, under the then-current product thesis
of "SEO + deep static Performance only". Both premises have moved: the analyzer now ships five
categories, and this design adds **native rules** — including resolved cross-component analysis
no per-file tool can perform — rather than re-surfacing compiler output. The removal doc's
"compiler / eslint-plugin-svelte / axe already cover a11y" argument is addressed head-on below
(see _Deliberate overlap_).

## Goal

Add an **Accessibility** category (`a11y`) of native, statically-checked markup rules, modeled
on the check catalog established by file-scoped markup linters, but Svelte-aware. The product goal is deliberate: svelte-vitals is an
all-in-one quality gate for SvelteKit apps, so overlap with standalone markup linters (and with the Svelte
compiler's warnings) is accepted where the rule earns its place in a scored, CI-gated report.

Differentiation over standalone markup linters (which process `.svelte` files one file at a
time, via parser plugins):

1. **Resolved cross-component analysis** — svelte-vitals composes the route (layout chain +
   page + transitively rendered components) the way it already does for `<head>` and headings,
   so it can catch duplicated `<main>` landmarks, duplicate `id`s, and dangling
   `for`/`aria-labelledby` references that only exist _after_ composition. File-scoped linters
   compensate for this blindness with a hand-written component-to-element mapping in config; svelte-vitals resolves
   project components automatically.
2. **Scored and gated** — findings feed the per-route category score, suppressions file,
   `--min-health`, and every reporter, instead of a separate lint log.

## Deliberate overlap

Three Phase 1 rules (`invalid-role`, `unknown-aria-attribute`, `required-aria-props`) overlap
Svelte compiler warnings (`a11y_unknown_role`, `a11y_unknown_aria_attribute`,
`a11y_role_has_required_aria_props`). They are still implemented natively because the compiler
only streams warnings into the build log — it does not score, gate, suppress per-line with the
project's suppressions machinery, or appear in the health report. This is a product decision,
not an oversight; it is the same "all-in-one gate" reasoning that admits markup-linter overlap.
Aggregating the compiler warnings themselves (the removed v0.5 approach) stays out of scope; if
ever wanted, it is an additive "one more source" increment that this design does not depend on.

## The candidate check matrix

Every check in the surveyed file-scoped linter catalog, classified. Validated against a
real-world lint config for a production SvelteKit app — its enabled/disabled choices match
this classification.

### Not adopted — Svelte/toolchain already guarantees it, or out of scope

| surveyed check                                                                                                                             | reason                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `attr-duplication`                                                                                                                         | Svelte compiler errors on duplicate attributes                 |
| `end-tag`, `no-orphaned-end-tag`                                                                                                           | Svelte parser errors on malformed markup                       |
| `character-reference`, `case-sensitive-attr-name`, `case-sensitive-tag-name`, `attr-value-quotes`                                          | parser/formatter territory (oxfmt)                             |
| `class-naming`, `no-hard-code-id`                                                                                                          | naming conventions, not markup health                          |
| `no-use-event-handler-attr`                                                                                                                | Svelte events are directives/properties, not string attributes |
| `no-boolean-attr-value`, `no-default-value`                                                                                                | HTML style nits; formatter territory                           |
| `heading-levels`                                                                                                                           | covered by `seo/heading-level-skip` (stays in SEO — decided)   |
| `required-h1`                                                                                                                              | covered by `seo/single-h1` (stays in SEO)                      |
| `no-consecutive-br`, `no-empty-palpable-content`, `table-row-column-alignment`, `no-ambiguous-navigable-target-names`, `neighbor-popovers` | low value-per-rule; revisit on demand (Phase 3 pool)           |

The existing a11y-adjacent SEO rules (`seo/image-alt`, `seo/html-lang`, `seo/single-h1`,
`seo/heading-level-skip`) **stay in SEO** — rule IDs, suppressions, and configs keep working;
the a11y category covers new ground only.

### Phase 1 (this design) — 15 rules, data needs met by `aria-query` + small hand-rolled constants

See _Phase 1 rules_ below.

### Phase 2 (separate design) — rules needing per-element HTML spec data

`permitted-contents` (full content models), `invalid-attr`, `required-attr` (generic),
`deprecated-element`, `deprecated-attr`, `ineffective-attr`. The data source (own dataset vs a
published data-only spec dataset) is that design's central question.

### Phase 3 (separate design) — config-driven rules and the selector problem

`required-element`, `disallowed-element` (project-specific declarations), plus a decision on
selector-scoped configuration: file-scoped linters target CSS selectors for per-element overrides, while
svelte-vitals `overrides` target file globs. Also the Phase 3 pool above.

## Category infrastructure

- `Category` union (`packages/core/src/types.ts`) gains `'a11y'` (6th category).
- `ComponentCategory` (`packages/core/src/rules/component-rule.ts`) gains `'a11y'`.
- Console reporter `CATEGORY_ORDER` / `CATEGORY_LABEL` gain `a11y` / `'Accessibility'`.
- Scoring, json/agent/sarif/github reporters, suppressions, `--rules`/`--ignore`, and rule
  options are category-generic — no changes. The removal design
  (`2026-06-23-remove-a11y-design.md`) is the reverse checklist of these touchpoints.
- Rule IDs use the `a11y/` prefix (matching the `Category` value, as `performance/*` does).
  Source directory `packages/core/src/rules/a11y/`; docs directory
  `docs/src/content/docs/rules/a11y/` (en) + `ja/rules/a11y/` (ja).

## Detection principle: literals only

Svelte attributes are frequently expressions (`role={x}`, `id={y}`). Every Phase 1 rule
inspects **static literal values only** and treats an expression as "unknowable → skip"
(consistent with `security/javascript-url`). For presence checks (e.g. required ARIA props), an
expression-valued attribute counts as _present_. False negatives are acceptable; false
positives are not.

### Control-flow semantics (route-scoped counting)

The existing source walkers are flat: element walks traverse `{#if}`/`{#each}`/`{#await}`
bodies without branch context (`CHILD_NODE_KEYS` in the source provider's `parse.ts`), and
`ComponentUse` (`{name, attributes, hasSpread}`) records component usages with no block
context either. Flat counting is fine for the existing `info`-severity rule but not for
`warning`-severity duplication rules — `{#if a}<main>…{:else}<main>…{/if}` renders one
`<main>`, never two, and the same holds one level up
(`{#if admin}<AdminShell/>{:else}<PublicShell/>{/if}` where each shell contains a `<main>`).

The a11y route collection is therefore a **new branch-aware fold** over both element
occurrences **and component usages** — it reuses the existing route/component _resolution_
(which files compose the route) but not the flat occurrence lists:

- Within one exclusive branch, contributions **sum** (elements + the recursive contributions
  of component usages in that branch).
- Across `{#if}`/`{:else if}`/`{:else}` branches (and `{#await}` states), the fold takes the
  **maximum**, never the sum — for elements and component subtrees alike.
- Anything under `{#each}` or inside a `{#snippet}` definition — elements _and_ component
  usages, at any depth — renders 0..N times, statically unknowable, and is **excluded from
  duplication counting** (false negative by design; a prerender that renders N ≥ 2 catches it
  in rendered mode).
- The exclusions above apply to _duplication counting only_. `no-missing-id-ref`'s `id`
  candidate set is optimistic: a literal `id` from any branch, any `{#each}`/`{#snippet}`
  body, any resolved component, **or `src/app.html`** (the rendered document includes the
  shell, and its ids — `id="app"`, anchor targets — are already read by
  `collectProjectFacts`) satisfies a reference. References are checked wherever they appear.

Rendered mode counts the actual prerendered DOM. Divergence is **bidirectional by design**:
rendered mode catches runtime multiplicity source mode excludes (an `{#each}`-duplicated
`id`), while source mode fires on branch combinations a given prerender didn't take (layout
`<main>` + `{#if a}<main>{/if}` with `a` false at prerender time). Tests assert each mode's
documented behavior on targeted fixtures — neither parity nor a superset claim.

### Open world vs closed world (route-scoped rules)

Component resolution is open-world: layer-2/adapter components, node_modules imports, and
chains beyond the resolver's `MAX_DEPTH` contribute nothing (strict). The route-scoped rules
split accordingly:

- **Existential rules** (`duplicate-landmark`, `top-level-landmark`, `id-duplication`) claim
  "two of these exist" — sound under an open world, because unresolved components can only
  _add_ occurrences, never remove the ones found. They run on every route; unresolved
  components merely cost false negatives.
- **`no-missing-id-ref` is universal** ("no element anywhere defines this id") and needs a
  closed world. It runs only on routes whose composition is **fully resolved**: no unresolved
  or adapter component anywhere in the transitive closure, no depth truncation, no `{@html}`,
  no spread attributes, and no dynamic `id` in any composed file. Real apps with a library
  component in the root layout will skip this rule on every route — that narrow applicability
  is accepted and must be stated in the rule's docs. The Phase 3 pretender-style mapping for
  node_modules components is the recorded mechanism that widens it.

## Phase 1 rules

All severities `warning` except where noted. `interactive` element set (hand-rolled constant):
`a[href]`, `button`, `input` (not `type="hidden"`), `select`, `textarea`, `summary`,
`audio[controls]`, `video[controls]`, `embed`, `iframe`, literal `tabindex` **≥ 0**
(`tabindex="-1"` is focus management, not interactivity), plus literal interactive `role`
values.

### ARIA validity — component-scoped (per file, CLI static), data from `aria-query`

| rule                          | detection                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `a11y/invalid-role`           | literal `role` token not an existing WAI-ARIA role, or an abstract role. Fallback lists (`role="switch checkbox"`) validate every token.                                                                                                                                                                                                                                                                                                                                 |
| `a11y/unknown-aria-attribute` | `aria-*` attribute not in the ARIA spec (`aria-query`'s props map).                                                                                                                                                                                                                                                                                                                                                                                                      |
| `a11y/required-aria-props`    | element with a literal `role` missing that role's required properties; a required prop is satisfied by an attribute (literal or expression) **or by host-element native semantics** via a small hand-rolled table (`aria-checked` from `input[type=checkbox/radio]`, `aria-selected` from `option`, `aria-level` from `h1`–`h6`, `aria-valuenow` from `input[type=range]`/`progress`/`meter`) — `<input type="checkbox" role="switch">` is valid without `aria-checked`. |
| `a11y/invalid-aria-value`     | literal `aria-*` value invalid for the property's declared type (true/false, token, token list, integer, …).                                                                                                                                                                                                                                                                                                                                                             |

### Cross-component structure — route-scoped (composed layout chain + page), the differentiator

Collection follows `headings.ts`'s _shape_ — a new mode-independent boundary
(`ResolvedLandmarks`-style types in core) collected by both the source provider (CLI) and the
rendered provider (vite plugin), with chain-file occurrences ordered and transitive-component
occurrences kept separate ("safe for counting, unusable for order" — same caveat as
`componentHeadings`) — but the source-mode occurrence _gathering_ is the branch-aware fold
defined above, not the existing flat walks (see _Control-flow semantics_).

| rule                      | detection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `a11y/duplicate-landmark` | composed route yields more than one `main` / `banner` / `contentinfo` landmark, branch-aware (see _Control-flow semantics_). `<main>` and explicit `role` literals count everywhere; `<header>`/`<footer>` count **only in chain files at template top level** — transitive components contribute `<main>` and explicit `role` literals only, since a component's `<header>`/`<footer>` may sit inside sectioning content in its parent and cross-file context can only create false duplicates. |
| `a11y/top-level-landmark` | `banner` / `main` / `complementary` / `contentinfo` nested inside another landmark after composition — including the chain case where a layout renders its children inside `<main>` and the page contributes another landmark. Slot nesting context per chain file is statically tracked; transitive components are counting-only, so nesting across an intermediate component is out of scope (false-negative by design).                                                                       |
| `a11y/id-duplication`     | the same literal `id` appears more than once: within one file (branch-aware), or across the composed route's resolved files. The cross-file arm is existential and open-world-sound (see above); occurrences inside `{#each}`/`{#snippet}` are excluded, and a route with a dynamic `id` skips nothing — dynamic ids simply aren't candidates.                                                                                                                                                   |
| `a11y/no-missing-id-ref`  | literal `for`, `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-activedescendant`, or same-page `href="#…"` referencing an `id` absent from the composed route. Runs only on **fully resolved** routes (see _Open world vs closed world_ — the exhaustive condition list lives there); narrow applicability is accepted and documented. A file-scoped linter cannot do this across files at all.                                                                                    |

### Standalone element rules — component-scoped (per file, CLI static)

| rule                            | detection                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a11y/interactive-nesting`      | an interactive container (`a[href]`, `button`, or literal interactive `role`) with an interactive descendant in the same file — the content-model violation subset with the worst AT/focus behavior. (Full `permitted-contents` is Phase 2; the cross-component variant — a component whose root element is interactive used inside an interactive parent — is a recorded follow-up.) |
| `a11y/accessible-name`          | `button` / `a[href]` / `input[type="image"]` with no accessible-name source: no non-whitespace text content, no `aria-label`/`aria-labelledby`/`title` (expression counts as present), no `img[alt]` descendant, and — for `input[type="image"]` — no `alt` attribute of its own. Any expression child or component child → skip (content unknowable).                                |
| `a11y/label-has-control`        | `<label>` with neither a `for` attribute nor a labelable descendant (`input`/`select`/`textarea`/`button`/`meter`/`output`/`progress`); component or expression children → skip.                                                                                                                                                                                                      |
| `a11y/use-list` (`info`)        | text node starting with a bullet character (`•`, `・`, `-`, `*`, `·`) — prompt to use a list element. Heuristic, hence `info`.                                                                                                                                                                                                                                                        |
| `a11y/placeholder-label-option` | `<select required>` without `multiple` and with `size` ≤ 1 whose first `<option>` is not a placeholder label option (empty `value`, or no `value` and empty text).                                                                                                                                                                                                                    |
| `a11y/require-datetime`         | `<time>` whose child is a pure text literal that is not a machine-readable date/time and that lacks a `datetime` attribute; expression content → skip.                                                                                                                                                                                                                                |

### Project-scoped

| rule           | detection                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a11y/doctype` | `src/app.html` does not start with `<!doctype html>` (case-insensitive, leading whitespace/comments tolerated). Same project-level shape as `seo/robots-txt`. |

## Findings: location, PASS, and suppression semantics (route-scoped rules)

These choices change persisted `findingKey`s (`id::route::location`) and committed
suppressions, so they are fixed here, not left to the implementer:

- **One PENALIZED finding per surplus representative** (`duplicate-landmark`,
  `id-duplication`): for each exclusive group (`{#if}` arms), the **representatives are the
  occurrences of the branch the max selected** (tie-break: the first such branch in document
  order) — so the count always equals the number of representatives. The max and its
  representative selection apply **per counted key** (per landmark type, per `id`); there is
  no scalar total to maximize. Two same-`id` elements
  in a single branch → two representatives → one finding; a layout `<main>` plus one `<main>`
  in each of two exclusive page branches → the layout occurrence + the first branch's
  occurrence → count 2, one surplus, one finding. Representatives are then ordered
  deterministically — chain files in chain order, by line within a file, then
  transitive-component occurrences by file path then line — and every representative after
  the first yields a finding **located at that representative's file + line**. That location may be a component file; like any
  component-located finding it becomes visible to `--diff` runs touching that file (accepted,
  same trade `seo/single-h1` documents in its location comment). `top-level-landmark` and
  `no-missing-id-ref` locate at the offending element.
- **PASS semantics**: a route where the check ran on at least one relevant occurrence and
  found nothing emits one PASS per rule, located at the first relevant occurrence's file. A
  route with **zero relevant occurrences** (no landmarks / no ids / no idrefs) emits
  **nothing** — the `seo/heading-level-skip` zero-signal precedent, and there is no
  penalizable location for a PASS to mirror (design 2026-08-08). A route the rule _skipped_
  (`no-missing-id-ref` on a not-fully-resolved route) likewise emits nothing and is excluded
  from the category average — the score-honesty precedent; an unchecked route must not report
  a false 100.
- **Inline suppressions**: `svelte-vitals-disable-next-line` is consumed by `fileRule` only;
  route-scoped rules (like `seo/single-h1` today) do not honor it in Phase 1 — the
  suppressions file (`findingKey`-based) is the escape hatch. Extending inline directives to
  route-scoped findings is a recorded follow-up, not silently half-implemented.
- **Rendered mode**: the rendered provider has no source files, so rendered-mode findings fall
  back to route-anchored locations (existing rendered-mode convention). Keys therefore differ
  between modes for the same defect — existing precedent, documented in the rule docs.

## Spec data: `aria-query`

`aria-query@^5.3.2` becomes a runtime dependency of `@svelte-vitals/core`, versioned through
the workspace catalog. Verified: zero dependencies, pure data (roles map with required props
and abstract flags, `aria-*` props map with value types), no `node:` imports, no I/O — core
purity holds. It ships CJS-only; implementation must confirm `pnpm check:publish` (attw
`--profile esm-only`) and the vite plugin's browser bundling stay green, and fall back to
vendoring the needed tables as generated TS data if either breaks.

Interactive/labelable element sets and bullet characters are small hand-rolled constants — no
dependency justified.

## Collection

- **Component facts** (`component-parse.ts` → `ComponentFacts`): new per-rule fact fields
  (element occurrences with tag, literal `role`, literal/expression `aria-*` attrs, literal
  `id`/idref attrs, nesting relationships needed by `interactive-nesting` /
  `accessible-name` / `label-has-control`, text-node heads for `use-list`, `select`/`time`
  facts). Same optional-field convention as existing facts (external constructors unaffected).
- **Route-scoped facts**: one new collector per provider (source + rendered) following
  `headings.ts` / `images.ts`. In source mode the AST does not survive parsing (`parseFile`
  returns summary lists and discards it, memoized per file), so the branch-aware fold's
  per-file inputs — occurrences with their block context — are **extracted inside `parseFile`
  and added to its per-file output**, not gathered by a second parse pass. Same files, same
  single parse, **no new file reads**: the `io-budget` counts should not rise; if
  implementation finds otherwise, the budget change needs its recorded reason per AGENTS.md,
  not a silent number edit.
- **`app.html`**: `collectProjectFacts` already reads `src/app.html` (for `htmlLang`);
  `a11y/doctype` captures the doctype from that **existing read** — zero new I/O, no io-budget
  change.

~~Component-scoped a11y rules run in CLI static mode only~~ — **corrected 2026-08-16** (`2026-08-16-a11y-rule-validity-review.md`): the Vite plugin collects the same component facts from source, so these rules run in both modes with identical results. The original text follows. (`ctx.components` is unset in rendered
mode — same as correctness/security). Route-scoped landmark/id rules run in both modes.
`a11y/doctype` is CLI-only in Phase 1.

## Registration & docs obligations (per AGENTS.md)

For each of the 15 rules: 4-place registration (`rules/index.ts` import + `allRules` +
re-export, `core/src/index.ts` re-export list — grep for a sibling id after adding), en + ja
rule docs under `rules/a11y/` (docs-links test enforces), `gen:rules-index` regeneration,
`translate:stamp` for touched en pages. Additionally, grep for **category enumerations** —
AGENTS.md's "five categories" sentence, README, and docs-site prose (en + ja) list the current
category set and all go stale with a sixth; update every occurrence. Changesets:
`@svelte-vitals/core` minor (new category + rules + `aria-query` dependency), `svelte-vitals`
minor, `@svelte-vitals/vite` minor (rendered landmark/id collection). The core changeset must
state explicitly that the combined **Health score composition changes**: a sixth category
enters the average, so existing projects' Health numbers shift on upgrade with no code change
on their side. README/guides refer to the category, never to rule counts.

## Testing

Vitest per package, fixtures under `test/fixtures/`:

- Per-rule unit tests over hand-built facts (each detection arm + the literal-only skip arm).
- Control-flow tests: `{#if}/{:else}` with a `<main>` per branch must _not_ fire
  `duplicate-landmark` — both the inline-element case and the component case
  (`{#if}<AdminShell/>{:else}<PublicShell/>{/if}`, each shell containing `<main>`); a literal
  `id` inside `{#each}` must not enter duplication counting; layout `<main>` + one `<main>`
  per exclusive page branch fires exactly **one** finding at the representative occurrence.
- Composition tests for the route-scoped rules: layout+page fixtures exercising duplicate
  `<main>` across files, id duplicated between layout and page, idref satisfied only after
  composition (must _not_ fire), a not-fully-resolved route (must emit nothing for
  `no-missing-id-ref`, not PASS).
- Finding-shape tests: surplus-occurrence ordering/location and PASS-vs-nothing semantics per
  the _Findings_ section (they define persisted suppression keys).
- e2e (`run.test.ts`-style): a fixture route producing findings under `categories.a11y` in the
  json report; existing category counts stay stable.
- `io-budget.test.ts` stays untouched — collection reuses existing reads (asserted by the test
  itself staying green).
- Rendered-mode tests: landmark/id collection from prerendered HTML, including both
  divergence directions (an `{#each}`-duplicated `id` caught in rendered mode only; a
  branch-combination duplicate caught in source mode only) — asserting each mode's documented
  behavior, not parity.

## Non-goals / recorded follow-ups

- Phase 2 (element-level HTML spec data) and Phase 3 (config-driven rules, selector-scoped
  config) as scoped above.
- Cross-component `interactive-nesting` (component root element interactive inside interactive
  parent).
- A pretender-style mapping for **node_modules components** (unresolvable by source analysis —
  e.g. a library `<Link>` rendering `<a>`); the component-to-element mapping file-scoped linters use is prior art.
- ~~Rendered-mode execution of the component-scoped a11y rules.~~ **Superseded 2026-08-16** — see the correction above and `2026-08-16-a11y-rule-validity-review.md`: the plugin collects the same component facts from source, so these rules do run in rendered mode.
- Inline suppression directives for route-scoped findings (suppressions file covers them).
- Svelte compiler warning aggregation; a third-party lint engine as a dependency.
- WCAG checks needing runtime computation (contrast, focus order).
