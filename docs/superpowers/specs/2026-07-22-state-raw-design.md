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
- message (per binding): `"<name>" is an object/array $state that is only ever reassigned, never mutated — $state.raw gives the same behavior without the deep-proxy overhead.`
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

1. **Non-primitive literal initial value**: the `$state` argument (TS-unwrapped) is an `ObjectExpression` or `ArrayExpression` (including empty `{}` / `[]`). `$state.raw(...)` declarations are never candidates; non-literal arguments (`$state(new Map())`, `$state(load())`, identifiers) are skipped — Map/Set and unknown values have different reactivity stories.
2. **Reassigned at least once**: a whole-binding write — assignment to the identifier or a destructuring-assignment target — anywhere in the instance program or template. This makes the rule structurally disjoint from `correctness/unmutated-state` (which requires NO writes/escapes at all).
3. **Never mutated**: no member/element assignment, `delete`, member `UpdateExpression`, or method call on the binding.
4. **Never escaped**: not passed as a call argument, not `bind:`-bound (v1 treats even a whole-binding `bind:` as disqualifying — conservative; a bound member is mutation anyway), not passed as a component prop.

Line recorded: the declarator's line.

### Machinery — classify, don't duplicate

`collectStateWrites` currently reports one undifferentiated "written or escaped" set. Rather than a parallel scanner (the `unwrapTs`-duplication lesson), it is refactored to classify internally: each detection site maps to a kind — `reassign` (identifier assignment, destructuring target), `mutate` (member/element assignment, `delete`, member update, method call), `escape` (call argument) — and the function exposes both the union (existing contract) and the per-kind sets (new consumers). `collectTemplateEscapes` contributes `escape` (its component-prop pass) — with the `bind:` case kept as `escape` in v1. The two existing consumers (`constableStates` disqualification, `stalePropDerivations` disqualification) keep receiving the union — behavior byte-identical, guarded by the existing suites.

Whole-binding `UpdateExpression` (`x++`) on an object binding is nonsensical and rare; it classifies as `mutate` via the existing rootObjectName path when the argument is a member, and as `reassign` when the argument is the bare identifier (numeric coercion reassignment — disqualified anyway by condition 1 rarely mattering; the classification is stated for determinism, not user impact).

### Not detected (summary)

Primitive or non-literal initializers; existing `$state.raw`; never-written bindings (`unmutated-state`'s domain); mutated or escaped bindings; runes-module (`.svelte.ts`) module-level `$state` and class-field `$state` (v1 out of scope, noted in the doc page as future work); `<script module>` declarations.

## Interplay

- `correctness/unmutated-state`: disjoint by construction (requires zero writes; this rule requires ≥1 reassignment). Its recommendation already mentions `$state.raw` for the never-written case.
- `correctness/stale-prop-derivation`: no interaction — that rule's candidates are non-rune initializers by construction.

## Registration, docs, changeset

- Four standard registration places (grep for `performanceStateRaw`, 5 hits).
- Docs: `docs/src/content/docs/rules/performance/state-raw.md` + ja mirror (ja page written in natural Japanese per the docs/ja conventions — full-width parentheses, 「なぜ重要か」 heading, active voice). Limitations: the literal-initializer proxy for "large", the conservative escape handling (including whole-binding `bind:`), and the runes-module/class-field v1 scope.
- Changeset: minor for core / cli / vite / mcp.
- Rides the component channel — no producer changes.

## Testing

- **Parse unit**: reassigned-only object literal → recorded; reassigned-only array literal (incl. `[]`) → recorded; never-written → NOT recorded (and still lands in `constableStates` — pin both facts on one fixture to prove disjointness); mutated (`obj.a = 1`, `arr.push(x)`, `delete obj.k`, `obj.n++`) → not recorded; escaped (call arg, component prop, `bind:`) → not recorded; `$state.raw` already → not recorded; `$state(new Map())` / `$state(fn())` / `$state(0)` → not recorded; template-side reassignment (inline handler `list = [...list, x]`) counts as the qualifying reassign; shadowed local of the same name does not disqualify.
- **Regression**: full core suite must pass with the `collectStateWrites` refactor — the union contract is pinned by the existing unmutated-state and stale-prop tests.
- **Rule unit**: message interpolation, line, severity `info`, fix description present; empty facts → no results.
- Final review: adversarial probes against built dist with realistic components (API-response pattern, optimistic-update lists, form snapshots).
