# kit-module-parse: unify named-export resolution — Design

Date: 2026-07-22
Status: Approved

## Problem

`packages/core/src/kit-module-parse.ts` carries four hand-rolled copies of the same two-pass named-export resolution (inline `export` declarations, then same-file alias specifiers resolved through `collectTopLevelBindings`): `collectHandlerFunctions` + `resolveAliasHandlerExports`, `collectStartupFunctions` + `resolveAliasStartupExports`, `findFalseOptOut`, and `findLoadFunction`. A guard-condition fix must be applied in four places and silently diverges if one is missed (flagged by the PERF011 branch review as finding #7; finding #8 noted `collectTopLevelBindings` being rebuilt per copy).

## Change

One shared walker in the same file:

```ts
function forEachNamedExport(
  program: Node,
  visit: (name: string, value: Node, anchor: Node) => boolean | undefined
): void;
```

- **Pass 1 (inline)**: every `ExportNamedDeclaration` with a `declaration` — `FunctionDeclaration` with an id yields `(id.name, decl, decl)`; each `VariableDeclaration` declarator with an `Identifier` id and an init yields `(id.name, unwrapTs(init), declarator)`.
- **Pass 2 (alias)**: specifiers of `ExportNamedDeclaration`s (skipping type-only exports and cross-file `source` re-exports) resolved through `collectTopLevelBindings`, yielding `(exported.name, resolvedNode, resolvedNode)` when the local resolves.
- `anchor` is the node whose `start` callers use for line numbers — declarator/declaration for inline (matching `findFalseOptOut`'s current `d.start`), the resolved node for aliases (matching `resolved.start`).
- `visit` returning `true` stops the walk (first-match finders); returning nothing continues (collectors).
- `collectTopLevelBindings` is built lazily, once, and only when an eligible alias specifier exists — files without alias exports (the overwhelming majority) skip that pass entirely, resolving review finding #8 without signature churn.

Rewritten call sites (all four keep their exact current semantics, including inline-before-alias precedence and first-match-wins for the finders):

- `collectHandlerFunctions`: visitor adds `isFunctionNode(value)` matches of `HANDLER_NAMES`, and feeds `value.type === 'ObjectExpression'` through `addActionsMembers` when `name === 'actions'`. `resolveAliasHandlerExports` is deleted.
- `collectStartupFunctions`: visitor adds `name === 'init' && isFunctionNode(value)`. `resolveAliasStartupExports` is deleted.
- `findFalseOptOut(program, source, name)`: visitor matches `name` with `value.type === 'Literal' && value.value === false`, records `lineOf(source, anchor.start)`, returns `true`.
- `findLoadFunction`: visitor matches `name === 'load' && isFunctionNode(value)`, records `value`, returns `true`.

## Non-goals

- No behavior change anywhere — the existing core test suite (pinning security, correctness, SEO, and performance rules) is the acceptance gate, plus a dist regression probe.
- No new export forms (`export default`, cross-file re-exports) — same conservative scope as today.
- Review finding #9 (double `collectAwaits` walk in `collectLoadWaterfalls`) stays as-is: negligible cost, clearer code.

## Verification

`pnpm --filter @svelte-vitals/core test` (all pass, zero pin changes), core build, full `pnpm build`/`typecheck`/`lint`, and a dist probe re-running the PERF011/PERF013 and SEO031-style scenarios.
