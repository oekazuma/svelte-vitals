# CORRECT006 — Orphan `$effect` (effect runs outside component initialisation)

**Date:** 2026-07-15
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (rule + module analysis), `svelte-vitals` (CLI, surfaces the rule), `@svelte-vitals/vite`, `@svelte-vitals/mcp`

## Goal

Add **CORRECT006**: flag `$effect` / `$effect.pre` calls that are guaranteed to
run outside component initialisation and therefore throw Svelte's
`effect_orphan` error at runtime. The canonical trap: a shared-state class in a
`.svelte.ts` module calls `$effect` in its constructor and is instantiated at
module scope — it compiles fine, often goes unnoticed in dev, and 500s in
production.

`critical` severity — the first `critical` in the correctness category. Unlike
CORRECT001–005 (style/intent smells), this is a guaranteed production crash, so
failing CI (exit code 1) is the correct default behaviour.

This also introduces the first analysis of `.svelte.ts` / `.svelte.js` module
files, folded into the existing component-facts pipeline (approach A below) so
every surface (CLI, vite plugin, MCP) picks it up with zero extra wiring.

## Background / current state (verified 2026-07-15)

- **The Svelte compiler does not catch this.** Verified against svelte 5.56.4
  with `compileModule` and `compile`: a top-level `$effect` in a `.svelte.ts`
  module, a bare `$effect` in a class constructor instantiated at module scope,
  and a top-level `$effect` in a `.svelte` `<script module>` all compile
  without error and only fail at runtime (`effect_orphan`).
- **eslint-plugin-svelte has no equivalent rule.** Checked the published rule
  list; its runes rules (`prefer-writable-derived`, `no-unnecessary-state-wrap`,
  …) are optimisation smells, none detect orphan effects. No overlap with
  official tooling.
- **`.svelte.ts` / `.svelte.js` files are currently collected nowhere.**
  `collectComponentFacts` (`packages/core/src/component-collect.ts`) globs
  `src/**/*.svelte` only; the CLI's import resolver
  (`packages/cli/src/providers/source/resolve.ts`) explicitly returns
  `undefined` for non-`.svelte` extensions.
- Effect facts today: `parseComponentFacts`
  (`packages/core/src/component-parse.ts`) walks **only**
  `ast.instance.content` for `EffectFact`s (CORRECT002/003). `ast.module.content`
  is walked for imports only — module-context effects are invisible.
- Rules are built with the `componentRule` factory
  (`packages/core/src/rules/component-rule.ts`), which iterates
  `ctx.components`, honours inline suppressions, and emits PASS/PENALIZED
  results. CLI, vite (`packages/vite/src/analyze.ts`), and MCP all consume
  `allRules` + `collectComponentFacts`, so a new component-scoped rule and any
  new facts flow to all surfaces automatically.

## Design

### Approach decision

Considered three options; **A chosen**:

- **A (chosen): fold module files into `ComponentFacts`.** Extend the collector
  glob to include `src/**/*.svelte.{ts,js}`, branch the parser by extension,
  and put orphan facts on `ComponentFacts`. Zero new plumbing, `componentRule`
  and suppressions work as-is, and the `.svelte` `<script module>` case needs a
  `ComponentFacts` extension anyway, so there is exactly one fact shape.
- B: a separate `ModuleFacts` + `RuleContext.modules`. Honest types, but more
  than double the wiring (context, CLI, vite provider) for one rule, and
  suppression handling would be duplicated. Revisit if module-level rules grow
  to ~3.
- C: a full generic module-analysis subsystem with `scope: 'module'`. YAGNI —
  this is the only confirmed module rule today.

### 1. Detection patterns (conservative — high confidence only)

Two patterns, both restricted to code that provably executes at module
evaluation time. The walk covers **top-level statements only** and never
crosses a function boundary.

1. **`top-level`** — a bare `$effect(...)` / `$effect.pre(...)` call appearing
   in a top-level statement (including inside top-level blocks and `if`
   branches). Calls lexically inside an `$effect.root(() => { ... })` callback
   are excluded. Calls inside any function/arrow/method body are excluded —
   `export function useThing() { $effect(...) }` is legal when called during
   component init.
2. **`constructor-instantiated`** — the article pattern, detected in two steps
   within a single file:
   - Step 1: collect names of class declarations/expressions whose
     **constructor body** contains a direct `$effect` / `$effect.pre` call not
     wrapped in `$effect.root` (nested function definitions inside the
     constructor are not entered).
   - Step 2: flag top-level `new ClassName(...)` statements
     (`const x = new X()`, `export const x = new X()`, bare `new X()`) whose
     class is in the step-1 set. The reported line is the **`new` site** —
     that is where the error is thrown at module evaluation, and the fix is
     either there or in the constructor.

Analysed sources:

- The whole program of `src/**/*.svelte.ts` and `src/**/*.svelte.js` files.
- The `<script module>` block (`ast.module.content`) of `.svelte` files.
- **Not** the instance script of `.svelte` files — that is component
  initialisation context, where `$effect` is legal.

### 2. Capture model — `OrphanEffectFact`

Add to `packages/core/src/component.ts`:

```ts
/** A $effect guaranteed to run outside component initialisation — throws effect_orphan at runtime (CORRECT006). */
export interface OrphanEffectFact {
  line: number;
  kind: 'top-level' | 'constructor-instantiated';
  /** Class name when kind is 'constructor-instantiated' (for the finding message). */
  className?: string;
}
```

`ComponentFacts` gains `orphanEffects: OrphanEffectFact[]`;
`emptyComponentFacts` gains the empty array.

### 3. Parsing — extension branch in `parseComponentFacts`

- **`.svelte`** — unchanged parse; additionally run the orphan walk over
  `ast.module.content` (previously used for imports only). Existing
  instance-script `EffectFact` collection is untouched.
- **`.svelte.ts` / `.svelte.js`** — wrap the source as
  `'<script lang="ts">\n' + source + '\n</script>'`, run the same
  `svelte/compiler` `parse()` (it handles TS in scripts natively), and treat
  `ast.instance.content` as the module Program, subtracting 1 from reported
  line numbers. All other facts (htmlTags, eachBlocks, …) stay empty. Zero new
  dependencies; existing helpers (`isEffectCall`, the ESTree walker, `lineOf`)
  are reused.
- First implementation step must verify the wrap trick against real-world
  module syntax (top-level await, `satisfies`, type-only imports). If the
  Svelte script parser rejects valid module code, fall back to adding a
  standalone JS/TS parser (acorn + TS plugin) — the fact shape and rule are
  unaffected by that swap.

### 4. Collection — glob extension

`collectComponentFacts` (`packages/core/src/component-collect.ts`) adds two
globs alongside the existing one — `src/**/*.svelte.ts` and
`src/**/*.svelte.js` (separate `rt.glob` calls, mirroring how
`project.ts` runs multiple globs). Read/parse failures keep the existing
fail-safe: `emptyComponentFacts`, never a throw.

### 5. Rule — CORRECT006

New file `packages/core/src/rules/correctness/correct006-orphan-effect.ts`,
built with `componentRule`:

- `id: 'CORRECT006'`, `title: 'Orphan $effect'`, `category: 'correctness'`,
  `severity: 'critical'`, `scope: 'component'`.
- `label` (PASS): `'$effect context'`.
- `recommendation`: `"Wrap the effect in $effect.root (and own the returned cleanup), or restructure so the effect is set up during component initialisation (e.g. call a setup method from a component)."`
- `rationale`: `'An $effect created outside component initialisation throws effect_orphan at runtime — the compiler does not catch it, and it typically surfaces as a production 500.'`
- `applies`: `(c) => c.orphanEffects.length > 0`.
- `bad`: maps each fact to a finding —
  - `top-level`: `` `$effect at module scope runs outside component initialisation — it throws effect_orphan at runtime` ``
  - `constructor-instantiated`: `` `class "${className}" runs $effect in its constructor and is instantiated at module scope — it throws effect_orphan at runtime` ``

Inline suppressions work via `componentRule`'s existing `isSuppressed`; the
implementation must confirm suppression-comment collection also runs for
module files (plain JS comments) and wire it up if the collector is
`.svelte`-specific today.

### 6. Registration & surfaces

Per AGENTS.md, four registration sites + docs: import + `allRules` +
re-export block in `packages/core/src/rules/index.ts`, the re-export list in
`packages/core/src/index.ts` (grep for `correct005` after adding to catch the
un-typechecked fourth site). CLI, vite, and MCP surface the rule automatically
via `allRules`; the new facts reach them automatically via the shared
`collectComponentFacts`.

### 7. Docs

Two reference pages following the CORRECT005 format (title; severity/category
line; What it checks / Why it matters / How to fix, with the module-class
example from the wild):

- `docs/src/content/docs/rules/correct006.md`
- `docs/src/content/docs/ja/rules/correct006.md`

`packages/cli/test/docs-links.test.ts` enforces both exist.

### 8. Changeset

`@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`,
`@svelte-vitals/mcp` — **minor**. Unlike CORRECT003 (pre-dating the vite
component-rules work), component rules now run in the vite plugin too, so vite
is included.

## Testing

- **Capture** (`packages/core` component-parse tests):
  - `top-level`: bare `$effect` and `$effect.pre` at module top level flagged;
    inside `$effect.root` callback not flagged; inside a function/arrow
    declaration not flagged; inside a top-level `if` block flagged.
  - `constructor-instantiated`: article pattern (class + module-scope `new`)
    flagged with class name and the `new`-site line; class with constructor
    `$effect` but **no** module-scope `new` not flagged; constructor effect
    wrapped in `$effect.root` not flagged.
  - `.svelte`: `<script module>` top-level `$effect` flagged; the same call in
    the instance script not flagged.
  - Line numbers correct after the −1 wrap offset; TS syntax (annotations,
    `satisfies`) parses.
- **Rule** (`packages/core` correctness-rules tests): facts map to critical
  findings with the right messages; empty `orphanEffects` → `applies` false;
  suppression comment silences the finding.
- **Collection**: a fixture project containing a `store.svelte.ts` shows the
  file is picked up end-to-end (CLI analyze).
- Full `pnpm build` / `typecheck` / `test` / `lint` green; docs build green.

## Known limitations / out of scope (v1, documented in the rule docs)

- **Cross-file detection** — a class defined in one file and instantiated at
  module scope in another. Needs import tracking; deferred.
- **Factory functions** — `export const s = createStore()` where `createStore`
  internally calls `$effect`. Same cross-boundary problem; deferred.
- **Top-level IIFEs** — an `$effect` inside a top-level IIFE does run at module
  evaluation, but v1 never crosses function boundaries; recorded as a future
  extension.
- **Bare constructor effects without a module-scope `new`** — legal when the
  class is instantiated inside a component; deliberately not flagged (false
  positive avoidance).
- **The `</script>` string-literal edge** — a module source containing the
  literal string `"</script>"` may break the wrap-based parse; it degrades to
  the existing fail-safe (empty facts, detection skipped, no crash). Rare in
  state modules; acceptable for v1.
