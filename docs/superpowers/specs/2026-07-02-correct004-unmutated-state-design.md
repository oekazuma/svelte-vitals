# CORRECT004 — unmutated `$state` → `const`

**Date:** 2026-07-02
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (rule), `@svelte-vitals/cli` (capture), `@svelte-vitals/mcp` (surfaces the rule)

## Goal

Add **CORRECT004**, a further "More Correctness/reactivity" rule from #69. Flag a
`let x = $state(...)` declaration whose value is **never written or escaped**
anywhere in the component — the reactivity is unused, so `const` (or `$state.raw`
if only reassigned wholesale) is clearer and cheaper. `info` severity.

Scope is **Smell A only** (never written → `const`). Smell B (reassigned but never
deep-mutated → `$state.raw`) is out of scope (its detection needs to distinguish
reassignment from deep mutation; a possible follow-up).

No overlap with official tooling: the Svelte compiler and `svelte-check` do not
warn about a never-mutated `$state`.

## Background / current state

- `packages/cli/src/providers/source/parse.ts` tracks `stateNames` (via
  `isStateDeclaration`, `$state`/`$state.raw`/`$state.frozen`) but does not track
  writes. It already walks the instance ESTree (effects, props) and the template
  fragment (`collectEachBlocks`, `collectSecurityFacts`).
- Rules use the `componentRule` factory (CLI/static only; no-ops in rendered
  mode). CORRECT001/002/003 live in `packages/core/src/rules/correctness/`.
- Verified AST shapes: `bind:value={x}` → `BindDirective { expression: Identifier }`;
  `<Child d={x}>` → `Component` node whose `attributes` hold the prop expressions,
  and whose `fragment` holds slot children (rendered in the parent scope);
  `{x}` → `ExpressionTag`.

## Design

### 1. What marks a `$state` as "written or escaped" (conservative — no false positives)

A declared `$state` name is **suppressed** (not flagged) when, anywhere in the
component, it is:

**Script AND template expressions (ESTree walk over the instance program *and*
the template fragment):** — writes 1–4 are detected in both places, because a
`$state` is commonly mutated in an inline event handler (`<button onclick={() =>
count++}>`), whose expression lives in the template AST, not the instance script.
Missing handler mutations would be a false positive.

1. Reassigned / compound-assigned / updated — `AssignmentExpression` whose `left`
   is an `Identifier` that is a state name, or an `UpdateExpression` (`x++`/`x--`)
   on one.
2. Member/element assigned — `AssignmentExpression` whose `left` is a
   `MemberExpression` whose **root object** identifier is a state name
   (`x.a = …`, `x[i] = …`, `x.a.b = …`).
3. The object of a method call — `CallExpression` whose `callee` is a
   `MemberExpression` whose root object is a state name (`x.push()`, `x.foo()`).
4. An argument to any call — `CallExpression` with an argument that is an
   `Identifier` state name (`f(x)`, `Object.assign(x, …)`).

**Template (Svelte AST walk):**

5. Bound — a `BindDirective` whose expression's root identifier is a state name
   (`<input bind:value={x}>`, `<Child bind:x={state}>`). **Required** — a bound
   state is genuinely writable; missing this would be a false positive.
6. Passed as a component prop — a `Component` node with, among its **own
   `attributes`** (an `Attribute` expression value or a `SpreadAttribute`), a state
   name identifier (`<Child d={x}>`, `<Child {...x}>`). A Component's slotted
   children (its `fragment`) are **reads** in the parent scope and do **not**
   suppress (`<Card>{x}</Card>` is a read).

Everything else is a read and does **not** suppress: `{x}` interpolation, member
reads `x.a`, DOM-element attribute expressions (`<input value={x}>`), `{#each x}`
/ `{#if x}` expressions, and reads inside `$derived`/`$effect`.

A `$state` declaration flagged (const candidate) is one whose name is in none of
1–6. Shadowing (a nested local reusing a state name that is written) conservatively
suppresses (a false negative, never a false positive).

Only `let x = $state(...)` with an `Identifier` binding is considered; destructured
`$state` declarations are ignored (rare; the binding is not the state cell).

### 2. Capture model — `ComponentFacts.constableStates`

Add a focused field:

```ts
/** `$state` declarations never written or escaped in the component — candidates for const (CORRECT004). */
constableStates: { name: string; line: number }[];
```

`parse.ts` changes (in the instance block, where `stateNames` is already built):

- Collect `stateDecls: { name: string; line: number }[]` for each
  `VariableDeclarator` with an `Identifier` id whose init `isStateDeclaration`.
- Build `writtenOrEscaped: Set<string>`:
  - `collectStateWrites(root, stateNames, acc)` — a generic ESTree walk for rules
    1–4, run over **both** the instance `program` and `ast.fragment` (so inline
    handler mutations are seen).
  - `collectTemplateEscapes(fragment, stateNames, acc)` — a dedicated template
    walk for rules 5–6 (`BindDirective` expressions; `Component` node
    `attributes`). `CHILD_NODE_KEYS` does not include `attributes`, so this walk
    inspects `node.attributes` explicitly and recurses children via
    `CHILD_NODE_KEYS`.
  - Helper `rootObjectName(memberExpr)` → the base identifier name.
- `constableStates = stateDecls.filter((d) => !writtenOrEscaped.has(d.name))`.

`stateNames` / `assignsOnlyState` / `reactiveNames` (CORRECT002/003) are unchanged.

### 3. Rule — CORRECT004

Add to `packages/core/src/rules/correctness/` (new `correct004-unmutated-state.ts`,
or appended to the correctness rules file), via `componentRule`:

- `id: 'CORRECT004'`, `title: 'Unmutated $state'`, `category: 'correctness'`,
  `severity: 'info'`, `scope: 'component'`.
- `label` (PASS): `'$state usage'`.
- `recommendation`: `"If a value never changes, use const; if you only ever reassign it wholesale (never mutate its properties), use $state.raw to skip deep proxying."`
- `rationale`: `'A $state that is never mutated pays for reactivity (deep proxying, tracking) it never uses; const (or $state.raw) is clearer and cheaper.'`
- `applies`: `(c) => c.constableStates.length > 0`.
- `bad`: `(c) => c.constableStates.map((s) => ({ line: s.line, message: `$state "${s.name}" is never mutated — use const (or $state.raw if you only reassign it)` }))`.

### 4. Registration & surfaces

- Export `correct004UnmutatedState`, import + append to `allRules`, add to the
  re-export blocks in `packages/core/src/rules/index.ts` and
  `packages/core/src/index.ts` (after `correct003EffectAsOnMount`).
- MCP surfaces it automatically via `allRules`.

### 5. Docs

Two reference pages following the CORRECT003 format (title; `**Severity:** info ·
**Category:** correctness`; What it checks / Why it matters / How to fix):

- `docs/src/content/docs/rules/correct004.md`
- `docs/src/content/docs/ja/rules/correct004.md`

### 6. Changeset

`@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/mcp` — **minor** (CLI/static
rule; not `@svelte-vitals/vite`).

## Testing

- **Capture** (`packages/cli` `parse-component-facts` tests): a `$state` read only
  via interpolation / member read is `constable`; a `$state` that is reassigned,
  compound-assigned, `++`/`--`, member-assigned (`x.a=`), method-called
  (`x.push()`), passed as a call arg (`f(x)`), mutated in an inline handler
  (`<button onclick={() => x++}>`), bound (`bind:value={x}`), or passed
  as a component prop (`<Child d={x}>`) is **not** constable; a Component's slot
  child read (`<Card>{x}</Card>`) stays constable; a DOM attribute read
  (`<input value={x}>`) stays constable.
- **Rule** (`packages/core` `correctness-rules` tests): a component with a
  constable state fails (one finding per state, with line); no constable states →
  no-signal (`applies` false).
- Full suite + typecheck + lint + `docs build` green; no assertions loosened.

## Out of scope (YAGNI)

- Smell B (`$state.raw` for reassigned-but-not-deep-mutated) as a separate signal.
- Destructured `$state` declarations.
- Cross-function/whole-program mutation tracking (bare-call and method-call
  escapes are uniformly suppressed instead — conservative).
