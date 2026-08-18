# The ARIA role-table rules — `disallowed-aria-props`, `deprecated-aria`, `redundant-role`

The three "aria-query-only gaps" of roadmap Phase C-9, now buildable because
`2026-08-18-html-spec-data-source.md` vendored markuplint's per-role property tables. All three are
lookups over `HTML_SPEC.aria.roles` and `HTML_SPEC.elements[].aria`; none needs a selector
evaluator. This document decides what each judges, on which role, and how the compiler's overlapping
warnings are treated — the last because the shipped `deprecated-element` got that wrong and this
design corrects it.

## Measured first

A probe over the five corpus apps (`ariaElements` facts × the vendored role table):

| candidate                                  | kener | svelte-commerce | CMSaasStarter | networking-toolbox | joy | compiler warns?                                         |
| ------------------------------------------ | ----: | --------------: | ------------: | -----------------: | --: | ------------------------------------------------------- |
| a prop the role does not own / prohibits   |     0 |               8 |             0 |                  1 |   0 | on explicit and some implicit roles; **not** on generic |
| a deprecated prop, global or on that role  |     0 |               0 |             0 |                  1 |   0 | no                                                      |
| a deprecated role                          |     0 |               0 |             0 |                  0 |   0 | no                                                      |
| an explicit role equal to the implicit one |     0 |               0 |             0 |                  0 |   0 | yes, `a11y_no_redundant_roles`                          |

All nine disallowed-prop hits are `aria-label` (once `aria-level`) on a bare `<div>`/`<span>` — the
`generic` role, which ARIA prohibits from being named. The Svelte compiler is silent on it (verified:
`<div aria-label="x">` compiles with no warning; `<div role="checkbox" aria-haspopup>` and
`<li aria-selected>` do warn). That single case is what makes the first rule worth shipping; axe
reports the same thing as `aria-prohibited-attr`, serious.

The deprecated-role candidate is one role (`directory`) that appears nowhere. It does not get a rule
of its own; it folds into `deprecated-aria`.

## The compiler-overlap policy, restated — and one reversal

The a11y category design ("Deliberate overlap") already decided this: a rule that judges the same
defect the compiler warns about is still implemented, because the compiler streams into a build log
and does not score, gate, or suppress — and the rule must **judge the same way**, never contradict.
`invalid-role` beside `a11y_unknown_role` is the precedent. What "the compiler wins" forbids is a
different verdict on the same markup, not a second reporter of the same one.

`deprecated-element` (#534) excluded `<marquee>`/`<blink>` because the compiler reports them, and the
html-spec design called reporting them again "the contradiction class". That was the wrong reading:
excluding them makes the a11y score blind to two obsolete elements while it counts `<font>`, which
is an inconsistency inside the rule, and it silences a scored gate the deliberate-overlap decision
exists to keep. **Reversed here**: `deprecated-element` reports all 29 obsolete elements, the
`COMPILER_REPORTED` set goes, and the html-spec design is amended to say so. The two rules ship
unreleased in the same version, so this is a correction, not a change of contract.

The three rules below therefore overlap `a11y_role_supports_aria_props(_implicit)` and
`a11y_no_redundant_roles` on purpose, and the docs say so.

## Which role an element has

Every judgment needs the element's role. Explicit first: a literal `role` resolves to its first
concrete token (`resolveRole`, the shared helper), and a role with no row in the vendored table —
DPUB-ARIA — yields no judgment. An expression role, or a spread on the element, means the role is
unknowable, and no implicit judgment is made.

With no explicit role, the implicit role comes from the element's `aria.implicitRole` — but 16
elements (`a`, `area`, `div`, `figure`, `footer`, `form`, `header`, `img`, `input`, `option`,
`section`, `select`, `td`, `th`, `tr`) have **conditional** implicit roles the dataset encodes as
selectors: `<a>` is `link` only with `href`, `<img alt="">` is `presentation`, `<input>` is whatever
its `type` says. Those selectors are not evaluated (that is the DSL the html-spec design left
unsettled). Instead the projection now carries each element's condition **outcomes** — the role each
condition maps to, selector strings kept only as keys — and a judgment on an implicit role is made
**only when it holds under the default role and under every conditional one**. A condition whose
outcome is no role at all is treated as `generic`, which is what ARIA in HTML says an element with no
corresponding role is exposed as.

That is what keeps the corpus finding and drops the false-positive traps in one move: `<div
aria-label>` is prohibited under `generic` and under `dl > div` (no role → generic), so it fires;
`<a aria-label>` is owned by `link` and prohibited by the `:not([href])` variant, so it does not;
`<input aria-checked>` is not owned by `textbox` and owned by the checkbox variant, so it does not.
Where this leaves a real defect unreported — a `<a aria-label>` with no `href` — the compiler's
`_implicit` warning still covers the cases its own table has, and the rule docs say what is left.

This amends the html-spec design's "conditions dropped wholesale": `aria.conditions` is now projected
as `{ selector: role | null }`, implicit role only — the per-condition `permittedRoles`/`properties`
(where the `aria-hecked` typo lives) stay out, as does the `1.1` variant.

## The three rules

**`a11y/disallowed-aria-props`** (warning — the attribute is ignored or wrong, on the element the
author wrote it on). An `aria-*` attribute the element's role does not own, or lists as prohibited,
under every role candidate. Global properties are inherited into every role's `ownedProperties`
(verified: no role in the table lacks `aria-hidden`), so a global on any role passes; `generic`'s
`prohibitedProperties` are the naming attributes, which is the corpus case. Value is not judged
(`invalid-aria-value`) and existence is not (`unknown-aria-attribute`): an unknown attribute is
skipped here so one typo yields one finding.

**`a11y/deprecated-aria`** (info). A literal role the table marks deprecated (`directory`), an
attribute the table marks deprecated globally (`aria-dropeffect`, `aria-grabbed`), or an attribute
deprecated on the resolved role under every candidate (`aria-haspopup` on `checkbox` — the table has
330 such rows). One rule, three arms, because two of them are one entry each.

**`a11y/redundant-role`** (info). A literal role equal to the element's implicit role, on an element
whose implicit role is unconditional — `<button role="button">`, `<nav role="navigation">`,
`<ul role="list">`. `<a href role="link">` is left to the compiler: `a` is conditional. Zero in the
corpus; kept because the compiler's identical warning proves the class exists and the rule is a
two-line lookup, and because leaving a scored gap where the compiler warns is the reversal above in
miniature.

Attribute names are already lowercased in `AriaElementFact`; the SVG namespace is not tracked there
(the ARIA rules have never skipped it, and `<svg role="img" aria-label>` is exactly right to judge).

## Not in scope

`permitted-role` (a role the element does not permit) — `permittedRoles` is projected, but the check
depends on the same conditional variants and on `permittedRoles`' own per-condition overrides that
were dropped; its own increment. `implicit-props` / `required-owned-elements` / `required-parent`:
Phase 2 proper.

## Testing

1. Unit, per rule, through `parseComponentFacts`: the corpus case (`<div aria-label>`) fires; `<a
aria-label>` and `<input aria-checked>` do not (conditional variants); DPUB role → nothing; a role
   with a spread on the element → nothing implicit; fallback tokens resolve; unknown attribute skipped.
2. `deprecated-aria`: each of the three arms; `aria-haspopup` on `<div role="checkbox">` fires, on
   `<div role="menuitem">` does not.
3. `redundant-role`: `<button role="button">` fires; `<a href role="link">` does not.
4. `deprecated-element` now reports `<marquee>` — the kitchen-sink sample flips from silent to a
   finding, and the html-spec spec's test 5 clause is amended.
5. Kitchen-sink samples for all three, with counts in both expectation files; docs en/ja; changeset
   naming the compiler overlap and the `deprecated-element` correction.
6. Corpus re-run with the shipped rules, numbers recorded here before merge.
