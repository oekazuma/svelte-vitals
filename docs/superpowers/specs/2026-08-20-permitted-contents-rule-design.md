# `a11y/permitted-contents` — design

Implements the "build" decision of `2026-08-20-permitted-contents-measured.md`. The measurement's
semantics are normative: this design maps them onto the codebase and settles the two things the
measurement deferred — the severity split and the fact shape.

## The rule

For each literal parent element in component source, each literal child element must be a member
of the parent's permitted-content set, per the vendored `contentModel` data (already projected —
`HtmlElementSpec.contentModel`, `HtmlSpecData.contentModels`). Membership only, never sequence or
cardinality; child attribution looks through `{#if}`/`{#each}`/`{#await}`/`{#key}`. One finding
per violating child, anchored at the child's start tag (directive-reachable), message naming both
tags and what the parent admits: `` `<div>` is not permitted content of `<ul>` — it admits only
`<li>` and script-supporting elements ``.

Category: a11y (with the other element rules). Id: `a11y/permitted-contents`.

## Severity: the measured AT classes are `warning`, the spec-only class is `info`

The split reproduces the measurement's adjudication almost exactly — 98 of the measured 101
AT-consequence findings grade `warning`; the three residue rows are recorded below — and is
**total** over every judgment path:

- **`warning`** when the **effective** entry set that rejected the child contains no category
  reference other than script-supporting (`:model(script-supporting)` / `#script-supporting`) —
  the closed containers: `ul`, `ol`, `dl`, `table`, `tr`, `select`, `hgroup`, `picture`,
  `audio`/`video`'s own entries, `contents: false` models. "Effective" means the set actually
  used: the conditional-replaced model when one applied (`dl > div`), and the opaque ancestor's
  model for a transparent parent — `ul > a > strong` is judged and graded by `ul`'s model, so the
  measured class-1 transparent findings stay `warning`.
- **`warning`** also when a heading crosses the boundary in either direction — the child or the
  parent is `h1`–`h6` (the measured class 2: a heading inside a button/label loses or pollutes
  its outline role for AT) — or when the child is a **structure-bound tag**, one that only means
  anything inside its specific container (`li`, `dt`, `dd`, `tr`, `td`, `th`, `thead`, `tbody`,
  `tfoot`, `caption`, `col`, `colgroup`, `optgroup`, `figcaption`, `legend`, `summary`,
  `source`, `track`): `div > li` and `form > li` are list items outside any list (measured
  class 1) even though `div`/`form` carry category models.
- **`info`** otherwise: a category-based model rejected the child (`button > div`,
  `label > div`, …), including `:not`-arm rejections on category models (`form > form`,
  `dfn > dfn` — category model, no heading). Spec-true, so not deleted; mostly harmless in
  practice, so not `warning` (the measurement's own constraint: 根拠のないものは info).
  Accepted divergence from the measured class 1: `code > ul`, `code > p`, and `span > pre`
  (3 findings) grade `info` here — category-model rejections with no structural child; no
  mechanical rule reproduces the by-consequence grouping for them without special-casing.

Note the naive "tag selectors only" reading is wrong for every closed container — `ul`'s own
model is `li` **plus** `:model(script-supporting)` — hence the script-supporting exemption above.

Mechanically this is per-**result** severity. `Result` carries it and every consumer honours it
(`classify`/`effectiveSeverity`, the reporters, the dashboard's per-result validation), but the
authoring helpers do not: `fileRule` stamps `spec.severity` on every result, so `ComponentIssue`
gains an optional `severity` that overrides the stamp when present — the smallest change, and
other rules are unaffected. A config severity override
(`rules: { 'a11y/permitted-contents': 'error' }`) applies to all of the rule's results uniformly,
as everywhere — the split is the default, not a second lever. `Rule.severity` (the default shown
by `explain`, and the rule's single slot in the scoring inventory denominator) is `warning`; the
score itself uses per-result `effectiveSeverity`, so the mix is scored as emitted. The page
documents the split.

## Fact: parent links on `ElementFact`

`collectElements` already walks every element with `inSvg` tracking. Additive changes, existing
consumers untouched:

- `parent?: number` — index of the nearest literal ancestor element **in the same array**
  (push-before-children DFS makes the index sound), looking through control-flow blocks
  (`{#if}`/`{#each}`/`{#await}`/`{#key}`). The chain **breaks** — the field is absent, the chain
  restarts — at every construct whose rendering position is not lexical: a component
  (`<Component>`, `<svelte:component>`, `<svelte:self>`), `<svelte:element>`, `<slot>`,
  `{@render}`, `{@html}`, a `{#snippet}` body root, and `<svelte:head>` children (head-as-parent
  is not shipped — zero corpus findings; recorded divergence from the probe). Elements _inside_
  a snippet body still parent each other — the probe judged within-snippet nesting and those
  findings are inside the measured 351. The same breaks bound `:has` subtree reconstruction: an
  element across a break is not a subtree member. A break that can render content in place
  (component, `<svelte:element>`, `<slot>`, `{@render}`, `{@html}`) also sets `unknownContent`
  on the enclosing element; a `{#snippet}` declaration and `<svelte:head>` render nothing
  lexically and set nothing — matching the probe. (`<title>` inside `svelte:head` is a
  `TitleElement` node and is not collected — harmless with head-as-parent dropped.)
- `attrs[*].value?: string` — the literal value, when it is one (`value === true` → `''`);
  absent for a dynamic value. Selector evaluation needs `[rel=stylesheet]`,
  `[type='hidden' i]`-style tests; presence tests already work off the name.
- `hasSpread?: true` — a spread makes every attribute test unknowable.
- `unknownContent?: true` — the element has a direct child the evaluator cannot see through: a
  component, `{@html}`, `{@render}`, `<slot />`, or `<svelte:element>`. Subtree unknowability
  (for `:has`) is derived by walking `parent` links.

## Evaluator: `packages/core/src/html-spec/content-model.ts`

A pure module porting the probe (`pc-probe.final.mjs`) with its reviewed semantics, all of which
are recorded in the measurement doc:

- selector evaluation over a literal element: tag, `[attr]`, `[attr=v]` (case-insensitive `i`
  form), `:model(x)` / bare `#x`, `:not(...)`, `:has(...)` over the completed subtree, `*`;
  three-valued (`true | false | unknown`), unknown always toward silence;
- `#custom` never matches a judged child; `svg|svg` is the HTML `<svg>` root, other `svg|*`
  entries never match;
- flatten `require`/`optional`/`oneOrMore`/`zeroOrMore`/`choice` into the per-parent union
  (obligations dropped, membership kept);
- `conditional`: decidable → replaces the base model (first match wins); undecidable → union of
  every branch (laxest);
- `transparent`: membership walks up to the nearest opaque literal ancestor; no literal ancestor
  → skip. **The `a` element's transparent filter and the `button`/`a` interactive `:not` arms
  are not evaluated** — those verdicts are `a11y/interactive-nesting`'s (measured: 16 findings
  stay single-reported). Every other `:not` arm (e.g. `form`'s `:not(form, :has(form))`,
  `dfn`'s, `label`'s, `audio`/`video`'s media exclusion) is evaluated: implemented as "skip the
  `:not`/`:has` argument parts that are **token-exactly** `:model(interactive)`, `a`, or
  `[tabindex]`" — token-exact so `audio` and `label` are not mistaken for `a` — leaving
  `form > form` reported while `a > button` is not. Accepted double-miss: `a > a` / `a > button`
  under an `<a>` with no `href` is reported by neither rule (interactive-nesting requires `href`
  on the container); the corpus count for that shape is zero.

Rule-side skips (each measured): `option`/`optgroup` parents (compiler-wins carve-out), custom
elements and unknown tags as child or parent, `<slot />` and `<svelte:element>` children,
`inSvg`, text children (not shipped — 1 trivial occurrence in 3,671 files).

## Compiler relationship

The parse-rejected autoclose subset never reaches the AST; everything this rule reports compiles
(at most the `node_invalid_placement_ssr` warning applies, through blocks). Same verdict where
both speak, per the compiler-wins precedent; `<option>` rich content is the one place the
compiler deliberately disagrees with the dataset, and the rule sides with the compiler.

## Guards and increment checklist

- Unit tests for the evaluator (the probe's self-test cases become fixtures: `ul > div`, blocks,
  `dl > div > dt` valid, `video[src] > source` conditional, transparent chain `ul > a > strong`,
  positive `:has` (`summary > hgroup > h2`), `option` carve-out, snippet boundary, custom
  element, `p > div` through `{#if}`).
- Kitchen-sink: planted `ul > div` (warning class) and `button > div` (info class) samples +
  clean counterparts; e2e expected-findings; the meta-test enforces presence. The e2e also
  asserts, from the JSON report's `issues[].severity`, that the two samples' severities differ —
  the severity split is this design's central deliverable and has no other guard.
- Docs en/ja (+ mode-differences section, component-family boilerplate), stamps,
  `gen:rules-index`, `gen:skills`, changeset (minor: new rule).
- Registration in `packages/core/src/rules/index.ts` (import + `allRules` + re-export).
- No new I/O: the fact rides the existing component parse pass (io-budget unaffected).

## Not in this increment

- Sequence/cardinality checking, `require` obligations ("must contain") — unjudgeable statically
  (measured methodology).
- Head-model judging for `<svelte:head>` children (zero corpus findings).
- The text column (measured: not shipped).
- SVG content models (`inSvg` skip, namespace-blind precedent).
