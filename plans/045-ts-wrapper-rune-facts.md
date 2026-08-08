# Plan 045: See through TS casts at rune declarations, and collect imports for runes modules

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9e0cf9e..HEAD -- packages/core/src/component-parse.ts packages/core/test/component-parse.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M (two independent S-sized halves, same file)
- **Risk**: LOW/MED — both halves strictly **widen** what the analyzer
  recognizes, so the only behavior change is new true positives surfacing on
  projects that were silently exempt. That is the fix working, but it is
  user-visible.
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9e0cf9e`, 2026-08-08

## Why this matters

Two families of false negatives in `packages/core`'s component-fact parser,
both silent (the analyzer reports "checks passed"):

**A — TS casts hide runes.** `let count = $state(0) as number` produces a
declarator whose `init` is a `TSAsExpression` wrapping the call. Verified
empirically against the vendored `svelte/compiler` at `9e0cf9e`: `init.type ===
'TSAsExpression'`, `init.callee === undefined`. Every declarator-init rune
predicate reads `init.callee` directly, so the cast form is invisible. Affected
facts feed roughly 8 rules (`correctness/effect-as-derived`,
`correctness/effect-as-onmount`, `correctness/unmutated-state`,
`correctness/nonreactive-builtin-state`, `correctness/stale-prop-derivation`,
`correctness/prop-mutation`, `performance/state-raw`,
`architecture/prop-count` — a 30-prop component using
`$props() as Props` counts 0 props and passes). The repo already has the
correct helper (`unwrapTs`, exported at `component-parse.ts:51`) and already
applies it to call **arguments** — just not to the declarator init itself.

**B — runes modules report no imports.** `parseModuleFacts` (the
`.svelte.ts`/`.svelte.js` path) hardcodes `imports: []`, `importSpans: []`,
`namespaceImports: []`. Four rules gate on a non-empty import list
(`performance/heavy-import` uses `applies: (c) => (c.importSpans ?? c.imports).length > 0`,
similarly `performance/namespace-import`, `architecture/private-scope-import`,
`architecture/route-component-import`), so a `src/lib/cart/state.svelte.ts`
importing `moment` or a `$lib/**/internal/**` path is never checked, even
though it bundles into the client exactly like a component. The rationale
comment above `parseModuleFacts` is also stale: it claims `loc: 0` is what
keeps `performance/heavy-import` quiet on module files, but that rule never
reads `loc` — the empty import list is what suppresses it.

## Current state

File: `packages/core/src/component-parse.ts` (~2240 lines) — all component
fact collection. Test file: `packages/core/test/component-parse.test.ts`.

The helper that already exists (`component-parse.ts:51-57`):

```ts
/** Unwrap TS wrapper expressions (`x satisfies T`, `x as T`, `x!`) to the underlying expression. ... */
export function unwrapTs(expr: TsExpression): Expression {
  let cur = expr;
  while (cur.type === 'TSSatisfiesExpression' || cur.type === 'TSAsExpression' || cur.type === 'TSNonNullExpression')
    cur = cur.expression;
  return cur;
}
```

The declarator-init sites that read the wrapped init directly (line numbers at
`9e0cf9e`; **grep is authoritative**, see Step 1):

1. `~2106-2113` — the `stateNames`/`reactiveNames`/`stateDecls` walker:

```ts
walkEstree(program, (n) => {
  if (n.type !== 'VariableDeclarator' || !n.init) return;
  if (isStateDeclaration(n.init) && n.id?.type === 'Identifier') {
    stateNames.add(n.id.name);
    stateDecls.push({ name: n.id.name, line: lineOf(source, n.start) });
  }
  if (isStateDeclaration(n.init) || isDerivedDeclaration(n.init) || isPropsCall(n.init))
    addBoundNames(n.id, reactiveNames);
});
```

2. `~2139` — rawable candidates (note the **argument** is already unwrapped,
   the init is not — this is the pattern to fix):

```ts
if (d?.id?.type !== 'Identifier' || !d.init || !isPlainStateCall(d.init)) continue;
const arg = unwrapTs(d.init.arguments?.[0]);
```

3. `~2177` — a second `isPlainStateCall(d.init)` site (builtin-state
   candidates), same shape as (2).
4. `~1111` — `collectPropNames`: `if (n.type !== 'VariableDeclarator' || !n.init || !isPropsCall(n.init)) return;`
5. `~1215` — `countProps`: same `isPropsCall(n.init)` shape.
6. `~1922` — `collectModuleStateDecls`: `if (d?.id?.type === 'Identifier' && d.init && isStateDeclaration(d.init))`
   (and just below, `isStateDeclaration(m.value)` for class fields —
   `m.value` is also a cast candidate: `count = $state(0) as number` in a
   class body).

CAUTION for site (2)/(3): after unwrapping the init, `d.init.arguments` must be
read from the **unwrapped** expression (`unwrapTs(d.init).arguments`), not from
`d.init`.

Line reporting: sites that call `lineOf(source, n.start)` / `d.start` use the
declarator's own offset, which is unaffected by unwrapping. Do not change line
derivation.

`parseModuleFacts` (`~1955-2008`) — the stale comment and the empty facts:

```ts
 * ... component-only facts stay empty and
 * `loc` is 0 so architecture/component-size and performance/heavy-import don't fire on module files. ...
 */
function parseModuleFacts(source: string, filename: string): ParsedFacts {
  const { program, wrapped } = parseModuleProgram(source, filename);
  const shift = (line: number) => Math.max(0, line - 1);
  ...
  return {
    ...
    loc: 0,
    propCount: 0,
    imports: [],
    importSpans: [],
    namespaceImports: [],
    ...
```

The component path's import collection to mirror (`~2068-2069`):
`collectImportSources(program, source)` and `collectNamespaceImports(program, source)`
(read the exact signatures at those lines — the module path must pass `wrapped`
as the source and shift resulting lines with the existing `shift()` helper,
exactly as `collectOrphanEffects` does a few lines above).

Repo conventions: comments state constraints, not narration; conventional
commits (`fix(core): ...`); user-facing changes need a changeset; test names
state the behavior.

## Commands you will need

| Purpose       | Command                                                                          | Expected on success                                     |
| ------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Install       | `pnpm install`                                                                   | exit 0                                                  |
| Typecheck     | `pnpm -r typecheck`                                                              | exit 0                                                  |
| Core tests    | `pnpm --filter @svelte-vitals/core test`                                         | all pass                                                |
| One test file | `pnpm --filter @svelte-vitals/core exec vitest run test/component-parse.test.ts` | all pass                                                |
| Full suite    | `pnpm test`                                                                      | all pass (cli/vite consume core facts — run everything) |
| Lint          | `pnpm lint`                                                                      | exit 0                                                  |

## Scope

**In scope** (the only files you should modify):

- `packages/core/src/component-parse.ts`
- `packages/core/test/component-parse.test.ts`
- `packages/core/test/correctness-rules.test.ts` and/or
  `packages/core/test/bundle-rules.test.ts` — one rule-level regression each
  for A and B
- `.changeset/<new>.md`

**Out of scope** (do NOT touch, even though they look related):

- `packages/core/src/kit-module-parse.ts` — it has its own TS handling; auditing
  it is a separate task.
- Any rule file (`packages/core/src/rules/**`) — the fix is in fact
  collection; rules must work unchanged.
- `packages/core/src/component-collect.ts` — the glob already includes
  `.svelte.{ts,js}`; nothing to change there.

## Git workflow

- Branch: `advisor/045-ts-wrapper-rune-facts`
- Commit style: `fix(core): recognize TS-cast rune declarations and collect runes-module imports`
  (two commits, one per half, is fine)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Enumerate the sites (grep is authoritative, the line numbers above are hints)

```bash
grep -n "isStateDeclaration(\|isDerivedDeclaration(\|isPropsCall(\|isPlainStateCall(" packages/core/src/component-parse.ts
```

For every call whose argument is a declarator `init` (or class-field `value`) —
as opposed to an already-unwrapped local — it must go through `unwrapTs` first.
Sites whose argument is already the result of `unwrapTs(...)` need no change.
Record the list; it should match the 6 sites in "Current state" (± the class
field). If you find sites this plan doesn't mention, apply the same treatment
and note them in your report.

**Verify**: the grep output lists each site you will touch.

### Step 2: Half A — unwrap at each site

Guarded unwrap, e.g. for site (1):

```ts
    walkEstree(program, (n) => {
      if (n.type !== 'VariableDeclarator' || !n.init) return;
      const init = unwrapTs(n.init);
      if (isStateDeclaration(init) && n.id?.type === 'Identifier') { ... }
      if (isStateDeclaration(init) || isDerivedDeclaration(init) || isPropsCall(init))
        addBoundNames(n.id, reactiveNames);
    });
```

For (2)/(3) also switch `d.init.arguments` to the unwrapped expression's
`.arguments`. Keep all `lineOf(...)` calls on the original node offsets.

**Verify**: `pnpm --filter @svelte-vitals/core exec vitest run test/component-parse.test.ts`
→ all existing tests pass (no line-number expectations move — if one does, see
STOP conditions).

### Step 3: Half A — tests

In `component-parse.test.ts` (model after the existing wrapper-descent test
around line 917), add fixtures with `<script lang="ts">`:

- `let count = $state(0) as number;` → `count` appears in state facts
  (whichever named collections the existing tests assert for the plain form —
  mirror an existing plain-`$state` test and add the cast).
- `let d = $derived(count * 2) satisfies number;` → recognized as reactive.
- `let { a, b } = $props() as { a: string; b: string };` → `propCount === 2`
  and prop names collected.
- `let big = $state({ x: 1 }) as Record<string, number>;` → appears in the
  rawable/constable candidates the plain form would produce.
- One rule-level regression in `correctness-rules.test.ts`: a component whose
  only rune uses the `as` form and which violates `correctness/unmutated-state`
  (or another of the 8 — pick the one with the simplest existing fixture) →
  the finding fires.

**Verify**: the new tests fail if you revert Step 2 (spot-check one), pass with it.

### Step 4: Half B — collect imports in `parseModuleFacts`

- Call `collectImportSources` / `collectNamespaceImports` over `program` with
  `wrapped` as the source (mirroring the component path at `~2068-2069`),
  shift line numbers with the existing `shift()`, and return the results
  instead of the three `[]` literals. Read the component path first to get the
  exact return shapes (`imports` vs `importSpans` — populate all three fields
  the same way the component path does).
- Keep `loc: 0` and `propCount: 0` — `architecture/component-size` must stay
  quiet on module files.
- Rewrite the stale comment above the function: the truthful constraint is
  "`loc` stays 0 so `architecture/component-size` skips module files; imports
  ARE collected so import-based rules see runes modules."

**Verify**: `pnpm --filter @svelte-vitals/core test` → pass.

### Step 5: Half B — tests

- `component-parse.test.ts`: a `.svelte.ts` module fixture with
  `import moment from 'moment';` on a known line → `importSpans` contains it
  with the correctly shifted line, `loc === 0`.
- Rule-level regression in `bundle-rules.test.ts`: `performance/heavy-import`
  fires on a runes-module fact with a heavy import (mirror an existing
  component-fact case, switching the file name to `state.svelte.ts`).
- Pin the non-goal: `architecture/component-size` does NOT fire on a large
  module fixture (one test, if not already pinned).

**Verify**: `pnpm test` (full suite — cli/vite integration tests consume these
facts) → all pass.

### Step 6: Changeset + format

`pnpm changeset` → `@svelte-vitals/core` **patch**. Text must say: rune
declarations behind TS casts (`as`/`satisfies`/`!`) are now recognized, and
`.svelte.ts`/`.svelte.js` modules now report their imports — **new findings may
appear in TypeScript-heavy projects**; they were previously missed, not newly
introduced. Then `pnpm format`.

**Verify**: `pnpm lint` → exit 0.

## Test plan

Summarized in Steps 3 and 5. Structural patterns: `component-parse.test.ts`
(fact-level), `correctness-rules.test.ts` / `bundle-rules.test.ts`
(rule-level). Every new test's name states the behavior
("recognizes $state behind an as-cast"), not the bug history.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm -r typecheck` exits 0
- [ ] `pnpm test` exits 0 (all packages), including ≥ 6 new tests
- [ ] `grep -nE "(isStateDeclaration|isDerivedDeclaration|isPropsCall|isPlainStateCall)\((n|d|m)\.(init|value)\)" packages/core/src/component-parse.ts` returns no matches — no rune predicate receives a raw declarator init or class-field value (guard clauses like `!d.init ||` may remain; only the predicate's argument must be unwrapped)
- [ ] `grep -n "imports: \[\]" packages/core/src/component-parse.ts` shows no hit inside `parseModuleFacts`'s return
- [ ] The stale comment above `parseModuleFacts` no longer claims heavy-import is suppressed by `loc`
- [ ] A changeset for `@svelte-vitals/core` (patch) exists and mentions that new findings may surface
- [ ] `pnpm lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts don't match the live code (drift).
- Unwrapping at a site changes an **existing** test's expected line numbers or
  fact sets — that means the site had a subtlety this plan missed; report the
  diff rather than adjusting the expectation.
- After Half B, any rule other than the four import-gated ones starts firing on
  module fixtures (e.g. `architecture/component-size`) — the blast radius
  assumption is wrong.
- `collectImportSources`/`collectNamespaceImports` signatures don't accept the
  module path's `(program, wrapped)` shape.

## Maintenance notes

- Future rune predicates (`isXxxCall(init)`) must take the unwrapped init;
  a reviewer should watch for `(\w+)\(d\.init\)` / `(n\.init)` patterns in new
  collector code. Consider (out of scope here) a `initOf(declarator)` helper if
  a third instance of this bug class appears.
- Half B widens `performance/heavy-import` / `architecture/private-scope-import`
  reach to runes modules; if users report surprising new findings, the
  changeset text is the reference that this was deliberate.
- `kit-module-parse.ts` was NOT audited for the same cast pattern — a follow-up
  candidate.
