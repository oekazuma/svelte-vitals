# CORRECT003 — `$effect` used as `onMount`

**Date:** 2026-07-02
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (rule + effect analysis), `@svelte-vitals/cli` (capture), `@svelte-vitals/mcp` (surfaces the rule)

## Goal

Add **CORRECT003**, the "More Correctness/reactivity" slice of #69. Flag an
`$effect` / `$effect.pre` whose body reads **no reactive value** — such an effect
runs once after mount and never re-runs, so it is really an `onMount` and the
`$effect` obscures intent. `warning` severity, matching CORRECT002.

Distinct from CORRECT002 (an `$effect` that only _assigns_ `$state` → use
`$derived`): CORRECT003 is an `$effect` that neither reads nor derives reactive
state → use `onMount`.

## Background / current state

- `ComponentFacts.effects: EffectFact[]` where `EffectFact = { line: number;
assignsOnlyState: boolean }` (CORRECT002 uses `assignsOnlyState`).
- `packages/cli/src/providers/source/parse.ts` collects effects: it tracks
  `stateNames` (via `isStateDeclaration`, `$state` only), detects effect calls
  (`isEffectCall` → `$effect`/`$effect.pre`), and computes `assignsOnlyState`
  via `bodyOnlyAssignsState`. `$derived` / `$props` / store subscriptions are
  **not** currently tracked.
- Rules live in `packages/core/src/rules/correctness/correct001-002.ts`, built
  with the `componentRule` factory (CLI/static only; no-ops in rendered mode).

## Design

### 1. What counts as "reads a reactive value" (conservative — no false positives)

An `$effect` body is treated as reading a reactive value (so it is **not**
flagged) when it contains **any** of:

1. **A reference to a reactive name** — an identifier bound to `$state` /
   `$state.raw` / `$derived` / `$derived.by`, or a name introduced by `$props()`
   (each destructured property name, or the single binding when
   `let props = $props()`).
2. **A store auto-subscription** — an identifier whose name starts with `$` and
   is not a rune (`$state`, `$derived`, `$effect`, `$props`, `$bindable`,
   `$inspect`, `$host`). (`$count` reads store `count`.)
3. **A bare-identifier call** — a `CallExpression` whose callee is a plain
   identifier, e.g. `foo()`. A local or imported function may read reactive
   state internally, so it is conservatively treated as a reactive read.
   Member calls (`el.focus()`, `window.scrollTo()`, `console.log('x')`) are
   **not** suppressive on their own — but a reactive name passed as an argument
   is caught by rule 1.

An effect is a **mount-only candidate** (flagged) when its body is **non-empty**
and matches **none** of the three. An empty body (`$effect(() => {})`) is not
flagged — recommending `onMount` for it is nonsensical; it is a different (rare)
smell out of scope here.

Examples:

```js
$effect(() => {
  el.focus();
}); // flag — member call, no reactive read
$effect(() => analytics.pageView()); // flag — member call
$effect(() => {
  document.title = 'Home';
}); // flag — static assignment
$effect(() => {
  count;
}); // ok — reactive name ($state)
$effect(() => localHelper()); // ok — bare call (may read state)
$effect(() => console.log($store)); // ok — store subscription
$effect(() => {}); // ok — empty body, not flagged
```

Shadowing (a local `const count` inside the effect that collides with a reactive
name) is resolved conservatively: the identifier still counts as a reactive read,
so the effect is not flagged (a false negative, never a false positive).

### 2. Capture model — `EffectFact.mountOnly`

Add a computed intent boolean to `EffectFact` (mirroring `assignsOnlyState`):

```ts
/** True when this $effect has a NON-EMPTY body that reads no reactive value and makes no bare call — it never re-runs, so it should be onMount (CORRECT003). */
mountOnly: boolean;
```

`parse.ts` changes:

- Collect a `reactiveNames: Set<string>` alongside the existing `stateNames`
  scan: add names from `$derived` / `$derived.by` declarations and from
  `$props()` (destructured property names, or the plain binding identifier).
  `stateNames` already covers `$state`; `reactiveNames` is the union.
- Add a helper `bodyReadsReactive(fn, reactiveNames): boolean` that walks the
  effect callback body and returns true on the first of: an identifier in
  `reactiveNames`; a `$`-prefixed non-rune identifier; a bare-identifier
  `CallExpression`.
- Add a helper `bodyIsEmpty(fn): boolean` (empty `BlockStatement`, or no body).
- For each effect: `mountOnly = !bodyIsEmpty(fn) && !bodyReadsReactive(fn, reactiveNames)`.

`assignsOnlyState` is unchanged. Both booleans are independent facts on the same
`EffectFact`.

### 3. Rule — CORRECT003

Add to `packages/core/src/rules/correctness/correct001-002.ts` (alongside
CORRECT001/002), built with `componentRule`:

- `id: 'CORRECT003'`, `title: 'Effect used as onMount'`,
  `category: 'correctness'`, `severity: 'warning'`, `scope: 'component'`.
- `label` (PASS): `'$effect usage'`.
- `recommendation`: `"Move mount-time side effects to onMount (import { onMount } from 'svelte'); reserve $effect for logic that reacts to $state/$derived/$props."`
- `rationale`: `'An $effect that reads no reactive value runs once after mount and never re-runs — it is an onMount in disguise, which obscures intent and misuses the reactivity system.'`
- `applies`: `(c) => c.effects.length > 0`.
- `bad`: `(c) => c.effects.filter((e) => e.mountOnly).map((e) => ({ line: e.line, message: '$effect reads no reactive value — use onMount instead' }))`.

Both `$effect` and `$effect.pre` are covered (existing `isEffectCall` already
matches both).

### 4. Registration & surfaces

- Export `correct003EffectAsOnMount` from `correct001-002.ts`, import + append to
  `allRules`, and add to the re-export blocks in `packages/core/src/rules/index.ts`
  and `packages/core/src/index.ts` (after `correct002EffectDerived`).
- MCP `analyze` / `explain_rule` surface it automatically via `allRules`.

### 5. Docs

Two reference pages following the CORRECT002 format (title; `**Severity:**
warning · **Category:** correctness`; What it checks / Why it matters / How to
fix):

- `docs/src/content/docs/rules/correct003.md`
- `docs/src/content/docs/ja/rules/correct003.md`

### 6. Changeset

`@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/mcp` — **minor** (mirrors
PERF010; the rule is CLI/static-only and no-ops in rendered mode, so not
`@svelte-vitals/vite`).

## Testing

- **Capture** (`packages/cli` `parse-component-facts` tests): `mountOnly` is
  `true` for a member-call-only body (`el.focus()`), a static assignment
  (`document.title = 'x'`); `false` for a body that reads a `$state`/`$derived`/
  `$props` name, reads a `$store`, makes a bare call (`helper()`), or is empty
  (`() => {}`); `$effect.pre` is covered. Existing `toEqual` assertions on
  `EffectFact` gain `mountOnly` with the correct value; existing EffectFact
  literals in tests gain `mountOnly`.
- **Rule** (`packages/core` `correctness-rules` tests): a component with a
  mount-only effect fails; a component whose effect reads reactive passes; a
  component with no effects is no-signal (`applies` false).
- Full suite + typecheck + lint + `docs build` green; no assertions loosened.

## Out of scope (YAGNI)

- Transitive reactive analysis of local functions — bare calls are uniformly
  suppressed instead (conservative).
- Reactive sources beyond `$state`/`$derived`/`$props`/stores.
- Merging with CORRECT002's derive-smell detection (distinct signal).

## 2026-08-09 addendum

The "conservative — no false positives" claim in §1 was refuted by the 2026-08-09 v1.0
rule-validity review (`docs/superpowers/specs/2026-08-09-v1-rule-validity-review.md`,
Priority 1 #1): `reactiveNames` only ever held same-file rune declarators, so a member read on
a class instance (`new Counter()`, `$state` fields), a `SvelteMap`/`SvelteSet`, an imported
runes-module state object, or `svelte/reactivity/window` was indistinguishable from the true
positive — all four yielded `mountOnly: true`, and the rule's advice to switch to `onMount`
would have frozen working reactive code. Fixed by narrowing detection: `bodyReadsReactive` now
also treats a member read on any imported binding or any local initialized with `new …()` as
reactive (`collectImportedLocalNames`/`collectNewExprLocalNames` in `component-parse.ts`),
folded into the same `reactiveNames` set. This is strictly narrower — it only ever suppresses a
finding, never adds one — and does not close the remaining gap: a reactive value reached only
through a plain function's return value still has no traceable name and can still be flagged
(documented as a known limitation in the rule's docs page instead of silently claimed away).
