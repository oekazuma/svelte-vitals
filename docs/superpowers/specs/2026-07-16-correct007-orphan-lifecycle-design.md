# CORRECT007 — Lifecycle call outside component initialisation

**Date:** 2026-07-16
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (facts + rule), `svelte-vitals` / `@svelte-vitals/vite` / `@svelte-vitals/mcp` (surface automatically)

## Goal

Add **CORRECT007**: flag calls to Svelte lifecycle/context functions that are
guaranteed to run outside component initialisation and therefore throw the
runtime `lifecycle_outside_component` error — the sibling crash class of
CORRECT006's `effect_orphan`. Two surfaces:

- **Runes modules / `<script module>`** — `onMount(...)` etc. at module
  evaluation time, or in the constructor of a module-scope-instantiated class
  (the CORRECT006 twin patterns).
- **Kit route/hooks files** — the same calls at top level, inside
  load/action/endpoint handlers, or inside the `init` startup hook. The
  highest-frequency real-world instance of this class is **`getContext` inside
  `load`** — a documented beginner trap.

`critical` severity (CORRECT006 precedent: compile-clean, runtime-only,
production 500), `category: 'correctness'`, `scope: 'component'`.

## Background (verified 2026-07-16 against svelte 5.56.4 source)

Functions that throw `lifecycle_outside_component` when `component_context`
is null, from the `svelte` package:

- `src/index-client.js`: `onMount`, `onDestroy`, `beforeUpdate`,
  `afterUpdate`, `createEventDispatcher`
- `src/internal/{client,server}/context.js` (`get_or_init_context_map`):
  `getContext`, `setContext`, `hasContext`, `getAllContexts`

Explicitly NOT flagged: `createContext()` — calling it at module scope is the
official pattern of the new context API (only its returned get/set need init
context, which is not statically trackable); `mount`/`hydrate`/`tick`/
`untrack`/`flushSync` — no context requirement; `svelte/legacy`'s
`createBubbler` — legacy-only, out of scope v1.

These are plain imported function calls: the compiler performs no placement
validation, svelte-check and eslint-plugin-svelte have no rule, and the
failure is runtime-only. Same product justification as CORRECT006 (rule
criterion: caught before deploy, hurts users in production).

## Design

### Approach decision

**A (chosen): generalise CORRECT006's collector, one rule reading both
channels.** The `$effect` detectors in `component-parse.ts` are parameterised
by a callee-matcher; `orphanEffects` becomes the `$effect` instantiation with
byte-identical behavior (existing CORRECT006 tests are the regression bar),
and a new fact family feeds CORRECT007. Rejected: B — separate rules per
channel (one failure class split across two ids complicates docs and
suppression); C — piggybacking on `OrphanEffectFact` with new kinds (muddies
CORRECT006's fact semantics and makes per-rule suppression ambiguous).

### 1. Tracked callees (canonical names)

`LIFECYCLE_NAMES = { onMount, onDestroy, beforeUpdate, afterUpdate,
createEventDispatcher, getContext, setContext, hasContext, getAllContexts }`

Tracked only when **value-imported from `'svelte'`**: named specifiers (alias
`import { onMount as om }` → calls to `om(...)` recorded under the canonical
name `onMount`) and namespace imports (`import * as s from 'svelte'` →
`s.onMount(...)`, property must be in the set). `import type` and type-only
specifiers excluded. A same-named function imported from any other module is
never flagged.

### 2. Module surface — `ComponentFacts.orphanLifecycleCalls`

```ts
/** A svelte lifecycle/context call guaranteed to run outside component initialisation — throws lifecycle_outside_component at runtime (CORRECT007). */
orphanLifecycleCalls: {
  /** Canonical svelte export name (alias-resolved), e.g. 'onMount'. */
  name: string;
  line: number;
  kind: 'top-level' | 'constructor-instantiated';
  className?: string;
}[];
```

Analysed sources and patterns mirror CORRECT006 exactly:

- the whole program of `.svelte.ts`/`.svelte.js` files and the
  `<script module>` block of `.svelte` files (instance scripts are component
  init — legal);
- pattern 1: direct calls at module evaluation (top-level statements,
  incl. top-level blocks/`if`; never crossing a function boundary);
- pattern 2: a module-scope `new` (top-level statements only,
  export-unwrapped) of a same-file top-level `ClassDeclaration` whose
  constructor body directly calls a tracked function; reported at the `new`
  site with the class name.

Implementation: `collectEvalScopeEffectLines` / `collectOrphanEffects`
generalise to matcher-parameterised collectors (`(node) => canonicalName |
undefined`); the `$effect` matcher keeps the `$effect.root` child-skip;
the lifecycle matcher has no root-exemption. `orphanEffects` output is
unchanged.

### 3. Kit surface — `KitModuleFacts.lifecycleCalls`

```ts
/** A svelte lifecycle/context call in a Kit route/hooks file that runs outside component initialisation (CORRECT007). */
lifecycleCalls: {
  name: string;
  line: number;
  inHandler: boolean;
}
[];
```

Same import tracking added to `parseKitModuleFacts`. Flagged positions:

- **top level** (module evaluation — crashes at import; `inHandler: false`);
- **inside handler bodies** (load/actions/HTTP methods/hooks handlers —
  crashes per request; `inHandler: true`; this is `getContext` in `load`);
- **inside the `init` startup hook** (crashes at boot; `inHandler: false`).

NOT flagged: calls inside non-handler/non-`init` functions — a helper defined
in a Kit file may legally be called from a component during init
(conservative, same stance as CORRECT006's function-boundary rule).
Class-constructor patterns inside Kit files are out of scope v1 (rare).

### 4. Rule — CORRECT007

`packages/core/src/rules/correctness/correct007-orphan-lifecycle.ts` —
custom `check(ctx)` (both channels; neither `componentRule` nor
`kitModuleRule` alone fits), reusing each channel's suppression semantics and
emitting the same PASS/PENALIZED shapes with the file as the scoring unit.
Rendered mode (both channels unset) emits nothing.

- `id: 'CORRECT007'`, `title: 'Lifecycle call outside component initialisation'`,
  `category: 'correctness'`, `severity: 'critical'`, `scope: 'component'`.
- Messages (`name` = canonical):
  - module top-level: `` `${name}() runs at module evaluation, outside component initialisation — it throws lifecycle_outside_component at runtime` ``
  - constructor-instantiated: `` `class "${className}" calls ${name}() in its constructor and is instantiated at module scope — it throws lifecycle_outside_component at runtime` ``
  - kit, `inHandler`: `` `${name}() is called in a load/handler — it runs on every request, outside component initialisation, and throws lifecycle_outside_component at runtime` ``
  - kit, top-level/`init`: `` `${name}() runs at module evaluation, outside component initialisation — it throws lifecycle_outside_component at runtime` `` (same as module top-level)
- `recommendation`: `"Call lifecycle/context functions during component initialisation (the top level of a component's <script>). In load, return the data and call setContext in a layout/page component; in shared modules, expose a setup function that components call during init."`
- `rationale`: `'Svelte lifecycle and context functions require an active component context; called at module scope, in a shared-state class constructor, or in a load/handler they throw lifecycle_outside_component at runtime — the compiler does not catch it, and it surfaces as a production crash.'`

### 5. Registration, docs, changeset

- The usual four registration sites + grep check.
- Docs: `docs/src/content/docs/rules/correct007.md` + ja mirror; CLI-guide
  suppression range (en/ja) `CORRECT001–006` → `CORRECT001–007`.
- Changeset: core / svelte-vitals / vite / mcp — **minor**.

## Testing

- **Module parse**: top-level detection for representative callees + a loop
  over all nine; alias records the canonical name; namespace-member call;
  constructor + module-scope `new` (class name + `new`-site line);
  `<script module>` positive / instance-script negative; NOT flagged: calls
  inside functions, `createContext()`, `mount`/`tick`, same-named import from
  another package, `import type`.
- **Kit parse**: `getContext` inside `load` → `inHandler: true`; top-level →
  `false`; inside `init` → `false`; NOT flagged: helper function, exported
  `use*` function.
- **Rule**: all message variants; severity critical; both channels in one
  run; suppression on each channel; rendered-mode no-op.
- **Regression bar**: every existing `orphanEffects` (CORRECT006) test passes
  unchanged through the generalised collectors.
- Root `pnpm build` / `typecheck` / `test` / `lint` green.

## Known limitations / out of scope (v1, documented in the rule docs)

- **Deferred calls inside components** (`onMount` in `setTimeout`/event
  handlers) — needs call-graph analysis; declined at design time.
- **Factory functions, IIFEs, cross-file classes** — same conservative misses
  as CORRECT006.
- **Wrapper re-exports** (`export { onMount } from 'svelte'` consumed via
  another module) — not tracked.
- **`svelte/legacy` (`createBubbler`)** — not tracked.
- **Class-constructor patterns inside Kit files** — not tracked (module
  surface covers the shared-state-class shape).
- **Functions nested inside a handler/`init` body inherit the flag.** A
  closure defined inside `load`/a handler/`init` and merely _returned_ for
  later use (e.g. `export function load() { return { getUser: () =>
getContext('user') }; }`) is flagged even though, if invoked from
  component initialisation rather than from within the handler, the call
  would be legal — a false positive in principle. Accepted because the
  invoked-within-handler case (a nested helper actually called during the
  request) dominates and is a genuine crash; suppress inline
  (`svelte-vitals-disable-next-line CORRECT007`) when the closure is
  deliberately returned for component-side use (finding from the final
  branch review).
