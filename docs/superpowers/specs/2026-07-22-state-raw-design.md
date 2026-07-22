# performance/state-raw: reassign-only object $state → $state.raw — Design

Date: 2026-07-22
Status: Approved

## Problem

Svelte's best-practices doc (`documentation/docs/07-misc/01-best-practices.md`, "$state") advises: objects and arrays in `$state`are made deeply reactive via proxying, which has overhead; "In cases where you're dealing with large objects that are only ever reassigned (rather than mutated), use`$state.raw` instead. This is often the case with API responses, for example." Nothing surfaces this: the deep proxy silently taxes every property access on state that never needed it.

Sourced from the Svelte best-practices survey (2026-07-22) — candidate C of three, the last (B: each-index-key and A: stale-prop-derivation shipped).

## Rule

- **Id / title**: `performance/state-raw` / `Raw state opportunity`
- **Category / severity / scope**: `performance` / `info` (suggestion-natured, same policy as `performance/sequential-awaits`) / component
- **Shape**: `componentRule` factory, file `packages/core/src/rules/perf/state-raw.ts`; label `Deep reactivity only where mutated`
- message (per binding): `"<name>" is an object/array $state that is only ever reassigned, never mutated — $state.raw skips the deep-proxy overhead (reassignment stays reactive).`
- recommendation: `Declare it with $state.raw(...) — reassignment stays reactive; only property-level mutation needs the deep proxy.`
- rationale: quotes the official guidance (reassign-only large objects — API responses being the canonical case — belong in `$state.raw`); notes that "large" is not statically knowable, so a non-primitive literal initializer is the proxy condition, documented as such.
- fix: description `Replace $state(...) with $state.raw(...); keep the same initializer.` (description-only — no generic snippet, per the PR #267 review learning).

## Fact

`ComponentFacts` gains a channel-conventional non-optional list; `emptyComponentFacts` and `parseModuleFacts` gain the empty default:

```ts
/** Object/array-literal $state bindings that are reassigned at least once but never mutated or escaped — $state.raw candidates (performance/state-raw). */
rawableStates: {
  name: string;
  line: number;
}
[];
```

## Detection (component-parse)

An instance-script top-level `$state(...)` declarator (Identifier binding) is recorded when ALL hold:

1. **Non-primitive literal initial value**: the `$state` argument (TS-unwrapped) is an `ObjectExpression` or `ArrayExpression` (including empty `{}` / `[]`). `$state.raw(...)` declarations are never candidates — note `isStateDeclaration` does NOT distinguish `.raw` (it feeds `stateNames` for other rules and must stay raw-inclusive), so candidate collection uses a dedicated plain-`$state` predicate (callee is the bare Identifier `$state`); non-literal arguments (`$state(new Map())`, `$state(load())`, identifiers) are skipped — Map/Set and unknown values have different reactivity stories.
2. **Reassigned at least once**: a whole-binding write — assignment to the identifier or a destructuring-assignment target — anywhere in the instance program or template. This makes the rule structurally disjoint from `correctness/unmutated-state` (which requires NO writes/escapes at all).
3. **Never mutated**: no member/element assignment, `delete`, member `UpdateExpression`, or method call on the binding.
4. **Never escaped**: not passed as a call argument, not `bind:`-bound (v1 treats even a whole-binding `bind:` as disqualifying — conservative; a bound member is mutation anyway), not passed as a component prop, and — closing the aliasing hole — no bare script-side reference OUTSIDE the candidate's own reassignments: a reference in a declarator initializer (`const inner = obj.items`), in the RHS of an assignment to a DIFFERENT target, in a `return`, or anywhere else in the instance program that is not the LHS or RHS of an assignment to the candidate itself, classifies as `escape`. The immutable-update idiom `list = [...list, x]` stays a qualifying reassign (the RHS reference belongs to the candidate's own reassignment). Template READS (`{obj.title}`, `{#each list as item}`) do not escape.
5. **Each-context taint**: for `{#each candidate as item}` blocks over the candidate, the context binding (and index) is tracked within the block (shadow-aware): any mutation, `bind:`, method call, call-argument escape, or component-prop pass of the context name disqualifies the candidate — an editable/optimistic list (`bind:value={item.text}`, `<Row {item} />`) must NOT be told to go raw, because item-level edits stop being reactive under `$state.raw`.

Line recorded: the declarator's line.

### Machinery — classify, don't duplicate

`collectStateWrites` currently reports one undifferentiated "written or escaped" set. Rather than a parallel scanner (the `unwrapTs`-duplication lesson), it is refactored to classify internally: each detection site maps to a kind — `reassign` (identifier assignment, destructuring target), `mutate` (member/element assignment, `delete`, member update, method call), `escape` (call argument) — and the function exposes both the union (existing contract) and the per-kind sets (new consumers). `collectTemplateEscapes` contributes `escape` (its component-prop pass) — with the `bind:` case kept as `escape` in v1. The two existing consumers (`constableStates` disqualification, `stalePropDerivations` disqualification) keep receiving the union — behavior byte-identical, guarded by the existing suites.

Two additional collectors are new-rule-only (they do NOT feed the union): a script-side bare-reference scan implementing condition 4's aliasing clause (shadow-aware; skips references inside the candidate's own `$state(...)` declarator and its own-reassignment LHS/RHS), and the each-context taint of condition 5 over the fragment.

Whole-binding `UpdateExpression` (`x++`) on an object binding is nonsensical and rare; it classifies as `mutate` via the existing rootObjectName path when the argument is a member, and as `reassign` when the argument is the bare identifier (numeric coercion reassignment — disqualified anyway by condition 1 rarely mattering; the classification is stated for determinism, not user impact).

### Not detected (summary)

Primitive or non-literal initializers; existing `$state.raw`; never-written bindings (`unmutated-state`'s domain); mutated or escaped bindings; runes-module (`.svelte.ts`) module-level `$state` and class-field `$state` (v1 out of scope, noted in the doc page as future work); `<script module>` declarations.

## Interplay

- `correctness/unmutated-state`: disjoint by construction (requires zero writes; this rule requires ≥1 reassignment). Its recommendation already mentions `$state.raw` for the never-written case.
- `correctness/stale-prop-derivation`: no interaction — that rule's candidates are non-rune initializers by construction.

## Registration, docs, changeset

- Four standard registration places (grep for `performanceStateRaw`, 5 hits).
- Docs: `docs/src/content/docs/rules/performance/state-raw.md` + ja mirror (ja page written in natural Japanese per the docs/ja conventions — full-width parentheses, 「なぜ重要か」 heading, active voice). Limitations: the literal-initializer proxy for "large" (which also excludes the `$state(null)`-then-assign API-response idiom — only literal-initialized bindings are candidates); the conservative escape handling (whole-binding `bind:`, any script-side aliasing reference); deep aliases reached without naming the binding (`const x = someAlias.b`) are out of static reach — a residual caveat stated on the page; and the runes-module/class-field v1 scope.
- Changeset: minor for core / cli / vite / mcp.
- Rides the component channel — no producer changes.

## Testing

- **Parse unit**: reassigned-only object literal → recorded; reassigned-only array literal (incl. `[]`) → recorded; never-written → NOT recorded (and still lands in `constableStates` — pin both facts on one fixture to prove disjointness); mutated (`obj.a = 1`, `arr.push(x)`, `delete obj.k`, `obj.n++`) → not recorded; escaped (call arg, component prop, `bind:`) → not recorded; `$state.raw` already → not recorded; `$state(new Map())` / `$state(fn())` / `$state(0)` → not recorded; template-side reassignment (inline handler `list = [...list, x]`) counts as the qualifying reassign; script-side `list = [...list, x]` also qualifies (own-RHS reference is not an escape); aliasing disqualifies (`const inner = obj.items;`, `other = obj;`, `return obj;` in a helper is out of scope — helpers are functions, but a top-level `const copy = obj` is in scope); each-context taint disqualifies (`{#each list as item}` + `bind:value={item.text}`, and + `<Row {item} />`), while a read-only each body (`{#each list as item}<li>{item.name}</li>`) does not; shadowed local of the same name does not disqualify. The disjointness fixture must use plain `$state` (not `.raw`), since `constableStates` admits `.raw` declarations via `isStateDeclaration`.
- **Regression**: full core suite must pass with the `collectStateWrites` refactor — the union contract is pinned by the existing unmutated-state and stale-prop tests.
- **Rule unit**: message interpolation, line, severity `info`, fix description present; empty facts → no results.
- Final review: adversarial probes against built dist with realistic components (API-response pattern, optimistic-update lists, form snapshots).
