# CORRECT007 — Orphan Lifecycle Call Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CORRECT007 — a `critical` correctness rule flagging Svelte lifecycle/context calls (`onMount`, `getContext`, …) guaranteed to run outside component initialisation and throw the runtime `lifecycle_outside_component` error, across both the runes-module surface and the Kit route/hooks surface.

**Architecture:** Generalise CORRECT006's eval-scope collectors in `component-parse.ts` to matcher-parameterised versions (the `$effect` instantiation stays byte-identical — existing CORRECT006 tests are the regression bar) and add `ComponentFacts.orphanLifecycleCalls`. Add the same svelte-import tracking to `parseKitModuleFacts` for `KitModuleFacts.lifecycleCalls` (top level / handler bodies / `init` only). One rule with a custom `check(ctx)` reads both channels.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, `svelte/compiler` `parse`, Astro Starlight docs, Changesets.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-correct007-orphan-lifecycle-design.md`. Branch: `feat/correct007-orphan-lifecycle` (already exists with the spec commit; work on it).
- **Rebase check before starting**: PR #237 (`fix/sec003-relative-lib-server`) also touches `packages/core/src/kit-module-parse.ts`. Run `git fetch origin` — if origin/main has moved past `399ef6e`, rebase this branch onto `origin/main` first and re-verify the file state before editing.
- Tracked callees (canonical): `onMount`, `onDestroy`, `beforeUpdate`, `afterUpdate`, `createEventDispatcher`, `getContext`, `setContext`, `hasContext`, `getAllContexts` — ONLY when value-imported from `'svelte'` (named specifiers with alias resolution; namespace imports via non-computed member access). `import type`/type-only specifiers excluded. `createContext`, `mount`, `hydrate`, `tick`, `untrack`, `flushSync`, and `svelte/legacy` are never flagged.
- `orphanEffects` (CORRECT006) output must be byte-identical after the collector generalisation — no existing test assertion changes.
- New facts are REQUIRED fields: `ComponentFacts.orphanLifecycleCalls` and `KitModuleFacts.lifecycleCalls` — every existing literal gains an empty array (file lists in Tasks 1–2).
- Kit surface flags calls at top level, in handler bodies, and in the `init` hook (`!inFunction || inHandler || inStartup`); helper functions are NOT flagged. Module surface mirrors CORRECT006's two patterns exactly.
- Rule: `id 'CORRECT007'`, `title 'Lifecycle call outside component initialisation'`, `category 'correctness'`, `severity 'critical'`, `scope 'component'`; message/recommendation/rationale strings verbatim from the spec §4.
- en/ja docs ship together; CLI-guide suppression range (en/ja) `CORRECT001–006` → `CORRECT001–007`. Changeset: core / `svelte-vitals` / vite / mcp — all **minor**.
- `packages/core/src`: no `node:` imports, no I/O. Conventional commits scoped by package. cli tests/typecheck need `pnpm --filter @svelte-vitals/core build` after core changes. Verify from repo root: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` (2 pre-existing warnings in `packages/cli/test/meta-object.test.ts` are not yours). `pnpm build` regenerates `packages/action/dist/index.js` — commit it as a final `chore(action)` commit.

---

## File Structure

- Modify: `packages/core/src/component-parse.ts` — generalised collectors, svelte-import tracking helpers (exported for the Kit parser), `orphanLifecycleCalls` wiring (Task 1).
- Modify: `packages/core/src/component.ts` (`OrphanLifecycleCallFact` + field), `packages/core/src/component-collect.ts` (`emptyComponentFacts`) — Task 1.
- Modify (literal fixups, Task 1): `packages/core/test/component-collect.test.ts`, `component-rule.test.ts`, `security-rules.test.ts`, `bundle-rules.test.ts`, `correctness-rules.test.ts`, `architecture-rules.test.ts`, `security-kit-rules.test.ts` (the `stateModule` helper), `packages/cli/test/malformed-svelte.test.ts`, `packages/cli/test/suppression-e2e.test.ts`.
- Modify: `packages/core/src/kit-module.ts`, `packages/core/src/kit-module-parse.ts`, `packages/core/src/kit-module-collect.ts` (`emptyKitModuleFacts`), `packages/core/test/kit-module-parse.test.ts`, `packages/core/test/kit-module-collect.test.ts` + `security-kit-rules.test.ts` `kit()` helper — Task 2.
- Create: `packages/core/src/rules/correctness/correct007-orphan-lifecycle.ts`; Modify: `packages/core/src/rules/index.ts` (3 spots), `packages/core/src/index.ts` (1 spot), `packages/core/test/correctness-rules.test.ts` — Task 3.
- Create: `docs/src/content/docs/rules/correct007.md` + `ja/rules/correct007.md`; Modify: `docs/src/content/docs/guides/cli.md`, `ja/guides/cli.md`; Create: `.changeset/correct007-orphan-lifecycle.md` — Task 4.

---

### Task 1: Generalised collectors + `ComponentFacts.orphanLifecycleCalls`

**Files:**

- Modify: `packages/core/src/component-parse.ts` (the CORRECT006 section: `collectEvalScopeEffectLines` ~line 605, `collectOrphanEffects` ~line 645, `parseModuleFacts` ~line 770, and the `.svelte` path of `parseComponentFacts`)
- Modify: `packages/core/src/component.ts` (new interface after `OrphanEffectFact`; field after `orphanEffects` in `ComponentFacts`)
- Modify: `packages/core/src/component-collect.ts` (`emptyComponentFacts`)
- Modify: `packages/core/test/component-parse.test.ts` (new describe at end)
- Modify (add `orphanLifecycleCalls: []` next to each `orphanEffects: []` / in each `ComponentFacts` literal): the 7 core + 2 cli test files listed in File Structure

**Interfaces:**

- Consumes: existing `walkEvalScope`, `isEffectCall`, `isEffectRootCall`, `unwrapExport`, `lineOf`.
- Produces (Task 2 imports these from `./component-parse.js`): `LIFECYCLE_NAMES: Set<string>`, `collectSvelteLifecycleImports(program): { locals: Map<string, string>; namespaces: Set<string> }`, `matchLifecycleCall(n, imports): { canonical: string; local: string } | undefined`. Plus `ComponentFacts.orphanLifecycleCalls: OrphanLifecycleCallFact[]` (Task 3 reads it).

- [ ] **Step 1: Rebase check**

```bash
git switch feat/correct007-orphan-lifecycle
git fetch origin
git log --oneline origin/main -1   # if not 399ef6e, run: git rebase origin/main
```

- [ ] **Step 2: Write the failing capture tests**

Append to `packages/core/test/component-parse.test.ts`:

```ts
describe('parseComponentFacts — orphan lifecycle calls (CORRECT007)', () => {
  const calls = (src: string, file = 'src/lib/store.svelte.ts') => parseComponentFacts(src, file).orphanLifecycleCalls;

  it('flags top-level lifecycle/context calls imported from svelte', () => {
    const src = "import { onMount, getContext } from 'svelte';\nonMount(() => {});\nconst theme = getContext('theme');";
    expect(calls(src)).toEqual([
      { name: 'onMount', line: 2, kind: 'top-level' },
      { name: 'getContext', line: 3, kind: 'top-level' }
    ]);
  });
  it('flags every tracked callee at top level', () => {
    const names = [
      'onMount',
      'onDestroy',
      'beforeUpdate',
      'afterUpdate',
      'createEventDispatcher',
      'getContext',
      'setContext',
      'hasContext',
      'getAllContexts'
    ];
    for (const name of names) {
      expect(calls(`import { ${name} } from 'svelte';\n${name}();`)).toEqual([{ name, line: 2, kind: 'top-level' }]);
    }
  });
  it('records the canonical name for aliased imports and namespace member calls', () => {
    expect(calls("import { onMount as om } from 'svelte';\nom(() => {});")).toEqual([
      { name: 'onMount', line: 2, kind: 'top-level' }
    ]);
    expect(calls("import * as s from 'svelte';\ns.setContext('k', 1);")).toEqual([
      { name: 'setContext', line: 2, kind: 'top-level' }
    ]);
  });
  it('flags a module-scope new of a class whose constructor calls a tracked function', () => {
    const src = [
      "import { getContext } from 'svelte';",
      'class Store {',
      '  constructor() {',
      "    this.user = getContext('user');",
      '  }',
      '}',
      'export const store = new Store();'
    ].join('\n');
    expect(calls(src)).toEqual([{ name: 'getContext', line: 7, kind: 'constructor-instantiated', className: 'Store' }]);
  });
  it('does not flag calls inside functions, createContext, non-context svelte exports, or other packages', () => {
    expect(calls("import { onMount } from 'svelte';\nexport function setup() {\n  onMount(() => {});\n}")).toEqual([]);
    expect(calls("import { createContext } from 'svelte';\nconst ctx = createContext();")).toEqual([]);
    expect(calls("import { getContext } from './my-di.js';\nconst x = getContext('k');")).toEqual([]);
    expect(calls("import { tick } from 'svelte';\ntick();")).toEqual([]);
  });
  it('flags <script module> calls but not instance-script calls in .svelte files', () => {
    const mod = "<script module>\nimport { setContext } from 'svelte';\nsetContext('k', 1);\n</script>";
    expect(parseComponentFacts(mod, 'C.svelte').orphanLifecycleCalls).toEqual([
      { name: 'setContext', line: 3, kind: 'top-level' }
    ]);
    const inst = "<script>\nimport { onMount } from 'svelte';\nonMount(() => {});\n</script>";
    expect(parseComponentFacts(inst, 'C.svelte').orphanLifecycleCalls).toEqual([]);
  });
  it('keeps orphanEffects unchanged through the generalised collectors', () => {
    const f = parseComponentFacts('$effect(() => {});', 'src/lib/s.svelte.ts');
    expect(f.orphanEffects).toEqual([{ line: 1, kind: 'top-level' }]);
    expect(f.orphanLifecycleCalls).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: FAIL — `orphanLifecycleCalls` is `undefined`.

- [ ] **Step 4: Add the fact type**

In `packages/core/src/component.ts`, after the `OrphanEffectFact` interface:

```ts
/** A svelte lifecycle/context call guaranteed to run outside component initialisation — it throws `lifecycle_outside_component` at runtime (CORRECT007). */
export interface OrphanLifecycleCallFact {
  /** Canonical svelte export name (alias-resolved), e.g. 'onMount'. */
  name: string;
  /** 1-based source line, or 0 if unknown. For 'constructor-instantiated', the module-scope `new` site. */
  line: number;
  /** 'top-level' = runs at module evaluation; 'constructor-instantiated' = module-scope `new` of a same-file class whose constructor calls a tracked function. */
  kind: 'top-level' | 'constructor-instantiated';
  /** Class name when kind is 'constructor-instantiated' (used in the finding message). */
  className?: string;
}
```

In `ComponentFacts`, after the `orphanEffects` field:

```ts
/** Svelte lifecycle/context calls guaranteed to run outside component initialisation — module scope in `.svelte.ts`/`.svelte.js` or `<script module>` (CORRECT007). */
orphanLifecycleCalls: OrphanLifecycleCallFact[];
```

- [ ] **Step 5: Generalise the collectors and add the lifecycle matcher**

In `packages/core/src/component-parse.ts`:

1. Add `OrphanLifecycleCallFact` to the type import from `./component.js`.
2. Directly below `walkEvalScope`, REPLACE `collectEvalScopeEffectLines` with the generalised collector — and DELETE `collectEvalScopeEffectLines` entirely (its only caller was the old `collectOrphanEffects` body, which step 3 rewrites; leaving it would be dead code eslint flags):

```ts
/**
 * Calls matching `matcher` that run when `root` itself is evaluated (CORRECT006/007).
 * `skipSubtree` exempts a call's children — CORRECT006 uses it for `$effect.root(...)`
 * callbacks, which are a legal standalone reactive scope.
 */
function collectEvalScopeCalls(
  root: Node,
  source: string,
  matcher: (n: Node) => string | undefined,
  skipSubtree?: (n: Node) => boolean
): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  walkEvalScope(root, (n) => {
    if (n.type !== 'CallExpression') return undefined;
    if (skipSubtree?.(n)) return true;
    const name = matcher(n);
    if (name) out.push({ name, line: lineOf(source, n.start) });
    return undefined;
  });
  return out;
}
```

3. REPLACE the body of `collectOrphanEffects` with a call to a generalised orphan collector, keeping its exported behavior and doc comment (append one sentence: `Generalised as \`collectOrphanCalls\` — CORRECT007 reuses the same walk with a lifecycle-import matcher.`):

```ts
/**
 * Matcher-parameterised orphan-call collector (CORRECT006/007): (1) matching calls that
 * run at module evaluation time, (2) a module-scope `new` (direct top-level statements
 * only, export-unwrapped) of a same-file top-level class whose constructor directly
 * makes a matching call. See `collectOrphanEffects`'s doc comment for why pattern 2 is
 * restricted to top-level `ClassDeclaration`s and top-level `new` statements.
 */
function collectOrphanCalls(
  program: Node,
  source: string,
  matcher: (n: Node) => string | undefined,
  skipSubtree?: (n: Node) => boolean
): { name: string; line: number; kind: 'top-level' | 'constructor-instantiated'; className?: string }[] {
  const out: { name: string; line: number; kind: 'top-level' | 'constructor-instantiated'; className?: string }[] =
    collectEvalScopeCalls(program, source, matcher, skipSubtree).map((c) => ({ ...c, kind: 'top-level' as const }));

  const body: Node[] = program.body ?? [];

  const matchingClasses = new Map<string, string>(); // class name → canonical callee name
  for (const stmt of body) {
    const decl = unwrapExport(stmt);
    if (decl?.type !== 'ClassDeclaration' || decl.id?.type !== 'Identifier') continue;
    const ctor = (decl.body?.body ?? []).find(
      (m: Node) => m?.type === 'MethodDefinition' && m.kind === 'constructor' && m.value?.body
    );
    if (!ctor) continue;
    const calls = collectEvalScopeCalls(ctor.value.body, source, matcher, skipSubtree);
    if (calls.length > 0) matchingClasses.set(decl.id.name, calls[0]!.name);
  }

  if (matchingClasses.size > 0) {
    for (const stmt of body) {
      const decl = unwrapExport(stmt);
      const isCandidate =
        decl?.type === 'VariableDeclaration' ||
        decl?.type === 'ExpressionStatement' ||
        (stmt.type === 'ExportDefaultDeclaration' &&
          decl?.type !== 'FunctionDeclaration' &&
          decl?.type !== 'ClassDeclaration');
      if (!isCandidate) continue;
      walkEvalScope(decl, (n) => {
        if (n.type === 'NewExpression' && n.callee?.type === 'Identifier' && matchingClasses.has(n.callee.name)) {
          out.push({
            name: matchingClasses.get(n.callee.name)!,
            line: lineOf(source, n.start),
            kind: 'constructor-instantiated',
            className: n.callee.name
          });
        }
        return undefined;
      });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

function collectOrphanEffects(program: Node, source: string): OrphanEffectFact[] {
  return collectOrphanCalls(program, source, (n) => (isEffectCall(n) ? '$effect' : undefined), isEffectRootCall).map(
    ({ line, kind, className }) => ({ line, kind, ...(className !== undefined ? { className } : {}) })
  );
}
```

(Move the long CORRECT006 rationale comment onto `collectOrphanEffects`/`collectOrphanCalls` as described; do not delete its content. Preserve the existing inline comments about TS constructor overloads and the pattern-2 candidate shapes inside `collectOrphanCalls`.)

4. Add the lifecycle tracking (exported — Task 2 reuses them), below `collectOrphanEffects`:

```ts
/** Svelte exports that throw `lifecycle_outside_component` when called without an active component context (CORRECT007). */
export const LIFECYCLE_NAMES = new Set([
  'onMount',
  'onDestroy',
  'beforeUpdate',
  'afterUpdate',
  'createEventDispatcher',
  'getContext',
  'setContext',
  'hasContext',
  'getAllContexts'
]);

/**
 * Tracked svelte lifecycle/context bindings in a module program (CORRECT007): local
 * alias → canonical name for named value imports from 'svelte', plus namespace locals
 * (`import * as s from 'svelte'`). Type-only imports/specifiers excluded; same-named
 * imports from any other module are never tracked. Shared with the Kit-module parser.
 */
export function collectSvelteLifecycleImports(program: Node): { locals: Map<string, string>; namespaces: Set<string> } {
  const locals = new Map<string, string>();
  const namespaces = new Set<string>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ImportDeclaration' || stmt.importKind === 'type' || stmt.source?.value !== 'svelte') continue;
    for (const s of stmt.specifiers ?? []) {
      if (s?.importKind === 'type' || s?.local?.type !== 'Identifier') continue;
      if (s.type === 'ImportSpecifier' && s.imported?.type === 'Identifier' && LIFECYCLE_NAMES.has(s.imported.name)) {
        locals.set(s.local.name, s.imported.name);
      } else if (s.type === 'ImportNamespaceSpecifier') {
        namespaces.add(s.local.name);
      }
    }
  }
  return { locals, namespaces };
}

/**
 * Whether a CallExpression calls a tracked svelte lifecycle/context binding (CORRECT007):
 * a direct call to a (possibly aliased) named import, or a non-computed member call on a
 * `svelte` namespace import. Returns the canonical name plus the local root binding (for
 * shadow checks in the Kit parser). Shared with the Kit-module parser.
 */
export function matchLifecycleCall(
  n: Node,
  imports: { locals: Map<string, string>; namespaces: Set<string> }
): { canonical: string; local: string } | undefined {
  const c = n?.callee;
  if (c?.type === 'Identifier') {
    const canonical = imports.locals.get(c.name);
    return canonical ? { canonical, local: c.name } : undefined;
  }
  if (
    c?.type === 'MemberExpression' &&
    !c.computed &&
    c.object?.type === 'Identifier' &&
    imports.namespaces.has(c.object.name) &&
    c.property?.type === 'Identifier' &&
    LIFECYCLE_NAMES.has(c.property.name)
  ) {
    return { canonical: c.property.name, local: c.object.name };
  }
  return undefined;
}

/** Orphan lifecycle-call facts for a module-context program (CORRECT007). */
function collectOrphanLifecycleCalls(program: Node, source: string): OrphanLifecycleCallFact[] {
  const imports = collectSvelteLifecycleImports(program);
  if (imports.locals.size === 0 && imports.namespaces.size === 0) return [];
  return collectOrphanCalls(program, source, (n) => matchLifecycleCall(n, imports)?.canonical);
}
```

(Also add `OrphanLifecycleCallFact` to the return-type usage — `ParsedFacts` picks it up automatically via `ComponentFacts`.)

5. Wire it: in `parseModuleFacts`, alongside `orphanEffects`/`moduleStateDecls`:

```ts
const orphanLifecycleCalls = program
  ? collectOrphanLifecycleCalls(program, wrapped).map((f) => ({ ...f, line: shift(f.line) }))
  : [];
```

and add `orphanLifecycleCalls` to its return object. In `parseComponentFacts`'s `.svelte` path, next to the `orphanEffects` line:

```ts
const orphanLifecycleCalls: OrphanLifecycleCallFact[] = ast.module?.content
  ? collectOrphanLifecycleCalls(ast.module.content, source)
  : [];
```

and add it to the return object. Update `parseModuleFacts`'s doc comment to mention `orphanLifecycleCalls`.

- [ ] **Step 6: `emptyComponentFacts` + literal fixups**

Add `orphanLifecycleCalls: [],` after `orphanEffects: [],` in `packages/core/src/component-collect.ts`. Run root `pnpm typecheck` and add `orphanLifecycleCalls: []` to every flagged `ComponentFacts` literal — known sites: the `emptyComponentFacts` `toEqual` in `component-collect.test.ts`, the `comp()`/literal helpers in `component-rule.test.ts`, `security-rules.test.ts`, `bundle-rules.test.ts`, `correctness-rules.test.ts`, `architecture-rules.test.ts`, the `stateModule` helper in `security-kit-rules.test.ts`, and the two cli test files (`malformed-svelte.test.ts`, `suppression-e2e.test.ts`). Re-run until clean.

- [ ] **Step 7: Run tests to verify pass (incl. the CORRECT006 regression bar)**

Run: `pnpm --filter @svelte-vitals/core test` then `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals test`
Expected: PASS — including every pre-existing `orphanEffects` test, unchanged.

- [ ] **Step 8: Commit**

```bash
git add packages/core packages/cli
git commit -m "feat(core): collect orphan svelte lifecycle calls in runes modules and <script module>"
```

---

### Task 2: `KitModuleFacts.lifecycleCalls`

**Files:**

- Modify: `packages/core/src/kit-module.ts` (new field after `runesModuleImports`)
- Modify: `packages/core/src/kit-module-parse.ts` (import tracking + visitor branch + return)
- Modify: `packages/core/src/kit-module-collect.ts` (`emptyKitModuleFacts`)
- Modify: `packages/core/test/kit-module-parse.test.ts` (new describe), `packages/core/test/security-kit-rules.test.ts` (the `kit()` helper gains `lifecycleCalls: []`), `packages/core/test/kit-module-collect.test.ts` (the `emptyKitModuleFacts` expectation if it enumerates fields)

**Interfaces:**

- Consumes (from Task 1, `./component-parse.js`): `collectSvelteLifecycleImports`, `matchLifecycleCall`.
- Produces: `KitModuleFacts.lifecycleCalls: { name: string; line: number; inHandler: boolean }[]` (Task 3 reads it).

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/kit-module-parse.test.ts`:

```ts
describe('parseKitModuleFacts — lifecycle calls (CORRECT007)', () => {
  it('flags getContext inside load (the classic trap)', () => {
    const src =
      "import { getContext } from 'svelte';\nexport function load() {\n  const user = getContext('user');\n  return { user };\n}";
    expect(facts(src).lifecycleCalls).toEqual([{ name: 'getContext', line: 3, inHandler: true }]);
  });
  it('flags top-level and init-hook calls with inHandler false', () => {
    const src =
      "import { onMount, setContext } from 'svelte';\nonMount(() => {});\nexport async function init() {\n  setContext('k', 1);\n}";
    expect(facts(src, 'src/hooks.server.ts').lifecycleCalls).toEqual([
      { name: 'onMount', line: 2, inHandler: false },
      { name: 'setContext', line: 4, inHandler: false }
    ]);
  });
  it('does not flag calls inside non-handler helper functions', () => {
    const src = "import { getContext } from 'svelte';\nexport function useUser() {\n  return getContext('user');\n}";
    expect(facts(src, 'src/routes/+page.ts').lifecycleCalls).toEqual([]);
  });
  it('resolves aliases and ignores same-named imports from other modules', () => {
    const src =
      "import { getContext as ctx } from 'svelte';\nimport { setContext } from './di.js';\nexport const load = () => {\n  ctx('a');\n  setContext('b', 1);\n};";
    expect(facts(src).lifecycleCalls).toEqual([{ name: 'getContext', line: 4, inHandler: true }]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-parse`
Expected: FAIL — `lifecycleCalls` is `undefined`.

- [ ] **Step 3: Implement**

1. `packages/core/src/kit-module.ts` — after `runesModuleImports`:

```ts
/** Svelte lifecycle/context calls that run outside component initialisation — top level, handler bodies, or the `init` hook (CORRECT007). */
lifecycleCalls: {
  name: string;
  line: number;
  inHandler: boolean;
}
[];
```

2. `packages/core/src/kit-module-parse.ts`:
   - Add `collectSvelteLifecycleImports, matchLifecycleCall` to the import from `./component-parse.js`.
   - Declare `const lifecycleCalls: KitModuleFacts['lifecycleCalls'] = [];` with the other arrays and include `lifecycleCalls` in BOTH return objects (the `!program` early return and the final return, the latter as `byLine(lifecycleCalls)`).
   - Before the `walkKit` call: `const svelteImports = collectSvelteLifecycleImports(program);`
   - Inside the visitor, after the imported-write detection block:

```ts
// CORRECT007 — svelte lifecycle/context calls outside component initialisation:
// top level (crashes at import), handler bodies (crashes per request — getContext
// in load), and the `init` hook (crashes at boot). Helper functions are exempt:
// a component may legally call them during its own initialisation.
if (n.type === 'CallExpression' && (!inFunction || inHandler || inStartup)) {
  const m = matchLifecycleCall(n, svelteImports);
  if (m && !shadowed.has(m.local)) {
    lifecycleCalls.push({ name: m.canonical, line: line(n.start), inHandler });
  }
}
```

3. `packages/core/src/kit-module-collect.ts` — add `lifecycleCalls: [],` to `emptyKitModuleFacts`.
4. Fixups: add `lifecycleCalls: [],` to the `kit()` helper in `packages/core/test/security-kit-rules.test.ts`; run `pnpm --filter @svelte-vitals/core typecheck` and fix anything else it flags (the `emptyKitModuleFacts` equality test in `kit-module-collect.test.ts` compares via the function itself, so it usually needs no edit — verify).

- [ ] **Step 4: Run to verify pass, then commit**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS.

```bash
git add packages/core
git commit -m "feat(core): collect svelte lifecycle calls in Kit route/hooks files"
```

---

### Task 3: The CORRECT007 rule + registration

**Files:**

- Create: `packages/core/src/rules/correctness/correct007-orphan-lifecycle.ts`
- Modify: `packages/core/src/rules/index.ts` (import + `allRules` + re-export, each directly after the `correct006OrphanEffect` entry), `packages/core/src/index.ts` (after `correct006OrphanEffect`)
- Modify: `packages/core/test/correctness-rules.test.ts`

**Interfaces:**

- Consumes: `ComponentFacts.orphanLifecycleCalls` (Task 1), `KitModuleFacts.lifecycleCalls` (Task 2), `docsUrlFor`.
- Produces: exported `correct007OrphanLifecycle: Rule`.

- [ ] **Step 1: Write the failing rule tests**

In `packages/core/test/correctness-rules.test.ts`: add `correct007OrphanLifecycle` to the `../src/index.js` import, add `import type { KitModuleFacts } from '../src/kit-module.js';`, add a local kit helper after `comp()`:

```ts
const kitFacts = (over: Partial<KitModuleFacts>): KitModuleFacts => ({
  file: 'src/routes/+page.ts',
  kind: 'universal',
  moduleStateReassignments: [],
  importedStateWrites: [],
  importedStateWritesOutsideHandlers: [],
  runesModuleImports: [],
  lifecycleCalls: [],
  suppressions: [],
  ...over
});
```

Append:

```ts
describe('CORRECT007 lifecycle call outside component initialisation', () => {
  it('flags a module top-level call as critical with the module message', async () => {
    const rs = await correct007OrphanLifecycle.check(
      ctx([
        comp({ file: 'src/lib/s.svelte.ts', orphanLifecycleCalls: [{ name: 'onMount', line: 2, kind: 'top-level' }] })
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('critical');
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.line).toBe(2);
    expect(rs[0]!.message).toContain('onMount()');
    expect(rs[0]!.message).toContain('lifecycle_outside_component');
  });
  it('names the class in the constructor-instantiated message', async () => {
    const rs = await correct007OrphanLifecycle.check(
      ctx([
        comp({
          orphanLifecycleCalls: [{ name: 'getContext', line: 7, kind: 'constructor-instantiated', className: 'Store' }]
        })
      ])
    );
    expect(fails(rs)[0]!.message).toContain('"Store"');
    expect(fails(rs)[0]!.message).toContain('getContext()');
  });
  it('uses the load/handler message for kit inHandler calls and the module message otherwise', async () => {
    const rs = await correct007OrphanLifecycle.check({
      ...ctx([]),
      kitModules: [
        kitFacts({ lifecycleCalls: [{ name: 'getContext', line: 3, inHandler: true }] }),
        kitFacts({
          file: 'src/hooks.server.ts',
          kind: 'server',
          lifecycleCalls: [{ name: 'onMount', line: 2, inHandler: false }]
        })
      ]
    });
    expect(fails(rs)).toHaveLength(2);
    expect(fails(rs)[0]!.message).toContain('load/handler');
    expect(fails(rs)[1]!.message).toContain('module evaluation');
  });
  it('reads both channels in one run and honours suppressions on each', async () => {
    const rs = await correct007OrphanLifecycle.check({
      ...ctx([
        comp({
          orphanLifecycleCalls: [{ name: 'onMount', line: 2, kind: 'top-level' }],
          suppressions: [{ line: 2, ruleIds: ['CORRECT007'] }]
        })
      ]),
      kitModules: [
        kitFacts({
          lifecycleCalls: [{ name: 'getContext', line: 3, inHandler: true }],
          suppressions: [{ line: 3, ruleIds: ['CORRECT007'] }]
        })
      ]
    });
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(2); // two PASS units (signal present, all findings suppressed)
  });
  it('emits nothing without signal or in rendered mode', async () => {
    expect(await correct007OrphanLifecycle.check(ctx([comp({})]))).toHaveLength(0);
    expect(await correct007OrphanLifecycle.check(base as RuleContext)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- correctness-rules`
Expected: FAIL — `correct007OrphanLifecycle` not exported.

- [ ] **Step 3: Implement the rule**

Create `packages/core/src/rules/correctness/correct007-orphan-lifecycle.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { SuppressionDirective } from '../../component.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

const ID = 'CORRECT007';
const DOCS_URL = docsUrlFor(ID);
const LABEL = 'Lifecycle-call context';
const RECOMMENDATION =
  "Call lifecycle/context functions during component initialisation (the top level of a component's <script>). In load, return the data and call setContext in a layout/page component; in shared modules, expose a setup function that components call during init.";

const topLevelMessage = (name: string) =>
  `${name}() runs at module evaluation, outside component initialisation — it throws lifecycle_outside_component at runtime`;

function isSuppressed(suppressions: SuppressionDirective[] | undefined, line: number): boolean {
  return (suppressions ?? []).some((s) => s.line === line && (!s.ruleIds || s.ruleIds.includes(ID)));
}

/** Emit one file's PASS/PENALIZED results — same shapes as componentRule/kitModuleRule. */
function emitFile(
  out: Result[],
  file: string,
  issues: { line: number; message: string }[],
  suppressions: SuppressionDirective[] | undefined
): void {
  const bad = issues.filter((b) => !(b.line > 0 && isSuppressed(suppressions, b.line)));
  if (bad.length === 0) {
    out.push({
      id: ID,
      category: 'correctness',
      severity: 'critical',
      detection: PASS,
      route: file,
      message: LABEL,
      recommendation: RECOMMENDATION,
      docsUrl: DOCS_URL
    });
    return;
  }
  for (const b of bad) {
    out.push({
      id: ID,
      category: 'correctness',
      severity: 'critical',
      detection: PENALIZED,
      route: file,
      location: file,
      ...(b.line > 0 ? { line: b.line } : {}),
      message: b.message,
      recommendation: RECOMMENDATION,
      docsUrl: DOCS_URL
    });
  }
}

/**
 * CORRECT007 — svelte lifecycle/context calls guaranteed to run outside component
 * initialisation: module scope in runes modules / `<script module>`, the constructor of
 * a module-scope-instantiated class, and Kit load/handler/`init` bodies. A custom check
 * because the facts live on BOTH the component channel and the Kit-module channel.
 */
export const correct007OrphanLifecycle: Rule = {
  id: ID,
  title: 'Lifecycle call outside component initialisation',
  category: 'correctness',
  severity: 'critical',
  scope: 'component',
  rationale:
    'Svelte lifecycle and context functions require an active component context; called at module scope, in a shared-state class constructor, or in a load/handler they throw lifecycle_outside_component at runtime — the compiler does not catch it, and it surfaces as a production crash.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const c of ctx.components ?? []) {
      const calls = c.orphanLifecycleCalls ?? [];
      if (calls.length === 0) continue;
      emitFile(
        out,
        c.file,
        calls.map((o) => ({
          line: o.line,
          message:
            o.kind === 'top-level'
              ? topLevelMessage(o.name)
              : `class "${o.className}" calls ${o.name}() in its constructor and is instantiated at module scope — it throws lifecycle_outside_component at runtime`
        })),
        c.suppressions
      );
    }
    for (const m of ctx.kitModules ?? []) {
      const calls = m.lifecycleCalls ?? [];
      if (calls.length === 0) continue;
      emitFile(
        out,
        m.file,
        calls.map((l) => ({
          line: l.line,
          message: l.inHandler
            ? `${l.name}() is called in a load/handler — it runs on every request, outside component initialisation, and throws lifecycle_outside_component at runtime`
            : topLevelMessage(l.name)
        })),
        m.suppressions
      );
    }
    return out;
  }
};
```

- [ ] **Step 4: Register (four sites) and verify**

Add `import { correct007OrphanLifecycle } from './correctness/correct007-orphan-lifecycle.js';` + `allRules` entry + re-export in `packages/core/src/rules/index.ts` (each directly after the `correct006OrphanEffect` line), and the re-export in `packages/core/src/index.ts` after `correct006OrphanEffect,`.

Run: `grep -rn "correct007OrphanLifecycle" packages/core/src`
Expected: 5 hits (rule file + 3 + 1).

- [ ] **Step 5: Run to verify, then commit**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS. (cli `docs-links` will fail until Task 4 — expected.)

```bash
git add packages/core
git commit -m "feat(core): add CORRECT007 — flag lifecycle calls outside component initialisation"
```

---

### Task 4: Docs (en/ja), suppression range, changeset, full verification

**Files:**

- Create: `docs/src/content/docs/rules/correct007.md`, `docs/src/content/docs/ja/rules/correct007.md`
- Modify: `docs/src/content/docs/guides/cli.md` (line ~217), `docs/src/content/docs/ja/guides/cli.md` (line ~215) — `CORRECT001–006` → `CORRECT001–007` (keep each file's dash; nothing else on the line)
- Create: `.changeset/correct007-orphan-lifecycle.md`

- [ ] **Step 1: Write the English rule page**

Create `docs/src/content/docs/rules/correct007.md`:

````md
---
title: CORRECT007 · Lifecycle call outside component initialisation
description: onMount, getContext and friends called outside component initialisation throw lifecycle_outside_component at runtime.
---

**Severity:** critical · **Category:** correctness

## What it checks

Flags calls to Svelte's lifecycle and context functions (`onMount`, `onDestroy`, `beforeUpdate`, `afterUpdate`, `createEventDispatcher`, `getContext`, `setContext`, `hasContext`, `getAllContexts` — value-imported from `svelte`, aliases and namespace imports included) that are guaranteed to run outside component initialisation:

- at **module scope** in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>` block,
- in the **constructor of a class instantiated at module scope** (same file),
- in a SvelteKit **`load` function, form action, endpoint or hooks handler, or the `init` hook** — the classic trap is `getContext` inside `load`.

Not flagged: calls inside ordinary functions (a component may legally call them during its own initialisation), `createContext()` (module-scope creation is the official pattern of the new context API), non-context svelte exports (`mount`, `tick`, …), same-named functions imported from other modules, factory functions/IIFEs/cross-file classes, and `svelte/legacy`'s `createBubbler`.

## Why it matters

These functions require an active component context. Called without one they throw Svelte's `lifecycle_outside_component` error at runtime — the compiler compiles all of these patterns without a warning, so the failure only surfaces when the code path runs, typically as a production crash (in a `load` function: a 500 on every visit to that route).

## How to fix

```ts
// +page.ts
import { getContext } from 'svelte';

export async function load({ fetch }) {
  const user = getContext('user'); // ❌ lifecycle_outside_component — load is not component init

  return { user: await (await fetch('/api/user')).json() }; // ✅ return data instead
}
```

Move the call into component initialisation:

```svelte
<!-- +page.svelte -->
<script>
  import { setContext } from 'svelte';

  let { data } = $props();
  setContext('user', () => data.user); // ✅ component init — legal
</script>
```

For shared modules, expose a setup function that components call during init instead of running lifecycle calls at module scope.
````

- [ ] **Step 2: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/correct007.md`:

````md
---
title: CORRECT007 · コンポーネント初期化外での lifecycle 呼び出し
description: onMount や getContext などをコンポーネント初期化の外で呼ぶと、ランタイムで lifecycle_outside_component エラーになります。
---

**重大度:** critical · **カテゴリ:** correctness

## チェック内容

Svelte の lifecycle / context 関数(`onMount`、`onDestroy`、`beforeUpdate`、`afterUpdate`、`createEventDispatcher`、`getContext`、`setContext`、`hasContext`、`getAllContexts` — `svelte` からの value import が対象で、エイリアスと namespace import も追跡)の、コンポーネント初期化外での実行が確定している呼び出しを検出します:

- `.svelte.ts`/`.svelte.js` runes モジュールや `.svelte` の `<script module>` ブロックの**モジュールスコープ**
- **モジュールスコープでインスタンス化されるクラスの constructor** 内(同一ファイル)
- SvelteKit の **`load` 関数・form action・エンドポイント/フック handler・`init` フック**内 — 典型は `load` 内での `getContext`

検出対象外: 通常の関数内の呼び出し(コンポーネントが初期化中に呼べば合法)、`createContext()`(モジュールスコープでの作成が新 context API の公式パターン)、context を要求しない svelte export(`mount`、`tick` など)、他モジュールからの同名 import、ファクトリ関数/IIFE/クロスファイルクラス、`svelte/legacy` の `createBubbler`。

## 重要な理由

これらの関数はアクティブなコンポーネントコンテキストを必要とします。ない状態で呼ぶとランタイムで `lifecycle_outside_component` エラーになります — コンパイラはどのパターンも警告なしでコンパイルするため、コードパスが実行されて初めて顕在化し、典型的には本番クラッシュになります(`load` 内なら、そのルートへの全アクセスが 500 に)。

## 修正方法

```ts
// +page.ts
import { getContext } from 'svelte';

export async function load({ fetch }) {
  const user = getContext('user'); // ❌ lifecycle_outside_component — load はコンポーネント初期化ではない

  return { user: await (await fetch('/api/user')).json() }; // ✅ 代わりにデータを返す
}
```

呼び出しをコンポーネント初期化へ移します:

```svelte
<!-- +page.svelte -->
<script>
  import { setContext } from 'svelte';

  let { data } = $props();
  setContext('user', () => data.user); // ✅ コンポーネント初期化中 — 合法
</script>
```

共有モジュールでは、モジュールスコープで lifecycle を呼ぶ代わりに、コンポーネントが初期化時に呼ぶ setup 関数として公開してください。
````

- [ ] **Step 3: Update the suppression range and verify docs-links**

Edit the two guide lines (`CORRECT001–006` → `CORRECT001–007`). Then:

Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals test -- docs-links`
Expected: PASS.

- [ ] **Step 4: Add the changeset**

Create `.changeset/correct007-orphan-lifecycle.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add CORRECT007 (critical): flag Svelte lifecycle/context calls (`onMount`, `getContext`, `setContext`, …) that run outside component initialisation and throw `lifecycle_outside_component` at runtime — at module scope in runes modules and `<script module>`, in constructors of module-scope-instantiated classes, and inside SvelteKit load/action/endpoint handlers (the classic `getContext`-in-`load` trap).
```

- [ ] **Step 5: Full verification and commits**

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

All green (`pnpm format` + re-run if formatting fails; include any reformatted files in the matching commit).

```bash
git add docs/src/content/docs .changeset
git commit -m "docs: add CORRECT007 rule reference (en/ja), extend suppression range, changeset"
git add packages/action/dist/index.js
git commit -m "chore(action): rebuild dist/ with the CORRECT007 core changes"
```

(Skip the second commit if `git status` shows no dist change.)

---

## Done criteria

- `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all green from the repo root.
- `grep -rn "correct007OrphanLifecycle" packages/core/src` → 5 hits.
- Every pre-existing `orphanEffects` (CORRECT006) test passes unchanged.
- Manual smoke (`/verify` before the PR): a fixture project with `getContext` inside `load` reports a critical CORRECT007 finding at the call line.
- PR body in English.
