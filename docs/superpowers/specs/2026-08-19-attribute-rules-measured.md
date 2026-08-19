# The attribute-level spec-data rules, measured and not built

Roadmap Phase C-9 lists `required-attr`, `ineffective-attr` and `invalid-attr` among the rules the
vendored HTML spec data enables. This records what measuring them on real code found, and the
decision that follows: none of the three is built for 1.0, on measured grounds rather than deferred
ones.

## Method

The same five third-party apps used for every C-9 decision (kener, svelte-commerce, CMSaasStarter,
networking-toolbox, joy-of-code — about 750 routes), probed with the built `parseComponentFacts`
over `ElementFact`/the AST and the vendored data at `@markuplint/html-spec@4.18.0`.

## `required-attr`

The dataset has 20 `required`/`requiredEither` rows on HTML elements. Four are booleans
(`area[alt]`, `data[value]`, `optgroup[label]`, `track[src]`); the rest are same-element attribute
conditions (`img[src]` ⊻ `srcset`, `meta[content]` when `[name]`/`[http-equiv]`/`[itemprop]`, …) or,
for two `source` rows, ancestor selectors (`:is(video, audio) > source`) that need the parent.

Evaluating everything but the ancestor rows: **3 findings across the five apps**, all
`<track kind="captions" />` with no `src` in one component of svelte-commerce — the idiom that
silences the Svelte compiler's `a11y_media_has_caption`. Real (a captions track that points nowhere is
a fake captions track), and one idiom.

And a false-positive class is built into the data: `<meta>` requires one of
`name`/`http-equiv`/`itemprop`/`charset` — WHATWG's own rule — and `<meta property="og:title">` has
none of them. 57 hits on two apps, every one of them an Open Graph tag that this tool's `seo/og-*`
rules **require**. A rule that ships with that contradiction needs an exemption against the dataset on
day one.

## `ineffective-attr`

Three rows (`iframe[src]` under `[srcdoc]`; `script[async]`/`[defer]` under their conditions), all
same-element. **1 finding**: `<script src async defer>`, where `defer` is ineffective beside `async`.

## `invalid-attr`

Only the enum-typed subset was probed (the type interpreter for the other 200-odd type expressions is
the larger part of the rule). 610 literal enum-typed attribute values across the five apps, **0
outside their enum**.

## Decision

Four real findings on the measured subsets, one of them a compiler-workaround idiom, plus a 57-hit
contradiction with the tool's own SEO rules, against the cost of three rules with docs in two
languages, gallery samples, and the review cycle every rule in this repository goes through. That is
not a rule earning its place in a scored report; it is noise with a maintenance bill. None of the
three is built.

The measurement is of subsets, and the decision rests on those subsets plus the cost: the boolean and
same-element `required` rows (not the ancestor-selector rows), the three `ineffective` rows, and the
enum-typed attribute values (not the other type expressions). The unmeasured remainder is the part
that needs an evaluator to measure at all, which is the cost side of the same decision. So this is a
measured "no", not a "not for 1.0": the roadmap's principle that everything foreseeable ships before
1.0 is about not leaving known defects for users to find, and on what was measured these rules would
find almost none. If a later corpus says otherwise, the data columns are already in the projection
(`required`, `requiredEither`, `ineffective`, `condition`, `type`), the same-element condition
evaluator is a small piece of work, and the `meta[property]` exemption is the first thing such a rule
would need. The ancestor-selector rows (`:is(video, audio) > source`, `picture > source`) need one
more fact than exists today: `ElementFact` carries `tag`, `line`, `attrs` and `inSvg` and
`collectElements` keeps no parent or ancestor, so a parent-aware collection is a prerequisite for
measuring that remainder.

`permitted-contents` is not decided here — the compiler already errors on the browser-repair subset
(`node_invalid_placement`), and what remains needs the content-model DSL evaluated to be measured at
all. Its measurement is its own step.
