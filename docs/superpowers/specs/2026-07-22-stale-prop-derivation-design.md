# correctness/stale-prop-derivation: prop-derived values frozen at init — Design

Date: 2026-07-22
Status: Approved

## Problem

Svelte's best-practices doc (`documentation/docs/07-misc/01-best-practices.md`, "$props") is explicit — "Treat props as though they will change":

```js
let { type } = $props();

// do this
let color = $derived(type === 'danger' ? 'red' : 'green');

// don't do this — `color` will not update if `type` changes
let color = type === 'danger' ? 'red' : 'green';
```

The plain form renders correctly on first mount and only breaks when the parent later changes the prop — a stale-UI bug that survives review and surfaces in production. Nothing in the compiler or svelte-check warns about it.

Sourced from the Svelte best-practices survey (2026-07-22) — candidate A of three (B: each-index-key shipped; C: reassign-only `$state` → `$state.raw` follows).

## Rule

- **Id / title**: `correctness/stale-prop-derivation` / `Stale prop derivation`
- **Category / severity / scope**: `correctness` / `warning` (maintainer decision) / component
- **Shape**: `componentRule` factory, file `packages/core/src/rules/correctness/stale-prop-derivation.ts`; label `Props derived reactively`
- message (per binding): `"<name>" is computed from a prop once, at initialization — it will not update when the prop changes. Wrap it in $derived.`
- recommendation: `Wrap the computation in $derived(...), or $derived.by(() => ...) when it needs a function body.`
- rationale: quotes the official guidance ("treat props as though they will change"; the doc's own do/don't pair), explains that the plain form freezes the first render's value so the UI silently stops tracking the parent.
- fix: description `Wrap the prop-derived computation in $derived.`, snippet `let color = $derived(type === 'danger' ? 'red' : 'green');`, lang `js`.

## Fact

`ComponentFacts` (packages/core/src/component.ts) gains a channel-conventional non-optional list; `emptyComponentFacts` gains the empty default:

```ts
/** Top-level const/let bindings computed from a $props() prop without $derived, never reassigned, and referenced in the template — frozen at init (correctness/stale-prop-derivation). */
stalePropDerivations: {
  name: string;
  line: number;
}
[];
```

## Detection (component-parse)

A top-level `<script>` (instance, not `<script module>`) `const`/`let` declarator is recorded when ALL four hold:

1. **Identifier binding** (destructuring-pattern declarators are skipped — conservative), with an initializer whose expression **references at least one prop name**. Prop names come from the existing `$props()` destructure collection (plain and renamed names; nested patterns and `...rest` are skipped, matching the existing conservative contract). Reference collection is shadow-aware (nested-function params) and ignores non-computed member property names and object keys. A bare alias (`const t = type;`) qualifies.
2. **Call-free initializer**: the initializer subtree contains NO `CallExpression`, `NewExpression`, or `AwaitExpression`. This structurally excludes every rune wrapper (`$state(prop)` — the documented initial-value-capture pattern — `$state.raw`, `$derived`, `$derived.by`, `$bindable`) as well as service construction (`new Thing(prop)`) and helper calls (`buildConfig(prop)`). Trade-off accepted for v1: method derivations like `type.toUpperCase()` are missed — the false-negative direction.
3. **Never reassigned**: the binding is not written anywhere in the component (script assignments, update/compound operators, or template two-way bindings). Reuse the existing write-tracking machinery that `correctness/unmutated-state` relies on; if that tracker's shape doesn't fit, a dedicated shadow-aware assignment scan over the instance script + template expressions is acceptable — the contract is "any write disqualifies".
4. **Referenced in the template**: the binding's name is read at least once in the component's fragment (expression tags, attribute/directive expressions, block expressions), shadow-aware for template scopes (`{#each}` contexts and index, `{#snippet}` parameters, `{#await}` values — `scopeIntroducedNames` already models these). Bindings used only inside handlers/functions are NOT flagged (lower confidence; often intentional captures).

Line recorded: the declarator's line.

### New machinery

A fragment identifier-reference walk (shadow-aware) — the only genuinely new piece. It walks the template AST, descends into expression positions, threads `scopeIntroducedNames`, and reports whether a given set of names is referenced (or returns the set of referenced names for one pass over all candidates).

### Not detected (summary)

`$state(prop)` / any rune-wrapped initializer (structural, via call-free); initializers containing any call/`new`/`await`; reassigned bindings; bindings not referenced in the template; destructuring declarators; components with nested/rest `$props()` patterns (no prop names collected → rule inert); `<script module>` declarations; props read directly in the template (fine — that's reactive).

## Registration, docs, changeset

- Four standard registration places (grep for `correctnessStalePropDerivation`, 5 hits).
- Docs: `docs/src/content/docs/rules/correctness/stale-prop-derivation.md` + ja mirror. The Limitations section documents the call-free trade-off (method derivations missed in v1) and the it-may-never-change caveat (the fix is still correct and free: `$derived` costs nothing).
- Changeset: minor for core / cli / vite / mcp.
- Rides the component channel — no producer changes.

## Testing

- **Parse unit**: the official do/don't pair (don't-form flagged at its line; `$derived` form not); bare alias `const t = type;` flagged; `$state(type)` not; `buildConfig(type)` / `new Thing(type)` / `await x` not (call-free); reassigned `let` not; binding used only in a handler not; binding used in an `{#each}` body where the context shadows the name → shadowing respected both ways; renamed prop (`{ type: kind }`) flagged via `kind`; nested/rest `$props()` → nothing; `<script module>` declaration → nothing; template usage via attribute expression and via block expression both count.
- **Rule unit**: message/name interpolation, line, severity warning, fix present; empty facts → no results.
- **Suppression**: inherited from the component channel's line-directive machinery (no new work; one pin test at rule level is enough if the channel tests don't already cover it).
- Final review: adversarial probes against built dist with realistic components.
