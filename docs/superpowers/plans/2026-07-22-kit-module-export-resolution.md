# Kit-Module Export-Resolution Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four hand-rolled named-export resolution passes in `kit-module-parse.ts` with one shared `forEachNamedExport` walker, with zero behavior change.

**Architecture:** A single two-pass walker (inline declarations, then same-file alias specifiers with lazily built bindings) takes a visitor; the four call sites become small matchers. The two alias-resolver helpers are deleted.

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-07-22-kit-module-export-resolution-design.md` (approved).

## Global Constraints

- **Zero behavior change.** The existing core suite is the acceptance gate: it must pass with **no test file modified**. If any test fails, the refactor is wrong — fix the refactor, never the test.
- All edits are in `packages/core/src/kit-module-parse.ts` only.
- Core purity: no `node:` imports, no I/O.
- Environment: EVERY pnpm command prefixed `npm_config_verify_deps_before_run=false pnpm ...`; NEVER run `pnpm install`.
- Run `pnpm exec prettier --write` on the touched file before committing.

---

### Task 1: `forEachNamedExport` + four call-site rewrites

**Files:**

- Modify: `packages/core/src/kit-module-parse.ts`

**Interfaces:**

- Consumes (already in the file): `unwrapTs`, `collectTopLevelBindings`, `isFunctionNode`, `addActionsMembers`, `HANDLER_NAMES`, `lineOf`.
- Produces: `forEachNamedExport(program, visit)` (module-private); unchanged public surface.

- [ ] **Step 1: Record the green baseline**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test`
Expected: all pass (this is the before-picture; note the passing count).

- [ ] **Step 2: Add the shared walker**

In `packages/core/src/kit-module-parse.ts`, directly above `collectHandlerFunctions`, add:

```ts
/**
 * Iterate the module's named exports, calling `visit(name, value, anchor)` for
 * each: first inline `export` declarations (`export function f` yields the
 * declaration itself; `export const x = …` yields each declarator's TS-unwrapped
 * init), then same-file alias specifiers (`export { local as name }`) resolved
 * through `collectTopLevelBindings` — type-only exports and cross-file re-exports
 * are skipped. `anchor` is the node whose `start` carries the export's source
 * position (the declarator/declaration inline, the resolved node for aliases).
 * A visitor returning `true` stops the walk (first-match finders). Bindings are
 * built lazily, once, and only when an alias specifier actually resolves a pass.
 * Replaces the four hand-rolled copies that classified handlers, the `init`
 * hook, `ssr`/`csr` opt-outs, and the `load` function.
 */
function forEachNamedExport(
  program: Node,
  visit: (name: string, value: Node, anchor: Node) => boolean | undefined
): void {
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue;
    const decl = stmt.declaration;
    if (decl.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier') {
      if (visit(decl.id.name, decl, decl)) return;
      continue;
    }
    if (decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || !d.init) continue;
      if (visit(d.id.name, unwrapTs(d.init), d)) return;
    }
  }
  let bindings: Map<string, Node> | undefined;
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.specifiers || stmt.source || stmt.exportKind === 'type')
      continue;
    for (const s of stmt.specifiers) {
      if (s?.exportKind === 'type' || s?.exported?.type !== 'Identifier' || s?.local?.type !== 'Identifier') continue;
      bindings ??= collectTopLevelBindings(program);
      const resolved = bindings.get(s.local.name);
      if (resolved === undefined) continue;
      if (visit(s.exported.name, resolved, resolved)) return;
    }
  }
}
```

- [ ] **Step 3: Rewrite the four call sites and delete the two alias helpers**

1. DELETE `resolveAliasHandlerExports` and `resolveAliasStartupExports` (functions and their doc comments).
2. Replace the BODY of `collectHandlerFunctions` (keep its doc comment, but remove the sentence that names `resolveAliasHandlerExports` if present):

```ts
function collectHandlerFunctions(program: Node): Set<Node> {
  const handlers = new Set<Node>();
  forEachNamedExport(program, (name, value) => {
    if (HANDLER_NAMES.has(name) && isFunctionNode(value)) handlers.add(value);
    else if (name === 'actions' && value?.type === 'ObjectExpression') addActionsMembers(value, handlers);
    return undefined;
  });
  return handlers;
}
```

3. Replace the BODY of `collectStartupFunctions` (keep the doc comment, dropping any reference to the deleted helper):

```ts
function collectStartupFunctions(program: Node): Set<Node> {
  const startup = new Set<Node>();
  forEachNamedExport(program, (name, value) => {
    if (name === 'init' && isFunctionNode(value)) startup.add(value);
    return undefined;
  });
  return startup;
}
```

4. Replace the BODY of `findFalseOptOut` (keep its doc comment verbatim):

```ts
function findFalseOptOut(program: Node, source: string, name: 'ssr' | 'csr'): { line: number } | undefined {
  let hit: { line: number } | undefined;
  forEachNamedExport(program, (exported, value, anchor) => {
    if (exported !== name || value?.type !== 'Literal' || value.value !== false) return undefined;
    hit = { line: lineOf(source, anchor.start) };
    return true;
  });
  return hit;
}
```

5. Replace the BODY of `findLoadFunction` (keep its doc comment verbatim):

```ts
function findLoadFunction(program: Node): Node | undefined {
  let load: Node | undefined;
  forEachNamedExport(program, (name, value) => {
    if (name !== 'load' || !isFunctionNode(value)) return undefined;
    load = value;
    return true;
  });
  return load;
}
```

- [ ] **Step 4: Run the core suite — the acceptance gate**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test`
Expected: EXACTLY the baseline pass count from Step 1, zero failures, zero test files modified. Any failure = refactor bug; fix the source, re-run.

- [ ] **Step 5: Build and downstream check**

```bash
npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core build
npm_config_verify_deps_before_run=false pnpm --filter svelte-vitals test
npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/vite test
npm_config_verify_deps_before_run=false pnpm typecheck
npm_config_verify_deps_before_run=false pnpm lint
```

Expected: all pass (lint: only the 2 pre-existing `meta-object.test.ts` warnings).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write packages/core/src/kit-module-parse.ts
git add packages/core/src/kit-module-parse.ts
git commit -m "refactor(core): unify named-export resolution in kit-module-parse"
```

Note: no changeset (internal-only refactor, no user-facing change); no docs changes; `packages/action/dist` is NOT rebuilt in this task — the final verify before PR runs the full `pnpm build` and commits the dist diff if any (the bundled behavior is identical, but bundler output may shift).
