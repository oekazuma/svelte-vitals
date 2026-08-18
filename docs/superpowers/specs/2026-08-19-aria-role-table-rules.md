# The ARIA role-table rules — `disallowed-aria-props` and `deprecated-aria`

The "aria-query-only gaps" of roadmap Phase C-9, buildable because `2026-08-18-html-spec-data-source.md`
vendored markuplint's per-role property tables. Both rules are lookups over `HTML_SPEC.aria.roles`
and `HTML_SPEC.elements[].aria`; neither needs a selector evaluator. This document decides what each
judges, on which role, and how the compiler's overlapping warnings are treated — the last because the
shipped `deprecated-element` got that wrong and this design corrects it. The roadmap's third gap,
`implicit-role` (a redundant explicit role), is measured and **not built**; the reason is below.

## Measured first

A probe over the five corpus apps (`ariaElements` facts × the vendored tables), and the compiler's
verdict on the same snippets (`svelte/compiler` 5.56.9):

| candidate                                          | kener | svelte-commerce | CMSaasStarter | networking-toolbox | joy | compiler                                                                                   |
| -------------------------------------------------- | ----: | --------------: | ------------: | -----------------: | --: | ------------------------------------------------------------------------------------------ |
| a naming attribute on an element that prohibits it |     0 |               8 |             0 |                  1 |   0 | **silent** (`<div aria-label>` compiles clean)                                             |
| a prop an explicit role does not own               |     0 |               0 |             0 |                  0 |   0 | `a11y_role_supports_aria_props`                                                            |
| a globally deprecated prop (`aria-grabbed`)        |     0 |               0 |             0 |                  1 |   0 | silent                                                                                     |
| a prop deprecated on the resolved role             |     0 |               0 |             0 |                  0 |   0 | `a11y_role_supports_aria_props` — reported as _unsupported_, since aria-query removed them |
| a deprecated role (`directory`)                    |     0 |               0 |             0 |                  0 |   0 | silent                                                                                     |
| an explicit role equal to the implicit one         |     0 |               0 |             0 |                  0 |   0 | `a11y_no_redundant_roles`, with deliberate exemptions                                      |

Nine of the ten hits are `aria-label` on a bare `<div>`/`<span>`. Those elements are
`namingProhibited` in the dataset — the fact axe's `aria-prohibited-attr` keys on — and the compiler
says nothing. That is what makes the first rule worth shipping. (axe grades it _needs review_ when
the element has text content and _serious_ only when it does not; the rule reports it either way,
because ARIA prohibits the attribute on the role regardless of what else names the element, and the
docs say axe's grading differs.)

The deprecated-role candidate is one role that appears nowhere; it folds into `deprecated-aria`.

## The compiler-overlap policy, restated — and one reversal

The a11y category design ("Deliberate overlap") already decided this: a rule that judges the same
defect the compiler warns about is still implemented, because the compiler streams into a build log
and does not score, gate, or suppress — and the rule must **judge the same way**, never contradict.
`invalid-role` beside `a11y_unknown_role` is the precedent, and "the compiler wins" was coined in the
validity review for the case where two sources give the same markup different verdicts. What it
forbids is a different verdict, not a second reporter of the same one.

`deprecated-element` (#534) excluded `<marquee>`/`<blink>` because the compiler reports them, and the
html-spec design called reporting them again "the contradiction class". That was the wrong reading:
excluding them makes the a11y score blind to two obsolete elements while it counts `<font>`, and it
silences a scored gate the deliberate-overlap decision exists to keep. **Reversed with this change**:
`deprecated-element` reports all 29 obsolete elements, `COMPILER_REPORTED` goes, the html-spec
design's compiler paragraph and its test 5 are amended in the implementation, and the kitchen-sink
`<marquee>` sample flips from a planted silence to a planted finding. Both rules ship unreleased in
the same version, so this is a correction, not a change of contract.

## Which role an element has, and what the data actually says

Explicit first: a literal `role` resolves to its first concrete token (`resolveRole`); a role with no
row in the table (DPUB-ARIA) yields no judgment; an expression role means the explicit path is
unknowable. A spread on the element does not stop the explicit path — a spread cannot remove a literal
attribute the author wrote — but with no literal role, a spread means the role itself is unknowable
and no implicit judgment is made.

The dataset's element-level ARIA has three states that an earlier draft of this document collapsed
into two, and got wrong: `implicitRole: "x"` is a role, `implicitRole: false` is _no corresponding
role_ (`<canvas>`, `<iframe>`, `<video>`, 60-odd elements), and a `conditions[selector]` entry with
**no** `implicitRole` key inherits the default (`dl > div`, `figure:has(figcaption)` carry only
`permittedRoles`). "No corresponding role" is not `generic`: treating it so flags
`<canvas aria-label>`, which is in kener twice and is fine.

So the projection changes, and the html-spec design's "conditions dropped wholesale" is amended:

- `aria.namingProhibited?: true` is projected at element level (36 elements: `div`, `span`, `p`,
  `b`, `i`, `code`, `label`, `time`, …) and per condition where the dataset writes it (`a`, `area`,
  `header`, `footer`).
- `aria.conditions?: Record<selector, { implicitRole?: string | false; namingProhibited?: true }>`
  is projected **only from conditions carrying one of those keys** (13 elements carry an
  `implicitRole` outcome: `a`, `area`, `footer`, `form`, `header`, `img`, `input`, `option`,
  `section`, `select`, `td`, `th`, `svg:a`), an absent key meaning "inherit". Selector strings are
  keys, never evaluated. Per-condition `permittedRoles`/`properties` (the `aria-hecked` typo) and the
  `1.1` variant stay out.

An implicit judgment is made **only when it holds under the default and under every condition
outcome**, absent keys inheriting. `<div aria-label>`: `namingProhibited` on the element, `dl > div`
inherits it → fires. `<a aria-label>`: default `link` is not naming-prohibited → no. `<img
aria-label>`: `img` owns naming, `[alt=""]` → `presentation` → no. A `false` outcome means the role,
and so ownership, is unknown → no ownership judgment there. `<input>` is unjudgeable for any
non-global attribute under this device (25 conditions across eight roles) even though `inputType` is
collected; the compiler's `_implicit` warning covers `<input type="text" aria-checked>`, and the docs
record the limitation rather than the rule pretending otherwise.

## The two rules

**`a11y/disallowed-aria-props`** (warning). Two arms, with different messages because they are
different facts:

- _Prohibited naming_: `aria-label` / `aria-labelledby` (and the two braille forms) on an element
  whose `namingProhibited` holds under every candidate, or on an explicit role whose row lists them in
  `prohibitedProperties` (`generic`, `presentation`, the text roles). Message: "`aria-label` is
  prohibited on `<div>` — its role does not take a name".
- _Not owned by the role_: an attribute absent from an **explicit** role's `ownedProperties`, or from
  the implicit role's when that role holds under every candidate. Message: "`aria-level` is not
  supported by role `generic`". This is the arm that overlaps `a11y_role_supports_aria_props(_implicit)`.

Global properties are owned by every role in the table with one shape of exception: the five naming
globals are absent from 17 roles' `ownedProperties`, and every one of those absences is also a
`prohibitedProperties` entry — so a global on any role either passes or lands in the _prohibited_
arm, never in _not owned_. Value is not judged (`invalid-aria-value`) and existence is not
(`unknown-aria-attribute`): an unknown attribute is skipped so one typo yields one finding.

**Where the tables would give a different verdict from the compiler, the compiler's holds.** Diffing
markuplint 1.3 `ownedProperties` against aria-query on the 95 shared roles, the disagreements that
would make this rule warn on markup the compiler accepts are exactly seven: `listitem`/`aria-level`,
`tablist`/`aria-level`, `listbox`/`aria-expanded`, `menuitemcheckbox` and `menuitemradio` ×
`aria-readonly`/`aria-required`, and `aria-expanded` on the three `graphics-*` roles — each one a
property ARIA 1.2 lists as supported. Those pairs are exempted by name, in the rule, with that reason;
the list is data judgment, not data, so it lives in code with a test that pins it, and it is the only
place this rule consults anything other than the vendored table.

**`a11y/deprecated-aria`** (info). A literal role the table marks deprecated (`directory`); an
attribute deprecated globally (`aria-dropeffect`, `aria-grabbed`); an attribute deprecated on the
resolved role under every candidate (330 rows in the table — the common real hit is `aria-disabled`
or `aria-haspopup` on `generic`, since 66 of 88 roles deprecate those). The compiler reports the
role-deprecated arm as _unsupported_ at warning, because aria-query dropped those properties from its
role tables rather than flagging them; the verdict class is the same ("do not write this here"), the
label and severity differ, and the docs say so.

## Not built: `redundant-role`

Zero in the corpus, and the compiler's `a11y_no_redundant_roles` covers it completely — including
elements this design's device cannot judge (`<a href role="link">`, `<img role="img">`) — with
**deliberate exemptions**: `<ul>`/`<ol>`/`<li>`/`<menu>` are skipped because `list-style: none`
strips list semantics in Safari and `role="list"` is the fix, and `<a role="link">` without `href`
is not redundant. A rule here would have to copy those exemptions verbatim to avoid contradicting the
compiler on the idiom it is most likely to meet, and would add scoring of a class no measured app has.
That is duplication with no measured payoff; the roadmap item is answered by "the compiler already
does this, identically", recorded here so it is not re-litigated.

## Not in scope

`permitted-role` (a role the element does not permit): `permittedRoles` is projected but its
per-condition overrides are not; its own increment. `implicit-props`, `required-owned-elements`,
`required-parent`: Phase 2 proper.

## Testing

1. Projection: `namingProhibited` and `conditions` land as specified; the drift test covers them; the
   ARIA guard extends to condition outcomes; a role row still has no `required`.
2. `disallowed-aria-props`, through `parseComponentFacts`: `<div aria-label>` and `<span
aria-level>` fire with the two different messages; `<canvas aria-label>`, `<a aria-label>`, `<img
aria-label>`, `<input aria-checked>` do not; `<li aria-level>` does not (exemption); a DPUB role,
   an expression role, and a spread with no literal role → nothing; a spread with a literal role →
   still judged; fallback tokens resolve; an unknown attribute is skipped.
3. `deprecated-aria`: each arm; `aria-haspopup` on `<div role="checkbox">` fires, on `<div
role="menuitem">` does not; `<div aria-disabled>` fires via `generic`.
4. `deprecated-element` reports `<marquee>`; kitchen-sink and the html-spec spec updated.
5. Kitchen-sink samples for both rules with counts in both expectation files; docs en/ja stating the
   compiler overlap, the axe grading difference, and the `<input>` limitation; changeset naming the
   overlap and the `deprecated-element` correction.
6. Corpus re-run with the shipped rules, numbers recorded here before merge.
