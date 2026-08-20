# `permitted-contents` measured (roadmap C-9 remainder) — methodology first

Status: methodology draft; numbers follow the probe run.

The last Phase C question: does a full content-model rule (markuplint's `permitted-contents`)
earn a place, given that the Svelte compiler already rejects the browser-repair subset? Per the
repo's measurement discipline, the probe is the literal check the rule would ship, run against
the ecosystem corpus, and the deliverable is a decision either way.

## What the rule would check

For each **literal parent element** in component source, each **literal child element** must be a
member of the parent's permitted-content set, per `@markuplint/html-spec`'s `contentModel` data
(the same vendored data source as the shipped element rules).

**Child attribution looks through control-flow blocks.** A literal element inside `{#if}` /
`{#each}` / `{#await}` / `{#key}` under a literal parent is that parent's child for membership
purposes — a branch that renders still has to be permitted. This is the same walk the compiler
does; what differs is that the compiler downgrades block-separated pairs from the
`node_invalid_placement` error to the `node_invalid_placement_ssr` **warning**, which fails no
build — so that class is exactly where a static rule adds signal as a second reporter of the
compiler's own verdict (allowed by the compiler-wins precedent; a different verdict is not).

**Membership, not sequence.** The data is a sequence grammar (`require`/`oneOrMore`/`choice`/…),
but a Svelte template can interleave components and render-time constructs anywhere in a child
list, so an order/cardinality check would be wrong on real templates by construction. The check
that survives is per-child membership: flatten the grammar into the per-parent union of tags and
categories it permits anywhere — including the contents of `require`/`optional` entries, whose
**obligation** (not their membership) is what gets dropped, so `hgroup`'s `h1`–`h6` and
`figure`'s `figcaption` stay permitted. The union is per-parent and non-transitive, strictly
laxer than the grammar: flattening can only miss violations, never invent one. A literal `<div>`
inside `<ul>` is a violation no matter what a neighbouring `<Component />` renders, so one
unknowable sibling does not silence the judgment on the others.

**`conditional` models are evaluated when decidable.** Six elements carry a `conditional` arm;
the one that bites is `div` (`dl > div` permits `dt`/`dd`, which are **not** flow content — the
flattened base model alone would flag the standard `<dl><div><dt>` styling wrapper). An
ancestor condition is decided from the parent's own literal parent; an attribute condition
(`option[label][value]`) from the parent's literal attributes; undecidable (parent at template
root, dynamic attributes) → the union of every branch (base ∪ all conditional contents) is used —
the laxest reading, which grants `div` its `dt`/`dd` and keeps the restrictive conditionals
(`option[label][value]` → empty, `colgroup[span]` → empty) from denying anything unproven.

**Category entries are selectors, not tag names.** `#flow` contains `link[itemprop]`,
`link[rel=stylesheet]`…; `#interactive` contains `a[href]`, `input:not([type='hidden' i])`.
Child attributes are literal in the cases the probe judges, so these are evaluated (a dynamic
attribute the selector needs → unknowable → permitted). Both spellings of a category reference
(`:model(script-supporting)` and bare `#script-supporting`, which `select` uses) are handled.

**Text children are a separate measured column.** The dataset models text (`#text` in
`#flow`/`#phrasing`; `option` is text-only) and the compiler repairs only its `only`-list subset
(table/tr/tbody/head — not `ul`/`ol`/`dl`, where text is invalid but unrepaired). Whitespace-only
text is exempt; `{expression}` text is unknowable and skipped. Reported separately so the
element-membership decision is not colored by a text policy the rule could ship without.

**`option`/`optgroup` children are a compiler-wins carve-out.** The dataset models `option` as
text-only, but the compiler deliberately removed that restriction ("newer browsers support rich
HTML content inside option elements" — `html-tree-validation.js`). Flagging `<option><b>` would
be the opposite verdict, which the precedent forbids; the shipped rule would need the same
exemption, playing the role `meta[property]` played in the attribute decision. Counted in its
own column, excluded from the violation totals.

## What the probe skips (and counts as skipped)

- **Snippet bodies** — `{#snippet}` renders at its `{@render}` sites, not lexically; the
  compiler stops placement validation at the same boundary.
- **`<svelte:element this={…}>`** — unknown tag, as parent and as child.
- **Custom elements** (tag with a dash) as child or parent — the category lists cannot contain
  them; the compiler returns null for them too.
- **`<slot />` children** — a real element in the dataset but compiled away by Svelte; the
  `<ul><slot /></ul>` wrapper idiom must not be flagged.
- **Unknown non-dash tags** (MathML, misspellings — the dataset is HTML+SVG only) — own bucket,
  no content-model verdict.
- **`transparent` models** (`a`, `ins`, `del`, `map`, `object`, …) with no literal element
  ancestor in the same template — the effective model is the unknown parent's.
- **`:has(...)` exclusions** when the child's subtree contains a component, `{@html}`,
  `{@render}`, or `<slot />` — the violation cannot be proven.
- **`inSvg` parents** — matches the shipped namespace-blind precedent; the SVG category models
  are not implemented.
- **Any content string the evaluator does not understand** — the parent goes into an explicit
  `unevaluated` bucket, reported per construct. Honest gaps over silent mis-evaluation.
- `:model(X)` categories are resolved from the dataset's own `def['#contentModels']` lists,
  never hand-written. `<svelte:head>` children are judged against `head`'s model.

## Compiler subtraction is a classifier, not a filter

Every finding is tagged with whether `svelte@5.56.9`'s `html-tree-validation.js`
(`is_tag_valid_with_parent` / `is_tag_valid_with_ancestor`) also rejects the pair. The tag
answers "would this Svelte reject it", not "did their Svelte" — the corpus is never compiled by
the probe, files nobody imports never meet a compiler, and block-separated pairs compile with a
warning, not an error. So a non-zero compiler-agreeing count is expected, and it is the
second-reporter pool, not noise; the _error_-class subset among statically-nested pairs should
be near 0 for apps that build on Svelte 5.

## Overlap accounting

The interactive-content exclusions (`a`, `button`: `:not(:model(interactive), :has(...))`)
duplicate `a11y/interactive-nesting`, which already ships. Findings in that class are counted in
a separate column — the build decision turns on **new** signal, not total signal.

## Metrics

Per app: occurrences, distinct files, apps affected, **and the per-parent→child violation-class
breakdown** — both precedent decisions turned on "is this one idiom or many defects", which
totals cannot answer. Every violation class is adjudicated by inspection (true defect / FP /
intentional), as the attribute measurement did with its `og:` hits. Skipped buckets
(snippet-boundary, transparent-at-root, `:has` with unknowns, unevaluated constructs) are
reported so the denominator is visible.

## Data-quality note

The dataset's `address` exclusion list spells `foooter` (`:model(flow):not(address, …, header,
foooter, …)`), so `<footer>` inside `<address>` would never be flagged by data-driven
evaluation. Verified present in the vendored 4.18.0 data; recorded because 1.0 must not inherit
a data source we'd swap — an upstream fix is a normal pinned-catalog bump with the drift test.

## Corpus

The ecosystem clones (kener, svelte-commerce, CMSaasStarter, networking-toolbox, joy,
AdventureLog, VERT, animotion, cobalt, shadcn, sveltedev) — real apps only decide.
`examples/kitchen-sink` runs as a probe-correctness check (its planted defects must be found)
and stays out of the decision totals. The probe is a standalone script over the raw dataset and
the Svelte parser; the `generated.ts` projection is not extended unless the decision is "build".

## Results

3,671 `.svelte` files parsed across the 11 apps (31 parse errors, skipped). Skipped buckets:
snippet bodies 834, inSvg 582, unevaluated (a needed selector was undecidable — dynamic
attributes under `a[href]`-style entries, `:has` over unknowable subtrees) 232,
transparent-at-root 93, `<slot />` children 50, unknown tags 16, `svelte:element` 11, custom
elements 5. Kitchen-sink correctness run: 2 findings, both planted samples — the
interactive-nesting gallery's `<a><button>` (overlap-tagged) and the legacy gallery's
`<p><strike>` — and nothing spurious.

**351 element findings, 154 distinct files, all 11 apps.** Compiler-agreeing: **0**. Two probe
bugs found by review and fixed before these numbers: `#custom` (autonomous custom elements) in
the flow/phrasing lists made those categories undecidable, hiding every flow-in-phrasing
violation; and the `svg|svg` category entry was read as "never matches", flagging every HTML
`<svg>` child (169 false findings in the first run, all removed by the fix).

By consequence class:

| class                                                                                                                                                                                                                                                                     | count | adjudication                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **List/table structure broken** — `ul > div/button/p/form/a/b/ul` (44), `div > li` (11), `form > li`, `code > ul/p`, `span > pre`, and `a > strong` through the transparent `a`, judged against the enclosing `ul`'s li-only model (same root defect as the `ul > a` row) |    60 | true — AT announces a list whose items aren't list items, or list items outside any list; daisyUI `dropdown-content menu` `<ul>` used as a generic popup container is the repeated idiom (AdventureLog), plus `<ul>{#each}<a>` in svelte.dev's site-kit and `{:else}<p>` inside `<ul>` (joy) |
| **Headings crossed with phrasing/flow** — a heading inside phrasing content (`button > h5/h4/h2` 23, `label > h3` 7, `span > h2` 2) or flow inside a heading (`h1/h2/h3 > div` 9)                                                                                         |    41 | true — a heading inside a button/label loses or pollutes its outline role for AT; networking-toolbox's card buttons (`<button><h5>…<p>`) are the repeated idiom                                                                                                                              |
| **Flow in phrasing container** — `button > div` (167), `button > p` (31), `label > div` (30), `span > div`, `button > figure`, `span > strike` (obsolete, category-less), …                                                                                               |   234 | true per spec, benign in practice — browsers render it, no repair, minimal AT impact; the styling idiom (`<button><div class="flex">`) is ubiquitous (6+ apps; networking-toolbox alone has 87 `button > div`)                                                                               |
| **Interactive overlap** — `a > button` (13), plus `a > div` (2) and `a > figure` (1) rejected by `a`'s `:has(:model(interactive))` filter because a literal `<button>` sits in the subtree                                                                                |    16 | true, `a11y/interactive-nesting` already reports every one — the nested buttons at any depth                                                                                                                                                                                                 |
| Text in `ul`                                                                                                                                                                                                                                                              |     1 | true but trivial — a comma text node between `<b>` items (the separate text column; outside the 351 element findings above)                                                                                                                                                                  |

Adjudicated FPs: **0 of 351** — every finding violates the content model as written; the
adjudication splits them by consequence, not validity. The compiler-agreeing count of 0 needs
its mechanism stated precisely: the autoclose subset (`<p><div></p>` statically nested) is a
Svelte **parse error**, so it cannot appear in a parseable file; the rest of the compiler's
placement checks (`node_invalid_placement`, analyze-phase error / `…_ssr` warning through
blocks) simply did not occur in this corpus — near-0 is what the methodology expected for apps
that build.

## Decision

**Build.** This is the first measurement in the series where the probe found repeated,
adjudicated-true, user-visible defect classes the compiler cannot report. Contrast: the
attribute measurement found 4 findings across five apps (~750 routes), the small-rule pool's
seven measured candidates totalled 2 across 321 routes — this found 101 findings with real AT
consequence (the first two classes) across the corpus, including svelte.dev's site-kit.

**The distribution is the design's central constraint.** 234 of 351 findings are the
spec-true-but-benign flow-in-phrasing class, dominated by one styling idiom (`button > div`).
A rule that reports all 351 at `warning` lights up every dashboard in the corpus; the
implementation design must decide the severity split (the AT-consequence classes vs the
spec-only class) before the rule ships, with these numbers as the input. Nothing here is an FP,
so nothing forces a scope cut — but "根拠のないものは info" applies to the benign class.

Implementation is its own increment with its own design, carrying from this measurement:

- **Prerequisite fact**: a parent-chain-aware element collection (`ElementFact` has no parent
  today) — the same prerequisite the attribute measurement recorded for ancestor selectors.
- **Data**: the projection already carries `contentModel` and the category lists
  (`packages/core/src/html-spec/types.ts`); what the evaluator must inherit from the probe is
  the **semantics**: `#custom` never matches a judged child, `svg|svg` is the HTML `<svg>`
  root, positive `:has` needs the child's completed subtree (judge after the walk).
- **Carve-outs measured here**: option/optgroup (compiler-wins), snippet bodies, custom
  elements, `svelte:element`, `<slot />` children, unknown tags, transparent-at-root, `inSvg`,
  undecidable conditionals → laxest union.
- **The interactive-exclusion class is left to `a11y/interactive-nesting`** — 16 findings are
  that rule's exact territory, the direct `a > button` hits and the `:has`-arm hits alike. The
  shipped rule does **not** emit them: the transparent filter, including its `:has` half, is
  separable from model membership, and the rule evaluates membership only — so these 16 stay
  single-reported by `a11y/interactive-nesting`.
- **The text column is not shipped** — 1 trivial occurrence in 3,671 files does not earn the
  extra judgment; recorded here so it isn't re-litigated.
