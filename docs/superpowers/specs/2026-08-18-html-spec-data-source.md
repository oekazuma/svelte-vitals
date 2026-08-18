# Element-level HTML spec data — the source, and how it is consumed

Phase C-9 of `2026-08-16-v1-roadmap.md`. The a11y category design deferred every rule that needs
per-element HTML data (content models, attribute tables, deprecation, per-element ARIA) to a design
whose "central question" is the data source, because 1.0 must not ship a dependency it would later
swap. This is that decision. The rules themselves follow as ordinary increments; two land with the
pipeline so it does not ship without a consumer.

## What the rules need

| rule                                  | data                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `deprecated-element`                  | per-element obsolete flag                                                                 |
| `deprecated-attr`                     | per-attribute deprecated/obsolete flag, per element                                       |
| `required-attr` (generic)             | per-attribute `required` / `requiredEither`, per element — mostly selectors, not booleans |
| `ineffective-attr`                    | per-attribute `ineffective` / `condition`, per element — selectors                        |
| `invalid-attr`                        | per-attribute value type, per element and global                                          |
| `permitted-contents` (full)           | per-element content model, plus the content categories                                    |
| `implicit-role`, `disallowed-props`   | per-element implicit role and permitted roles; per-role property tables                   |
| `deprecated-props`, `deprecated-role` | per-role and per-property deprecation                                                     |

## The source: `@markuplint/html-spec`

Surveyed, and the reason each alternative is not it — because a survey that dismisses on the wrong
axis is worth nothing once the consumption model changes:

- **`@markuplint/html-spec`** (MIT, 4.18.0, five releases in the past twelve months) — one JSON file
  (`index.js` is `module.exports = require('./index.json')`): 206 elements (142 HTML, 64 `svg:*`),
  each with `contentModel`, typed `attributes` carrying `required`/`requiredEither`/`deprecated`/
  `obsolete`/`ineffective`/`condition`, `aria.implicitRole`/`permittedRoles` per ARIA version, and
  `categories`; plus `#contentModels`, `#globalAttrs`, and an `#aria` table with per-role property
  rows including deprecation. Every column above is present.
- **`html-validate/elements/html5`** — importable as a subpath, MIT, and its metadata is genuinely
  comparable on content models and deprecation. It lacks per-element `permittedRoles`, carries no
  SVG, and types attributes only as enum/boolean. Two columns short.
- **`@mdn/browser-compat-data`** (CC0, data-only) — has `status.deprecated` per element and per
  attribute, i.e. exactly what the two rules shipping here read, but no content models, no attribute
  types, no ARIA. Adopting it for one column and markuplint for the rest would be two sources for
  overlapping facts, which is the disagreement class this project keeps removing.
- **`aria-query`'s `elementRoles`** — element → implicit role, HTML-AAM. A candidate for
  `implicit-role` alone; markuplint's per-element `aria` carries the same fact next to
  `permittedRoles` and per-version variants, so per-element ARIA comes from markuplint and
  `elementRoles` is not consulted. Vocabulary (what roles and properties exist) stays on
  `aria-query` — see below.
- **`html-element-attributes`**, **`html-tag-names`** — names only. **`axe-core`** — an engine,
  MPL-2.0.

## How it is consumed: catalog devDependency, generator, offline drift test

The repo already has the right shape for this and it is not `gen-action-pin`: it is
`packages/core/scripts/gen-schema-vocab.js` + `test/schema-vocabulary.test.ts`. `schema-dts` is a
**catalog devDependency**; the generator reads it out of `node_modules` via `require.resolve`; the
test re-extracts from the same installed package and compares with the committed module — no network,
so it runs in the `test` job; a Renovate bump changes the installed data, the test fails, and the
regeneration PR shows the data diff. `floor-smoke` never runs vitest; its contribution is importing
the generated module under bare Node 24.16.0. "Pinned" means an **exact** catalog entry
(`aria-query: 5.3.2` style, not `^`), so the version in the notice and the version installed cannot
drift apart.

So: `@markuplint/html-spec` joins `pnpm-workspace.yaml`'s catalog as a devDependency of
`@svelte-vitals/core`. `packages/core/scripts/gen-html-spec.js` resolves the package through its
`./json` export (its `exports` map has no `./package.json`, so `require.resolve('@markuplint/html-spec/json')`
then `../package.json` for the version), projects `index.json` down to the columns in the table, and
writes `packages/core/src/html-spec/generated.ts` as one `JSON.parse(<string>)` call — a 190 KB
object literal is something oxfmt would reflow, and the string is emitted as
`JSON.stringify(JSON.stringify(data))` because the projection contains ~550 `'` characters and
`renderSchemaVocabModule` throws on those. The module's type is hand-written: importing `MLMLSpec`
from `@markuplint/ml-spec` would leak a devDependency into `dist/*.d.ts` and fail `check:publish`.
`test/html-spec.test.ts` re-projects and compares.

Three measured reasons this beats a runtime dependency:

- **The package's declared dependency is types-only at runtime but installs anyway.** It depends on
  `@markuplint/ml-spec` for its `.d.ts`; that pulls `@markuplint/ml-ast`, `@markuplint/types`,
  `dom-accessibility-api`, `is-plain-object` and `type-fest` into every user's install for a file that
  only ever loads JSON. As a devDependency it is installed here and nowhere else.
- **84% of the JSON is not what the rules read** — 1.18 MB minified down to 0.19 MB projected. Half of
  that is prose (`description`, `cite`, `defaultValue`, `animatable`), the other half is the `#aria`
  table, of which only the deprecation rows are kept (below). Core purity is trivial: the data is a TS
  module.
- **The dataset 1.0 ships is the one 1.0 was tested against.** A semver range on a runtime data
  package lets a user's `pnpm update` change what a rule reports; a committed projection cannot.

**The MIT notice must reach `dist`.** esbuild strips `/** */` comments — `aria-data.ts`'s doc
comments are absent from the built chunk — so a notice in an ordinary comment vanishes from the
published copy, which is the copy the "all copies or substantial portions" clause is about. The
generated module opens with a `/*! … */` legal comment carrying the upstream copyright line and the
full permission text, and a test asserts the copyright line is present **in `dist`**, not in source.
That test lives in `packages/cli/test`, which already imports core from its built `dist` — core's own
vitest stays build-independent. Projection does not lift the obligation.

## ARIA: vocabulary stays on `aria-query`; deprecation comes from markuplint

`aria-query` remains the answer to "does this role / property exist" and "what values may it take".
markuplint's `#aria` omits DPUB-ARIA — 41 `doc-*` roles `aria-query` carries and it does not — so
swapping the vocabulary would make `invalid-role` flag valid publishing markup. (Its three
`graphics-*` roles sit in a separate `graphicsRoles` array and are present.)

But two roadmap rules need what `aria-query` does not have. `deprecated-props`/`deprecated-role`
need deprecation, and `aria-query@5.3.2` carries **none** — no field on any role or property.
`disallowed-props` needs a per-role property table, and `aria-query`'s `roles.get(r).props` is stale
where it matters: it lacks the three ARIA 1.3 globals (`aria-description`, `aria-braillelabel`,
`aria-brailleroledescription`) on every role, so a rule built on it flags `aria-description`
everywhere, and even after setting those aside it differs from markuplint's 1.3 `ownedProperties` on
87 of 100 roles.

So the **per-role property tables come from markuplint**: `#aria.1.3` `roles[].ownedProperties`
(with each row's `deprecated` flag) and `prohibitedProperties`, plus the deprecated roles
(`directory`) and deprecated properties (`aria-dropeffect`, `aria-grabbed`) — roughly 50–80 KB
depending on whether rows are kept as objects or flattened to name lists. That is what
`disallowed-props`, `deprecated-props` and `deprecated-role` read. It is also why the two sources
cannot answer the same question differently, and the projection is what enforces it:

- `ownedProperties`/`prohibitedProperties` rows keep **name and `deprecated` only** — `required` is
  dropped, so the vendored data cannot say what a role requires; `required-aria-props` keeps
  `aria-query` plus `NO_REQUIRED_PROPS`, for the reason below.
- `#aria.1.3.props` is projected to **its deprecated names only** — `type`, `value`, `enum`,
  `isGlobal`, `conditionalValue` are dropped, so value typing has one source, `aria-query`.
- `graphicsRoles` is projected the same way as `roles`. Nothing else from `#aria` — not
  `requiredOwnedElements`, `requiredContextRole`, `generalization`, or the abstract flag.
- `aria-query` is never asked which properties a role owns.

Each fact has exactly one place to come from, enforced by what the generator writes rather than by
discipline. **A role with no row** — the 41 DPUB-ARIA roles `aria-query` knows and this table does not
— gets no judgment from `disallowed-props`, `deprecated-props` or `deprecated-role`; that is a known
limitation those three rules' docs state, and it is why a naive `table[role] ?? []` is wrong: it would
flag every `aria-*` on valid publishing markup.

Because both sources now feed the same rules, a test asserts that every role in markuplint's 1.3
`roles` ∪ `graphicsRoles`, every property in its `props` and in every role's `ownedProperties`/
`prohibitedProperties`, and every role name in the retained `specs[].aria.implicitRole`/
`permittedRoles` is one `aria-data.ts` recognizes — read from the installed package. Of `specs[].aria`'s keys —
`implicitRole`, `permittedRoles`, `conditions`, `properties`, `implicitProperties`,
`namingProhibited`, `1.1` — only **`implicitRole` and `permittedRoles`** are retained. `conditions`,
`properties` and the `1.1` variant are dropped wholesale: `1.1` because the role table is pinned to
1.3 and it is the only per-version key that exists at element level, the other two because no listed
rule reads them and the data carries at least one typo there (`aria-hecked`, under
`input.aria["1.1"].conditions[…].properties`) that a name guard would otherwise have to know about.
`permittedRoles` has four shapes — an array of names, an array mixing names and `{name, deprecated}`
objects, a boolean, and `{"core-aam": true, "graphics-aam": true}` on the `svg:*` entries — and the
generator normalizes all four to a name list (the AAM-object form to "any", which never reaches a
rule while `svg:*` is out of scope). Today it holds, and holds because of exactly the patches
`aria-data.ts` already carries: markuplint's 1.3 table lists the five roles (`comment`, `image`,
`sectionheader`, `sectionfooter`, `suggestion`) and two attributes (`aria-colindextext`,
`aria-rowindextext`) that `ARIA_1_3_ROLES`/`ARIA_1_3_ATTRIBUTES` add on top of `aria-query`, and its
required-property rows agree with `NO_REQUIRED_PROPS` on `option` and `treeitem`. An independent
dataset arriving at the same five-plus-two is corroboration worth recording; the guard is so the next
divergence is loud.

Where the tables differ on required properties — `combobox` and `scrollbar` no longer require
`aria-controls` in markuplint's 1.3 row; `separator` requires `aria-valuenow` there and not in
`aria-query` — the rule keeps its current source. `separator` is the instructive one: the spec
requires it only for a focusable separator, and markuplint's table flattens the condition, so
adopting it would flag every `<div role="separator">`. Neither table is spec-exact; that judgment
stays in `aria-data.ts` where it is.

## The compiler already covers part of this, and the compiler wins

The earlier draft of this document said the Svelte compiler validates none of it. That was false:

- `node_invalid_placement` (a compile **error**) and `node_invalid_placement_ssr` (a warning) enforce
  the browser-repair subset of content models — `<p>` containing flow blocks, `<a>` in `<a>`,
  `<button>` in `<button>`, `<form>` in `<form>`, heading nesting, and the `only:` lists for
  `table`/`tr`/`tbody`/`thead`/`tfoot`/`colgroup`/`head`/`html`.
- `a11y_distracting_elements` warns on `<marquee>` and `<blink>`, both `obsolete` in the data.

So `permitted-contents`' design starts from `svelte/src/html-tree-validation.js` and covers only what
the compiler does not; and `deprecated-element` excludes `marquee` and `blink`, which the compiler
already reports. Reporting either twice under two ids is the contradiction class the a11y review
settled ("follow the compiler").

## The two rules that ship with the pipeline

`a11y/deprecated-element` and `a11y/deprecated-attr` are pure lookups. Their scope, stated because
the flags in the data are not one thing:

- Elements: no element carries `deprecated`; 29 carry `obsolete` (WHATWG §16.2 exactly). The rule
  fires on **`obsolete`**, minus `marquee`/`blink` (compiler), and **only for the HTML namespace** —
  the 64 `svg:*` elements are out of scope for both rules in this increment. That scope is not free:
  `component-parse.ts` records `tag: node.name` with no ancestor namespace, and the names that
  collide — `a`, `script`, `style`, `title` — are exactly where a name-only lookup goes wrong.
  `<svg><style type="text/css">` is the Illustrator-export idiom pasted into components, and HTML
  `style[type]` is `deprecated` while `svg:style` has no such row. No element-occurrence fact exists
  today, so this introduces one: a new `ComponentFacts` entry (`elements?: {tag, line, attrs, inSvg?}[]`,
  every element, lowercased tag and attribute names as `elementAttrs` already does) with `inSvg`
  set under an `<svg>` ancestor, reset by `<foreignObject>`, and **seeded from
  `<svelte:options namespace="svg" />`** — an SVG-partial component with a `<g>` root has no `<svg>`
  ancestor of its own and is exactly the case the flag exists for. Both rules skip flagged
  occurrences. Test 5 carries the `<svg><style type="text/css">` snippet, because "an `svg:*` element
  does not fire" tests nothing — none of the 29 obsolete names is an SVG name — and its control is a
  `<style type="text/css">` **inside `<svelte:head>`**: a top-level `<style>` in a component is the
  component's stylesheet, parsed into `ast.css` and never an element, so it is out of reach by
  construction. Other collectors (`accessible-name`, `interactive-nesting` on `<svg><a>`) may adopt
  the flag later; that is not this change.
- Attributes: 169 `deprecated`, 2 `obsolete`, and separately 23 `nonStandard` and 16 `experimental`.
  The rule fires on **`deprecated ∪ obsolete`** from the element's own `attributes` table only —
  not on `nonStandard`/`experimental`, and not on the `#globalAttrs` groups. The global groups are
  where the false-positive traps live: `#XLinkAttrs` marks `xlink:href` deprecated, and every SVG
  icon sprite is `<use xlink:href="#…">`; consulting them would fire on the most common SVG idiom in
  the corpus.
- The `deprecated` flag follows the dataset's own status, which tracks MDN rather than WHATWG's
  obsolete-features list — and that cuts both ways. Over: `a[attributionsrc]` is `deprecated: true`.
  Under: WHATWG-obsolete attributes MDN never documented are absent, so the rule is silent on
  `p[align]`, `td[nowrap]`, `html[manifest]`, `input[align]`, `body[marginheight]` and the rest of
  that list — and `<p align="center">` is the most common legacy attribute in the wild. The finding
  says "deprecated", and the rule doc says coverage is "attributes the dataset marks deprecated",
  not "obsolete attributes". An attribute flagged both `deprecated` and `nonStandard`
  (`hr[size]`, `canvas[moz-opaque]`) fires — it is in the union.
- One finding per element: `deprecated-attr` skips every attribute on an element whose tag is in the
  obsolete set (`marquee`/`blink` included, so the compiler's two fall out of the same check), so
  `<font color>` and `<marquee behavior>` each surface once. This is a data-level skip, not a view of
  the other rule's result — separate `componentRule` specs have none — so turning
  `a11y/deprecated-element` off, or suppressing it inline, does not resurface the attribute finding.
  Stated in both rule docs.

Measured on five real apps: `<strike>` ×2 and `iframe[frameborder]` ×11 across two of them. Both
rules fire on real code without being noisy. Each gets docs (en/ja), a kitchen-sink sample, and the
meta-test coverage every rule has; the remaining rules follow one at a time under the same bar.

## What this decision does not settle

- **The content-model evaluator.** Content models are a small selector DSL — three pseudo-classes
  (`:model`, `:not`, `:has`) and the quantifiers `oneOrMore`, `zeroOrMore`, `choice`, `require`,
  `optional`, `transparent`, plus `descendantOf` and `conditional` — evaluated against a template
  that is not a DOM: components, slots and blocks punch holes in it. Which holes make a parent
  unjudgeable is `permitted-contents`' own design; the open-world reasoning `no-missing-id-ref` had to
  face (#533) applies to it. Element `aria.conditions` use a different selector surface again
  (`:aria(has no name)`, `[alt=""]`).
- **The attribute-condition selectors.** `required`, `ineffective` and `condition` are not
  booleans on most rows: 7 of the 11 `required` rows are selectors (`":is(video, audio) > source"`,
  `"[itemprop]"`), `ineffective` rows like `script[defer]` are lists (`["[type='module' i]",
":not([src])", "[async]"]`), and `condition` (51 rows) uses ancestor combinators (`a[href] img`).
  `required-attr` and `ineffective-attr` therefore need a third selector surface, distinct from both
  the content-model DSL and the ARIA conditions, and their designs decide how much of it to evaluate
  against a template with holes in it.
- **The attribute type interpreter.** 228 distinct type expressions; `Boolean`, `URL`, `<number>`,
  `Enum`, `DOMID` cover the common ones, `FunctionBody` (event handlers, 112) is the largest single
  bucket. `invalid-attr`'s design decides the subset it validates and states what it leaves.

## Testing

1. Drift: `test/html-spec.test.ts` re-projects `index.json` from the installed package and equals the
   committed generated module — offline, exact catalog version is the pin.
2. ARIA guard: markuplint 1.3 `roles` ∪ `graphicsRoles`, `props`, every `ownedProperties`/
   `prohibitedProperties` name, and the retained `specs[].aria` role names ⊆ what `aria-data.ts`
   recognizes, read from the installed package. The generated module contains no `required` field.
3. Notice: the built core `dist` contains the upstream copyright line (asserted from
   `packages/cli/test`).
4. Core purity: `packages/core/src` still has no `node:` import; the generator lives under `scripts/`.
5. `deprecated-element` / `deprecated-attr`: kitchen-sink samples with expected counts; `<s>` (the
   conforming replacement for `<strike>`) does not fire; `td[width]` fires while `img[width]` does not
   (deprecated on one element, current on the other); `<marquee>` does not fire;
   `<svg><style type="text/css">` and a `<g>`-root component with `<svelte:options namespace="svg" />`
   do not fire while `<svelte:head><style type="text/css">` does;
   `<font color>` yields one finding, not two. The ja rule doc notes that `<rb>`/`<rtc>` are obsolete
   in WHATWG but were kept by W3C HTML 5.x and appear in Japanese ruby markup.
