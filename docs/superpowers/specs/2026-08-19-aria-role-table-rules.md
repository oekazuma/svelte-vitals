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

| candidate                                          | kener | svelte-commerce | CMSaasStarter | networking-toolbox | joy | compiler                                                                                                                                                   |
| -------------------------------------------------- | ----: | --------------: | ------------: | -----------------: | --: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a naming attribute on an element that prohibits it |     0 |               8 |             0 |                  1 |   0 | **silent** (`<div aria-label>` compiles clean)                                                                                                             |
| a prop an explicit role does not own               |     0 |               0 |             0 |                  0 |   0 | `a11y_role_supports_aria_props`                                                                                                                            |
| a globally deprecated prop (`aria-grabbed`)        |     0 |               0 |             0 |                  1 |   0 | silent                                                                                                                                                     |
| a prop deprecated on the resolved role             |     0 |               0 |             0 |                  0 |   0 | on explicit roles and its mapped implicit elements, `a11y_role_supports_aria_props` as _unsupported_ (aria-query removed them); silent on `<div>`/`<span>` |
| a deprecated role (`directory`)                    |     0 |               0 |             0 |                  0 |   0 | silent                                                                                                                                                     |
| an explicit role equal to the implicit one         |     0 |               0 |             0 |                  0 |   0 | `a11y_no_redundant_roles`, with deliberate exemptions                                                                                                      |

Nine of the ten hits are `aria-label` on a bare `<div>`/`<span>`. Those elements are
`namingProhibited` in the dataset — the fact axe's `aria-prohibited-attr` keys on — and the compiler
says nothing. That is what makes the first rule worth shipping. (axe grades it _needs review_ when
the element has text content — all nine corpus hits do — and _serious_ only when it does not, and
axe additionally exempts a naming attribute whose nearest ancestor role is a widget, or a custom
element; the rule reports all of these, because ARIA prohibits the attribute on the role regardless
of what else names the element, and the docs say where axe's grading differs. `<label>` is the one
worth naming there: the TR prohibits naming on it only when it is exposed as `generic`, the dataset
and axe both prohibit it unconditionally, and `<label for=… aria-label="close sidebar">` is a real
idiom that will fire.)

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
role_ (`<canvas>`, `<iframe>`, `<video>` — 72 HTML elements), and a `conditions[selector]` entry with
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
non-global attribute under this device (23 conditions across eight roles) even though `inputType` is
collected; the compiler's `_implicit` warning covers `<input type="text" aria-checked>`, and the docs
record the limitation rather than the rule pretending otherwise.

## The two rules

**`a11y/disallowed-aria-props`** (warning). Two arms, with different messages because they are
different facts:

- _Prohibited_, in two forms. **(a)** `aria-label` / `aria-labelledby` / `aria-braillelabel` on an element whose
  `namingProhibited` holds under every candidate (message: "prohibited on `<div>` — its role does not
  take a name"); and **(b)**, on a role — explicit, or implicit and holding under every candidate — any
  attribute its row lists in `prohibitedProperties`, with a message that names the attribute and the
  role. The second form is what catches `aria-roledescription` on `generic` (ARIA 1.2 prohibits it;
  the compiler is silent) without calling it a naming attribute — and it is why the braille
  role-description form is **not** in the first list: `paragraph`, `code`, `strong` and the other text
  roles own `aria-brailleroledescription`, so `<p aria-brailleroledescription>` must stay silent.
- _Not owned by the role_: an attribute absent from an **explicit** role's `ownedProperties`, or from
  the implicit role's when that role holds under every candidate. Message: "`aria-level` is not
  supported by role `generic`". This is the arm that overlaps `a11y_role_supports_aria_props(_implicit)`.

Global properties are owned by every role in the table with one shape of exception: the three naming
globals (`aria-label`, `aria-labelledby`, `aria-braillelabel`) are absent from the 17 prohibiting
roles' `ownedProperties`, the two role-description globals from `generic` alone, and every one of
those absences is also a `prohibitedProperties` entry — so a global on any role either passes or lands
in the _prohibited_ arm, never in _not owned_. Value is not judged (`invalid-aria-value`) and existence is not
(`unknown-aria-attribute`): an unknown attribute is skipped so one typo yields one finding.

**Two named exemption lists, with different justifications.** The rule consults nothing but the
vendored table except these, both of which are data judgment rather than data, so they live in code
with a test that pins each entry:

- _The compiler wins._ Diffing markuplint 1.3 `ownedProperties` against aria-query (the compiler's
  pin is 5.3.1; the workspace's 5.3.2 is identical here) on the 98 shared roles, the disagreements
  that would make this rule warn on markup the compiler accepts are exactly ten (role, property)
  pairs: `listitem`/`aria-level`, `tablist`/`aria-level`, `listbox`/`aria-expanded`,
  `menuitemcheckbox` and `menuitemradio` × `aria-readonly`/`aria-required`, and `aria-expanded` on
  the three `graphics-*` roles — counting the not-owned arm only; aria-query also lists the naming
  attributes as supported on 15 of the 17 prohibiting roles (`none` lists none, so the compiler
  warns there — same direction, no breach — and `suggestion` is absent from aria-query;
  `aria-braillelabel` it lists only on `mark`, so elsewhere the compiler says _unsupported_ where the
  rule says _prohibited_, again the same direction), and the
  compiler never reads
  `prohibitedProps`, so the prohibited arm is compiler-silent on explicit roles too, by design not
  by exemption. Only the first and third of the ten are supported in ARIA 1.2 itself; the rest are
  1.1 leftovers or superclass artefacts aria-query still lists. The dataset is the more current
  reading, and the compiler still wins — a different verdict on the same markup is what the policy
  forbids, whichever source is right.
- _The spec wins over the dataset._ `<address>` and `<hgroup>` are `namingProhibited` in the dataset,
  but html-aria (TR and editor's draft) gives both `role=group` with no naming prohibition and axe's
  element table agrees; upstream markuplint `main` still carries the flag, so this is a data bug, not
  version drift. `<address>` is exempted from form (a) — its dataset role is already `group`, whose
  row prohibits nothing. `<hgroup>` needs more: the dataset also gives it `implicitRole: "generic"`,
  the same misreading, and `generic`'s row would fire form (b), the not-owned arm, and
  `deprecated-aria` (`aria-disabled`) on it regardless of form (a). So the `<hgroup>` entry
  **replaces its element-level ARIA facts** — implicit role `group`, no `namingProhibited` — which
  closes all four in one move; `<hgroup aria-label>` and `<hgroup aria-disabled>` are pinned silent.
  Form (a) stays keyed on the **element's** flag, not the resolved role's: `<label>`, `<legend>` and
  `<figcaption>` are `implicitRole: false` with `namingProhibited: true`, so keying (a) on the role
  would silently drop the `<label aria-label>` case decided above — `<label for=… aria-label>` firing
  is pinned for exactly that reason. (Under the override `<hgroup aria-haspopup>` still fires
  `deprecated-aria` and `<hgroup aria-level>` still fires not-owned; both are correct for `group`.) (`<html>` is also flagged
  in the dataset; html-aria permits no `aria-*` on it at all, so the outcome is right and only the
  message would mislead — the arm's message names the element, not a role, for it.)

**`a11y/deprecated-aria`** (info). A literal role the table marks deprecated (`directory`); an
attribute deprecated globally (`aria-dropeffect`, `aria-grabbed`); an attribute deprecated on the
resolved role under every candidate (330 rows in the table — the common real hit is `aria-disabled`
or `aria-haspopup` on `generic`: `aria-haspopup` is deprecated on 88 of the 103 roles,
`aria-disabled` on 66). On explicit roles (295 of the 310
explicit-role pairs on the 98 roles aria-query shares — the other 20 sit on the five roles it lacks,
where the compiler's overlap is `a11y_unknown_role` instead; the 15 exceptions are `menuitemcheckbox`/`menuitemradio` × `aria-errormessage`/
`aria-invalid`, the three `graphics-*` roles × `aria-errormessage`/`aria-haspopup`/`aria-invalid`,
and `graphics-document`/`graphics-symbol` × `aria-disabled`, where it is silent), and on the
implicit elements the compiler maps, it reports the role-deprecated arm as _unsupported_ at warning,
because aria-query dropped those properties from its role tables rather than flagging them; the
verdict class is the same ("do not write this here"), the label and severity differ, and the docs say
so. On `<div>`/`<span>` — the common case — the compiler is silent, since its implicit-semantics table
has no entry for them.

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
aria-level>` fire with the two different messages; `<label for="x" aria-label="close">` fires (form
   (a) is element-keyed); `<div aria-roledescription>` fires with the
   property-named message and `<p aria-brailleroledescription>` does not; `<canvas aria-label>`, `<a
aria-label>`, `<img
aria-label>`, `<input aria-checked>`, `<address aria-label>`, `<hgroup aria-label>` do not; `<li aria-level>` does not
   (exemption, all ten pairs pinned); a DPUB role,
   an expression role, and a spread with no literal role → nothing; a spread with a literal role →
   still judged; fallback tokens resolve; an unknown attribute is skipped.
3. `deprecated-aria`: each arm; `aria-haspopup` on `<div role="checkbox">` fires, on `<div
role="menuitem">` does not; `<div aria-disabled>` fires via `generic`; `<hgroup aria-disabled>` does
   not (its implicit role is overridden to `group`).
4. `deprecated-element` reports `<marquee>`; kitchen-sink and the html-spec spec updated.
5. Kitchen-sink samples for both rules with counts in both expectation files; docs en/ja stating the
   compiler overlap, the axe grading difference, and the `<input>` limitation; changeset naming the
   overlap and the `deprecated-element` correction.
6. Corpus re-run with the shipped rules, numbers recorded here before merge.
