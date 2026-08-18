# Element-level HTML spec data — the source, and how it is consumed

Phase C-9 of `2026-08-16-v1-roadmap.md`. The a11y category design deferred every rule that needs
per-element HTML data (content models, attribute tables, deprecation, per-element ARIA) to a design
whose "central question" is the data source, because 1.0 must not ship a dependency it would later
swap. This is that decision. The rules themselves follow as ordinary increments; two land with the
pipeline so it does not ship without a consumer.

## What the rules need

| rule                                                          | data                                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `deprecated-element`                                          | per-element deprecated/obsolete flag                                    |
| `deprecated-attr`                                             | per-attribute deprecated/obsolete flag, per element                     |
| `required-attr` (generic)                                     | per-attribute `required` / `requiredEither`, per element                |
| `ineffective-attr`                                            | per-attribute `ineffective` / `condition`, per element                  |
| `invalid-attr`                                                | per-attribute value type, per element and global                        |
| `permitted-contents` (full)                                   | per-element content model, plus the content categories                  |
| `implicit-role`, `disallowed-props`, `deprecated-props/-role` | per-element implicit role and permitted roles; per-role property tables |

## The source: `@markuplint/html-spec`, vendored

Surveyed: `@markuplint/html-spec`, `html-element-attributes`, `html-tag-names`, `aria-query`,
`axe-core`, `html-validate`. Only one is a **published, data-only** dataset carrying every column
above: `@markuplint/html-spec` (MIT; 4.18.0; six releases in the past twelve months). Its runtime is
one JSON file — `index.js` is `module.exports = require('./index.json')` — with 206 elements, each
carrying `contentModel`, typed `attributes` with `required`/`requiredEither`/`deprecated`/`obsolete`/
`ineffective`/`condition` flags, `aria.implicitRole`/`permittedRoles` (per ARIA version), and
`categories`; plus `#contentModels`, `#globalAttrs`, and `#aria` tables. `html-element-attributes`
has names only, no types or flags. `html-validate`'s element metadata is comparable but lives inside
the linter package, not as data. `axe-core` is an engine, MPL-2.0. Nothing else exists to swap to,
which is what the roadmap's constraint was about.

**Vendored, not depended on.** A generator (`packages/core/scripts/gen-html-spec.js`, run manually
like `gen-action-pin`) fetches the tarball for a **pinned version**, projects it down to the fields
above, and writes `packages/core/src/html-spec/generated.ts` with the upstream MIT notice at the top.
A drift test fails the build if the committed file does not match the generator's output for the
pinned version. Three measured reasons:

- **The package's declared dependency is types-only at runtime but installs anyway.**
  `@markuplint/html-spec` depends on `@markuplint/ml-spec` for its `.d.ts`; that pulls
  `@markuplint/ml-ast`, `@markuplint/types`, `dom-accessibility-api`, `is-plain-object`, and
  `type-fest` into every user's `node_modules` for a file that only ever loads JSON.
- **85% of the JSON is prose the rules never read.** 1.24 MB raw; 0.19 MB once `description`,
  `cite`, `defaultValue`, `animatable` and the `#aria` table are dropped — half of core's current
  dist. `@svelte-vitals/core` stays zero-runtime-dependency beyond what it has, and core purity is
  trivially preserved: the data is a TS module.
- **The dataset 1.0 ships is the one 1.0 was tested against.** A semver range on a data package
  lets `pnpm update` change what a rule reports; a pinned generator makes every data change a PR with
  a reviewable diff, which is the only honest way to meet "1.0 must not inherit a data source we'd
  swap".

## ARIA stays on `aria-query`; the two sources get a guard

`#aria` in the markuplint data is **not** adopted, and the reason is measured: it omits DPUB-ARIA
entirely (`doc-toc`, `doc-pagelist`, … — 42 roles `aria-query` carries and it does not), so swapping
would make `invalid-role` flag valid publishing markup. One vocabulary source, unchanged.

The two sources must not silently disagree about what exists, so a test asserts that every role and
property in the markuplint ARIA 1.3 table is one this codebase already recognizes. Today that holds
because of exactly the patches `aria-data.ts` already carries: markuplint's 1.3 table lists the five
roles (`comment`, `image`, `sectionheader`, `sectionfooter`, `suggestion`) and two attributes
(`aria-colindextext`, `aria-rowindextext`) that `ARIA_1_3_ROLES`/`ARIA_1_3_ATTRIBUTES` add on top of
`aria-query`, and its required-property rows agree with `NO_REQUIRED_PROPS` on `option` and
`treeitem`. An independent dataset arriving at the same five-plus-two is corroboration worth
recording; the guard is so the next divergence is loud.

Where the tables differ on required properties — `combobox` and `scrollbar` no longer require
`aria-controls` in markuplint's 1.3 row; `separator` requires `aria-valuenow` there and not in
`aria-query` — the rule keeps its current source. `separator` is the instructive one: the spec
requires it only for a focusable separator, and markuplint's table flattens the condition, so
adopting it would flag every `<div role="separator">`. Neither table is spec-exact; both need
judgment, and that judgment stays where it is.

## What this decision does not settle

- **The content-model evaluator.** Content models are a small selector DSL — four pseudo-classes
  (`:model`, `:not`, `:has`, `:animate`) and six quantifiers (`oneOrMore`, `zeroOrMore`, `choice`,
  `require`, `optional`, `transparent`) over 206 elements — evaluated against a template that is not
  a DOM: components, slots, and blocks punch holes in it. Which holes make a parent unjudgeable is
  `permitted-contents`' own design, and the same open-world reasoning that `no-missing-id-ref` had to
  face (#533) applies to it. The data does not decide that.
- **The attribute type interpreter.** 228 distinct type expressions; `Boolean`, `URL`, `<number>`,
  `Enum`, `DOMID` cover the common ones, `FunctionBody` (event handlers) is the largest single bucket.
  `invalid-attr`'s design decides the subset it validates and states what it leaves.
- **Compiler alignment.** The Svelte compiler validates none of these — no deprecated-element or
  content-model warnings — so there is no compiler position to align with here. Where a future rule
  overlaps a compiler a11y warning, the compiler wins, as decided for the ARIA rules.

## What ships with the pipeline

`a11y/deprecated-element` and `a11y/deprecated-attr` — pure lookups, one data field each, so the
generated module has consumers on day one. Measured on five real apps: `<strike>` ×2 and
`iframe[frameborder]` ×11 across two of them, so both fire on real code without being noisy. Each
gets docs (en/ja), a kitchen-sink sample, and the meta-test coverage every rule has; the remaining
rules follow one at a time under the same bar, each with its own measurement.

## Testing

1. Drift test: the committed generated module equals the generator's output for the pinned version.
2. ARIA guard: markuplint 1.3 roles ∪ props ⊆ what `aria-data.ts` recognizes.
3. The generated module carries the upstream MIT notice and the pinned version.
4. Core purity: `packages/core/src` still has no `node:` import; the generator lives under `scripts/`.
5. `deprecated-element` / `deprecated-attr`: kitchen-sink samples with expected counts; a
   non-deprecated element and a deprecated attribute on a different element (`img[frameborder]`) do
   not fire.
