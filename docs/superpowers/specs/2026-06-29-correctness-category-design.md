# Correctness category — component-body static analysis (CORRECT001+)

**Date:** 2026-06-29
**Status:** Approved (1 PR foundation, per maintainer)
**Packages:** `@svelte-vitals/core` (category + rules), `@svelte-vitals/cli` (component scan), `@svelte-vitals/mcp` (surfaces via `allRules`)
**Direction:** "Svelte Doctor" — broaden svelte-vitals from SEO/Perf head-checks toward a
deterministic, agent-native code-health scanner. This is the first non-SEO/Perf category
and the first analysis of **component bodies** (not just `<head>`).

## Why

The goal is to catch "the bad code an AI agent writes" across correctness, security, and
architecture — not only SEO/Performance. Today svelte-vitals only inspects
`<svelte:head>` / `<img>` / headings. **Correctness/reactivity** is the signature category
and the foundation for the rest. We focus on high-precision checks the Svelte compiler /
`svelte-check` / `eslint-plugin-svelte` do **not** already enforce as health signals (no
duplication of official tooling).

## Architecture

### New category

Add `'correctness'` to `Category` (`packages/core/src/types.ts`). Scoring is data-driven:
`scoresByCategory` groups by `r.category`, so the new category flows into per-category and
combined Health scores with no scoring-code change.

### Component scan (CLI, source-only)

Correctness is a **source** analysis — the rendered (vite) provider can't see reactivity,
so these rules are CLI-only (they emit nothing when `ctx.components` is unset, like the
image rules pre-parity).

- New `collectComponentFacts(rt, cwd)`: globs `src/**/*.svelte`, parses each once with
  `svelte/compiler`, and emits `ComponentFacts` (below). Independent of route resolution —
  scans **every** component, including `$lib`.
- New context channel `ctx.components?: ComponentFacts[]` (`RuleContext`).
- Threaded from `cli/index.ts` only (rendered `analyze.ts` leaves it unset).

### Facts (`packages/core/src/component.ts`)

```ts
export interface EachBlockFact {
  hasKey: boolean;
  line: number;
}
export interface EffectFact {
  line: number;
  assignsOnlyState: boolean;
}
export interface ComponentFacts {
  file: string;
  eachBlocks: EachBlockFact[];
  effects: EffectFact[];
}
```

The CLI parser fills these: walk the template fragment for `EachBlock` (its `key` field),
and walk the instance `<script>` ESTree (`ast.instance.content`) for `$state` declarations
and `$effect(...)` calls.

### Findings = file units

Component findings set `route` **and** `location` to the source file path (+ `line`), so
the existing route-based scoring scores each file as a unit (count-sensitive). Real route
scores are unaffected (the SEO/Perf category subsets exclude correctness results) — a
whole-codebase health score.

## Rules (v1)

### CORRECT001 — keyed `{#each}` (warning)

Flag an `{#each}` block with **no key**. Reordering an unkeyed list destroys and recreates
DOM (state/focus loss, wasted work). High-signal Svelte footgun.

- Fact: `eachBlocks[].hasKey` (AST `EachBlock.key != null`).
- Fix: `{#each items as item (item.id)}`.

### CORRECT002 — `$effect` used to derive state (warning)

Flag an `$effect` whose body **only assigns** to local `$state` variables — the classic
"useEffect → $effect" mistake AI agents make migrating from React. The Svelte docs say to
use `$derived` instead.

- Fact: `effects[].assignsOnlyState` — true when the effect callback's body is solely
  assignments whose targets are identifiers declared via `$state(...)` in the same
  component. Conservative (any non-assignment statement → not flagged) for high precision.
- Fix: replace with `let x = $derived(expr)`.

## Surfaces & docs

`@svelte-vitals/core` + `svelte-vitals` + `@svelte-vitals/mcp` **minor**. 4 docs pages
(CORRECT001/002, en+ja). Changeset. The docs-link test requires the pages.

## Testing

- Parser facts: `{#each}` with/without key; `$effect` assign-only vs mixed body; `$state`
  name collection; `$effect.pre`.
- Rules: CORRECT001 flags unkeyed each / passes keyed; CORRECT002 flags assign-only effect
  / passes a mixed effect / passes a real `$derived`. Emit nothing when `ctx.components`
  unset (rendered mode).
- Integration (`collectComponentFacts`, memory runtime) over a couple of `.svelte` files.
- Full `pnpm -r test` + typecheck + lint + docs build green.

## Out of scope (later slices / issues)

- Security category (`{@html}` XSS, `target=_blank` rel, `javascript:` URLs).
- Architecture metrics (component size, prop count, nesting).
- Workflow ergonomics (`--diff` / `--staged` changed-files scanning).
- Aggregating eslint-plugin-svelte / svelte-check signals into the score.
- Deeper reactivity heuristics (effect dependency analysis, large `$state`).
