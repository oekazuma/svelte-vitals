# correctness/nonreactive-builtin-state: plain Map/Set/Date/URL in $state — Design

Date: 2026-07-23
Status: Approved

## Problem

`$state`'s deep proxy covers plain objects and arrays only. A built-in `Map`, `Set`, `Date`, `URL`, or `URLSearchParams` placed in `$state` is NOT proxied, so mutations (`map.set(...)`, `set.add(...)`, `date.setHours(...)`) are invisible to reactivity: the component renders correctly once and then the UI silently stops updating — in production, with no compiler or svelte-check warning. Svelte ships `svelte/reactivity` (`SvelteMap`, `SvelteSet`, `SvelteDate`, `SvelteURL`, `SvelteURLSearchParams`) precisely for this, and eslint-plugin-svelte's `prefer-svelte-reactivity` (recommended) targets the same class.

Sourced from the eslint-plugin-svelte re-survey (2026-07-23) — candidate A of three adopted (B: base-path navigation, C: bind:value on checkable inputs follow on their own branches).

## Rule

- **Id / title**: `correctness/nonreactive-builtin-state` / `Non-reactive built-in in $state`
- **Category / severity / scope**: `correctness` / `warning` (silent stale UI — same grade as `stale-prop-derivation`) / component
- **Shape**: `componentRule` factory, file `packages/core/src/rules/correctness/nonreactive-builtin-state.ts`; label `Reactive collections in $state`
- message (per binding): `"<name>" is a plain <Type> in $state — its mutations are not tracked, so the UI silently stops updating when it changes. Use Svelte<Type> from 'svelte/reactivity'.`
- recommendation: `Import the reactive equivalent from 'svelte/reactivity' (SvelteMap, SvelteSet, SvelteDate, SvelteURL, SvelteURLSearchParams) and construct that instead.`
- rationale: `$state` deep-proxies plain objects and arrays only; built-in collection/date/URL instances stay untracked, so property-level changes never reach effects, deriveds, or the template. Svelte's own answer is the drop-in classes in `svelte/reactivity`.
- fix (description-only): `Import Svelte<Type> from 'svelte/reactivity' and replace new <Type>(...) with new Svelte<Type>(...) — the API is identical.`

## Why not unconditional (the eslint approach)

`$state(new Date())` that is only ever REASSIGNED works correctly (reassignment is always reactive), so flagging every construction — as the eslint rule does — false-positives on a legitimate pattern. That is tolerable in an editor linter and not in a build gate. This rule's advantage over the eslint original: the constructor names the concrete type, so we can require an OBSERVED type-specific mutation before flagging — near-zero false positives.

## Fact

`ComponentFacts` gains a channel-conventional non-optional list (`emptyComponentFacts` and `parseModuleFacts` gain the empty default):

```ts
/** Plain built-in instances (Map/Set/Date/URL/URLSearchParams) in $state whose type-specific mutations were observed — untracked by reactivity (correctness/nonreactive-builtin-state). */
nonreactiveBuiltinStates: {
  name: string;
  type: string;
  line: number;
}
[];
```

`type` is the constructor name (`Map`, `Set`, `Date`, `URL`, `URLSearchParams`) for message interpolation.

## Detection (component-parse)

An instance-script top-level declarator is recorded when BOTH hold:

1. **Candidate**: Identifier binding whose initializer is a plain `$state(...)` call (reuse `isPlainStateCall`; `$state.raw` is excluded — raw plus wholesale reassignment is a correct pattern) whose TS-unwrapped argument is `new X(...)` (`NewExpression`, callee a bare Identifier) with `X` in {`Map`, `Set`, `Date`, `URL`, `URLSearchParams`} (any constructor arguments allowed, e.g. `new Map(entries)`). Renamed/shadowed globals are not resolved — a local class named `Map` would be a false positive in theory; accepted as negligible (shadowing a global builtin name at module level is vanishingly rare and the finding still points at confusing code).
2. **Type-specific mutation observed** (shadow-aware, over the instance program AND the template fragment — inline handlers mutate in templates):
   - Mutating METHOD call on the binding (`b.<m>(...)`, non-computed callee), where `<m>` is in the type's mutation set:
     - `Map`: `set`, `delete`, `clear`
     - `Set`: `add`, `delete`, `clear`
     - `Date`: `setTime`, `setFullYear`, `setMonth`, `setDate`, `setHours`, `setMinutes`, `setSeconds`, `setMilliseconds`, and the `setUTC*` variants
     - `URLSearchParams`: `append`, `set`, `delete`, `sort`
     - `URL`: (no mutating methods — property writes only)
   - OR a member assignment / member `delete` / member `UpdateExpression` rooted at the binding (`url.href = …`, `url.searchParams.append` resolves via root — note `u.searchParams.append(...)` on a `URL` binding is a mutating call whose `rootObjectName` is the binding: treat any DEEP method call `b.<path>.<m>(...)` as a mutation only when the FINAL method is in the URLSearchParams mutation set or the access path includes `searchParams`; simpler v1 rule: for `URL` bindings, any member assignment or any method call at depth ≥ 2 rooted at the binding counts as mutation — precise enough because `URL` has no legitimate deep read-methods that common code calls besides `searchParams` accessors (`get`/`has` — those are reads!). DECISION: to stay precision-first, deep calls count only when the final method name is in the URLSearchParams mutation set; deep read methods (`get`, `has`, `getAll`, `toString`) never count.)

Line recorded: the declarator's line. Reassign-only, read-only, and escape-only usage is NOT flagged (escapes are a documented false-negative direction: code receiving the instance may mutate it out of our sight).

### Machinery

A dedicated small scanner (walkScoped-based, like `collectStateWrites`'s shape) parameterized by a `Map<name, type>` of candidates, with the per-type mutation tables as module constants. The existing `MUTATING_METHODS` list (prop-mutation's array-flavored set) is NOT reused — its contents differ (array methods; `sort` means mutation there but is also in URLSearchParams' set); a separate `BUILTIN_MUTATIONS: Record<type, Set<string>>` keeps the semantics honest.

### Not detected (summary)

Reassign-only usage; read-only usage; escapes (call arguments, component props, directives — documented FN); `$state.raw(new X(...))`; `$derived(new X(...))` and non-`$state` constructions; nested-function-local `$state`; runes-module (`.svelte.ts`) and class-field `$state` (v1 scope, consistent with `state-raw`); locally shadowed re-uses of the binding name.

## Interplay

- `performance/state-raw` excludes non-literal `$state` arguments, so the two rules never fire on the same binding.
- `correctness/unmutated-state`: a mutated built-in is written/escaped by its union (method call = mutate kind), so it is never constable — disjoint.

## Registration, docs, changeset

- Four standard registration places (grep for `correctnessNonreactiveBuiltinState`, 5 hits).
- Docs: `docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md` + ja mirror (natural Japanese per docs/ja conventions). Limitations: escape FN; the shadowed-global-class caveat; runes-module/class-field scope.
- Changeset: minor × core / cli / vite / mcp.
- Rides the component channel — no producer changes.

## Testing

- **Parse unit**: `$state(new Map())` + `m.set(...)` in a handler → recorded with type `Map`; same for `Set.add`, `Date.setHours`, `URLSearchParams.append`, and `URL` via `u.href = ...` and `u.searchParams.set(...)`; `new Map(entries)` with args → recorded when mutated; template inline-handler mutation counts; reassign-only `$state(new Date())` → NOT recorded; read-only (`m.get`/`m.has`/`u.searchParams.get`) → not; escape-only (`register(m)`) → not; `$state.raw(new Map())` mutated → not; plain `const m = new Map()` (no `$state`) → not; shadowed local (`function f(m) { m.set(...) }`) → does not count as mutation of the outer binding; nested-function-local `$state` → not a candidate.
- **Rule unit**: message interpolation with the type name, line, severity `warning`, fix description present; empty facts → no results.
- Final review: adversarial probes against built dist with realistic components (lookup-table pattern, tag-set toggling, date picker, URL builder).
