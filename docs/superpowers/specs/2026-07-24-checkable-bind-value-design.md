# correctness/checkable-bind-value: bind:value on checkbox/radio inputs — Design

Date: 2026-07-24
Status: Approved

## Problem

`<input type="checkbox" bind:value={x}>` and `<input type="radio" bind:value={x}>` compile
and run without any warning, but `bind:value` binds the DOM `value` property — on a checkable
input the user's interaction toggles *checkedness*, which `bind:value` never observes. The
bound variable is silently frozen at its initial value forever; the form looks fine in
development and never updates in production. The correct bindings are `bind:checked` (single
checkbox) or `bind:group` (radio groups / checkbox lists).

Sourced from the 2026-07-24 rule-candidate survey — candidate C of three (A:
`correctness/nonreactive-builtin-state` shipped, B: base-path navigation, #300).

### Empirical verification (issue's required first step)

Before designing further, confirmed against the real Svelte 5 compiler (`svelte@5`, via both
`svelte-autofixer` and a direct `svelte.compile()` call) that `bind:value` on
`type="checkbox"`/`type="radio"` produces **zero** compiler warnings or errors — `warnings: []`
in both cases. The compiler silently accepts it. This confirms the rule's value-add: it is a
real deploy-blocker (state never updates in production) that only static analysis catches.

## Rule

- **Id / title**: `correctness/checkable-bind-value` / `bind:value on a checkable input`
- **Category / severity / scope**: `correctness` / `warning` (silent stale UI — same grade as
  `nonreactive-builtin-state`) / component
- **Shape**: `componentRule` factory, file
  `packages/core/src/rules/correctness/checkable-bind-value.ts`; label
  `bind:checked / bind:group on checkable inputs`
- message (checkbox): `bind:value on a checkbox does not track its checked state — the bound
  value silently never updates when the user toggles it. Use bind:checked (single checkbox) or
  bind:group (checkbox list) instead.`
- message (radio): `bind:value on a radio input does not track which option is selected — the
  bound value silently never updates when the user picks one. Use bind:group with a shared
  group variable across the radio inputs instead.`
- recommendation: `Replace bind:value with bind:checked (single checkbox) or bind:group
  (checkbox list / radio group).`
- rationale: `bind:value binds the DOM value property. A checkbox/radio's user interaction
  toggles checkedness, which bind:value never observes — the bound state is frozen at its
  initial value. Svelte's checked/grouped bindings (bind:checked, bind:group) are built for
  exactly this.`
- fix (description-only): `For a single checkbox, replace bind:value={x} with
  bind:checked={x} (x becomes a boolean). For a checkbox list or radio group, replace
  bind:value={x} with bind:group={x} on every input sharing the same group, keeping each
  input's static value attribute (or a shared "value" binding) to identify the option.`

## Scope (v1)

- **In scope**: a static `<input>` element (`RegularElement` named `input`) whose `type`
  attribute is a literal `"checkbox"` or `"radio"` and which carries a `bind:value` directive.
- **Out of scope** (documented limitations, matches the issue's proposal):
  - Dynamic `type={expr}` — out of static reach, skipped.
  - `<svelte:element this="input" type="checkbox" bind:value>` — dynamic tag name, same
    reasoning as dynamic `type`.
  - `<select bind:value>` and custom components that accept a `value`/`bind:value`-like prop
    (e.g. a hand-rolled `<Checkbox bind:value>`) — the rule only understands the native
    `<input>` element's actual DOM binding semantics; a component's internal implementation is
    invisible to static analysis.
  - A plain `value="x"` attribute (not a directive) on a checkbox/radio is correct usage (it
    feeds `bind:group`) and is a different AST node (`Attribute`, not `BindDirective`) — never
    confused with the flagged case.

## Fact

`ComponentFacts` gains a channel-conventional non-optional list (`emptyComponentFacts` and the
parser's return object both gain the empty default):

```ts
/** `<input type="checkbox">` / `<input type="radio">` elements carrying a `bind:value`
 *  directive — bind:value observes the DOM value property, which checkbox/radio interaction
 *  never changes, so the bound state silently never updates (correctness/checkable-bind-value). */
checkableBindValues: {
  kind: 'checkbox' | 'radio';
  line: number;
}[];
```

## Detection (component-parse)

A dedicated walk over the template fragment only (no script-side analysis needed — this is a
template-shape rule, like `security/javascript-url`'s `collectSecurityFacts`):

1. Visit every `RegularElement` node (skip `SvelteElement` — dynamic tag name, out of scope).
2. Skip unless `node.name === 'input'`.
3. Read the `type` attribute via `findAttr` + `attrTextOf`. Skip if absent, or if
   `attrTextOf` returns `undefined` (dynamic/mixed value — can't know statically). Skip unless
   the literal text is exactly `checkbox` or `radio` (case-sensitive match against the lowercase
   HTML value — real-world markup does not write `type="Checkbox"`, and case-folding would add
   complexity for a non-existent pattern).
4. Look for a `BindDirective` in `node.attributes` whose `name === 'value'`. If present, push
   `{ kind: <from step 3>, line: lineOf(source, attr.start ?? node.start) }`.

This mirrors `collectSecurityFacts`'s existing shape (element type check → attribute lookup →
directive lookup) and reuses `findAttr`/`attrTextOf`/`lineOf` from `svelte-ast.ts`. No new
generic machinery is needed.

### Not detected (summary, documented limitations)

Dynamic `type={expr}`; `<svelte:element>`; `<select bind:value>`; custom components accepting
`bind:value`-shaped props; a plain (non-directive) `value` attribute on a checkbox/radio (this
is the CORRECT pattern for `bind:group`, never flagged).

## Registration, docs, changeset

- Four standard registration places (grep for `correctnessNonreactiveBuiltinState` as the
  precedent, mirror for `correctnessCheckableBindValue`):
  `packages/core/src/rules/correctness/checkable-bind-value.ts` (new file),
  `packages/core/src/rules/index.ts` (import + `allRules` + re-export), and
  `packages/core/src/index.ts`'s re-export list.
- Docs: `docs/src/content/docs/rules/correctness/checkable-bind-value.md` + the `ja/` mirror.
  Cover both messages (checkbox vs. radio) and the documented out-of-scope cases above.
- Changeset: minor, `svelte-vitals` / `@svelte-vitals/core` (and any package that re-exports
  the rule list, per the existing convention for a new rule).
- Rides the existing component channel (`ctx.components`) — no producer/provider changes
  needed beyond the new `ComponentFacts` field.

## Testing

- **Parse unit** (mirrors `nonreactive-builtin-state-parse.test.ts`): `<input type="checkbox"
  bind:value={x}>` → recorded with `kind: 'checkbox'`; `<input type="radio" bind:value={x}>` →
  recorded with `kind: 'radio'`; `<input type="checkbox" bind:checked={x}>` → not recorded;
  `<input type="checkbox" value="x">` (plain attribute, feeding `bind:group` elsewhere) → not
  recorded; `<input type="text" bind:value={x}>` → not recorded (not checkable);
  `<input type={dynamicExpr} bind:value={x}>` → not recorded (dynamic type); `<svelte:element
  this="input" type="checkbox" bind:value={x}>` → not recorded; `<select bind:value={x}>` → not
  recorded; multiple checkable inputs in one file → each recorded with its own line.
- **Rule unit** (mirrors `nonreactive-builtin-state-rule.test.ts`): checkbox fact → the
  checkbox-specific message, severity `warning`, fix description present; radio fact → the
  radio-specific message; empty facts → no results; registration check (`allRules` contains
  `correctness/checkable-bind-value`, `explainRule(...)?.severity === 'warning'`).
- Docs-links test (`packages/cli/test/docs-links.test.ts`) will fail the build until both the
  en and ja doc pages exist — write them alongside the rule, not as an afterthought.
