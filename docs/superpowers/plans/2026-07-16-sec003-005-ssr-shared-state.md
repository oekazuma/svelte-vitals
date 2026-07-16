# SEC003–005 — SSR Shared-State Leaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three security rules catching SvelteKit's cross-request server-state leaks (SEC003 handler-writes-imported-state, SEC004 server module-scope reassignment, SEC005 server import of a `$state` runes module), carried on a new `KitModuleFacts` analysis channel for Kit route/hooks files.

**Architecture:** A new `KitModuleFacts` channel: `parseKitModuleFacts` (reusing CORRECT006's `<script lang="ts">` wrap parser via a newly extracted `parseModuleProgram` helper) + `collectKitModuleFacts` + `RuleContext.kitModules`, wired into the CLI static provider and the vite build analyzer. `ComponentFacts` gains `moduleStateDecls` (module-scope `$state` in `.svelte.ts`/`.svelte.js`) so SEC005 can cross-reference the two channels. Rules are built with a new `kitModuleRule` factory mirroring `componentRule`.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, `svelte/compiler` `parse`, Astro Starlight docs, Changesets.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-sec003-005-ssr-shared-state-design.md`. Branch: `feat/sec003-005-ssr-shared-state` (create from `main` in Task 1).
- `packages/core/src` is runtime-agnostic: NO `node:` imports, no I/O outside the injected `Runtime` (see `packages/core/CLAUDE.md`).
- Rule identities: `SEC003` "Handler writes imported state" **critical**; `SEC004` "Server module-scope state" **warning**; `SEC005` "Shared runes-state import on the server" **warning**. All `category: 'security'`, `scope: 'component'` (file = scoring unit).
- Detection boundaries (spec §4): SEC004 flags **reassignments only** (`=`, compound, `??=`, `++`) of module-scope `let`/`var` from inside a function — `const cache = new Map()` + `.set()` is deliberately NOT flagged. SEC003 flags handler-body writes whose root binding is an import: member assignment, `UpdateExpression`, `delete`, and `.set(...)`/`.update(...)` calls only (no other method names). SEC005 tracks **direct imports only**, `$lib/` + relative specifiers, `import type` excluded; a binding already reported by SEC003 is not double-reported by SEC005.
- `src/lib/server/**` is NOT scanned (spec limitation).
- `ComponentFacts.moduleStateDecls` is a REQUIRED field → every existing `ComponentFacts` literal gains `moduleStateDecls: []` (files listed in Task 1).
- Kit files parse via the wrap trick: line numbers subtract 1 (`Math.max(0, … - 1)`); suppressions come from the UNWRAPPED source (`collectSuppressions` text scan).
- en/ja docs ship together; suppression-range lines in `guides/cli.md` (en:217, ja:215) get `SEC001–002` → `SEC001–005`.
- Changeset: `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`, `@svelte-vitals/mcp` — all **minor**.
- Verify from repo root: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`. cli tests/typecheck resolve core via built `dist/` — run `pnpm --filter @svelte-vitals/core build` after core changes before trusting cli results. `pnpm build` regenerates `packages/action/dist/index.js` — commit it as a final `chore(action)` commit.
- Conventional commits scoped by package. The 2 pre-existing lint warnings in `packages/cli/test/meta-object.test.ts` are not yours to fix.

---

## File Structure

- Modify: `packages/core/src/component-parse.ts` — export shared helpers, extract `parseModuleProgram`, add `collectModuleStateDecls` (Task 1).
- Modify: `packages/core/src/component.ts`, `packages/core/src/component-collect.ts` (`emptyComponentFacts`) — `moduleStateDecls` (Task 1).
- Modify (literal fixups, Task 1): `packages/core/test/component-collect.test.ts`, `component-rule.test.ts`, `security-rules.test.ts`, `bundle-rules.test.ts`, `correctness-rules.test.ts`, `architecture-rules.test.ts`, `packages/cli/test/malformed-svelte.test.ts`, `packages/cli/test/suppression-e2e.test.ts`.
- Create: `packages/core/src/kit-module.ts` (types), `packages/core/src/kit-module-parse.ts` (parser) — Tasks 2–3.
- Create: `packages/core/src/kit-module-collect.ts`; Modify: `packages/core/src/rule.ts`, `packages/core/src/index.ts`, `packages/cli/src/index.ts`, `packages/vite/src/providers/source/components.ts`, `packages/vite/src/analyze.ts` — Task 4.
- Create: `packages/core/src/rules/kit-module-rule.ts`, `packages/core/src/rules/security/sec003-load-state-write.ts`, `sec004-server-module-state.ts` (Task 5), `sec005-shared-state-import.ts` (Task 6); Modify: `packages/core/src/rules/index.ts`, `packages/core/src/index.ts`.
- Create tests: `packages/core/test/kit-module-parse.test.ts` (Tasks 2–3), `packages/core/test/kit-module-collect.test.ts` (Task 4), `packages/core/test/security-kit-rules.test.ts` (Tasks 5–6); extend `packages/core/test/component-parse.test.ts` (Task 1).
- Create docs: `docs/src/content/docs/rules/sec003.md`, `sec004.md`, `sec005.md` + `ja/rules/` mirrors; Modify: `docs/src/content/docs/guides/cli.md`, `ja/guides/cli.md`; Create: `.changeset/sec003-005-ssr-shared-state.md` — Task 7.

---

### Task 1: Shared parser helpers + `ComponentFacts.moduleStateDecls`

**Files:**

- Modify: `packages/core/src/component-parse.ts`
- Modify: `packages/core/src/component.ts` (after the `orphanEffects` field in `ComponentFacts`, and after the `OrphanEffectFact` interface)
- Modify: `packages/core/src/component-collect.ts` (`emptyComponentFacts`)
- Modify: `packages/core/test/component-parse.test.ts` (new describe at end)
- Modify (add `moduleStateDecls: []` next to `orphanEffects: []`): the 8 test files listed in File Structure

**Interfaces:**

- Consumes: existing `parse`, `lineOf`, `isStateDeclaration`, `unwrapExport`, `collectSuppressions`, `WALK_IGNORED_KEYS`, `rootObjectName`, `addBoundNames`, `scopeIntroducedNames` (all currently private in `component-parse.ts`).
- Produces (Tasks 2–3 rely on these exact exports from `./component-parse.js`): `parseModuleProgram(source: string, filename: string): { program: Node | undefined; wrapped: string }`, and exported `unwrapExport`, `rootObjectName`, `addBoundNames`, `scopeIntroducedNames`, `collectSuppressions`, `WALK_IGNORED_KEYS`. Plus `ComponentFacts.moduleStateDecls: { name: string; line: number }[]`.

- [ ] **Step 1: Create the branch**

```bash
git switch -c feat/sec003-005-ssr-shared-state
```

- [ ] **Step 2: Write the failing capture tests**

Append to `packages/core/test/component-parse.test.ts`:

```ts
describe('parseComponentFacts — module-scope $state declarations (SEC005)', () => {
  const decls = (src: string, file = 'src/lib/store.svelte.ts') => parseComponentFacts(src, file).moduleStateDecls;

  it('collects top-level $state and $state.raw variable declarations', () => {
    const src = 'export const user = $state({ name: "" });\nlet count = $state.raw(0);';
    expect(decls(src)).toEqual([
      { name: 'user', line: 1 },
      { name: 'count', line: 2 }
    ]);
  });
  it('collects a module-scope new of a same-file class with a $state field', () => {
    const src = [
      'class QuizStateManager {',
      '  bookmarks = $state([]);',
      '}',
      'export const quizState = new QuizStateManager();'
    ].join('\n');
    expect(decls(src)).toEqual([{ name: 'quizState', line: 4 }]);
  });
  it('ignores $state inside functions and classes without a module-scope new', () => {
    const src = [
      'export function createStore() {',
      '  const s = $state({});',
      '  return s;',
      '}',
      'class Unused {',
      '  v = $state(0);',
      '}'
    ].join('\n');
    expect(decls(src)).toEqual([]);
  });
  it('stays empty for .svelte components (script module $state is out of scope)', () => {
    const facts = parseComponentFacts('<script module>\nexport const s = $state({});\n</script>', 'C.svelte');
    expect(facts.moduleStateDecls).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: FAIL — `moduleStateDecls` is `undefined`.

- [ ] **Step 4: Add the fact type**

In `packages/core/src/component.ts`, inside `ComponentFacts`, after the `orphanEffects` field, add:

```ts
/** Module-scope `$state` declarations in a `.svelte.ts`/`.svelte.js` runes module — on a server, one instance shared by every request (SEC005). Always empty for `.svelte` files. */
moduleStateDecls: {
  name: string;
  line: number;
}
[];
```

- [ ] **Step 5: Export the shared helpers and extract `parseModuleProgram`**

In `packages/core/src/component-parse.ts`:

1. Add the `export` keyword to these existing declarations (no body changes): `WALK_IGNORED_KEYS` (line 53), `addBoundNames` (line 142), `rootObjectName` (line 167), `scopeIntroducedNames` (line 185), `collectSuppressions` (line 560), `unwrapExport` (line 619). Extend each one-line doc comment with `Shared with the Kit-module parser (SEC003–005).` where a comment exists.
2. Directly above `parseModuleFacts` (line ~706), add:

```ts
/**
 * Parse a plain TS/JS module source by wrapping it in a `<script lang="ts">` tag —
 * the Svelte script parser handles TS natively, so no extra parser dependency is
 * needed. Literal "</script" occurrences are neutralised with a same-length
 * placeholder first (string contents don't affect fact extraction; offsets are
 * preserved). Returns the ESTree Program and the wrapped source — wrapped line
 * numbers are +1 relative to the input, so callers subtract 1. Shared by the
 * runes-module facts (CORRECT006) and the Kit-module facts (SEC003–005).
 */
export function parseModuleProgram(source: string, filename: string): { program: Node | undefined; wrapped: string } {
  const neutralized = source.replace(/<\/script/gi, '<_script');
  const wrapped = `<script lang="ts">\n${neutralized}\n</script>`;
  const ast = parse(wrapped, { modern: true, filename }) as Node;
  return { program: ast.instance?.content, wrapped };
}
```

3. Rewrite `parseModuleFacts`'s opening to use it (delete the inline `neutralized`/`wrapped`/`ast`/`program` lines; keep the existing doc comment, trimming the now-duplicated neutralisation sentences to a pointer at `parseModuleProgram`):

```ts
function parseModuleFacts(source: string, filename: string): ParsedFacts {
  const { program, wrapped } = parseModuleProgram(source, filename);
  const shift = (line: number) => Math.max(0, line - 1);
  const orphanEffects = program
    ? collectOrphanEffects(program, wrapped).map((f) => ({ ...f, line: shift(f.line) }))
    : [];
  const moduleStateDecls = program
    ? collectModuleStateDecls(program, wrapped).map((d) => ({ ...d, line: shift(d.line) }))
    : [];
  return {
    eachBlocks: [],
    effects: [],
    htmlTags: [],
    javascriptUrls: [],
    loc: 0,
    propCount: 0,
    imports: [],
    importSpans: [],
    namespaceImports: [],
    constableStates: [],
    mutatedProps: [],
    suppressions: collectSuppressions(source),
    orphanEffects,
    moduleStateDecls
  };
}
```

4. Above `parseModuleFacts`, add the collector:

```ts
/**
 * Module-scope reactive-state declarations in a runes module (SEC005): a top-level
 * `let|const x = $state(...)` / `$state.raw(...)` declaration, and a module-scope
 * `new` (in a top-level variable declaration) of a same-file top-level class with a
 * `$state` field initializer — recorded under the instance binding's name at the
 * declaration line. Direct top-level statements only (export-unwrapped), mirroring
 * CORRECT006's pattern-2 conservatism.
 */
function collectModuleStateDecls(program: Node, source: string): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  const body: Node[] = program.body ?? [];
  const statefulClasses = new Set<string>();
  for (const stmt of body) {
    const decl = unwrapExport(stmt);
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations ?? []) {
        if (d?.id?.type === 'Identifier' && d.init && isStateDeclaration(d.init)) {
          out.push({ name: d.id.name, line: lineOf(source, d.start) });
        }
      }
    } else if (decl?.type === 'ClassDeclaration' && decl.id?.type === 'Identifier') {
      const hasStateField = (decl.body?.body ?? []).some(
        (m: Node) => m?.type === 'PropertyDefinition' && m.value && isStateDeclaration(m.value)
      );
      if (hasStateField) statefulClasses.add(decl.id.name);
    }
  }
  if (statefulClasses.size > 0) {
    for (const stmt of body) {
      const decl = unwrapExport(stmt);
      if (decl?.type !== 'VariableDeclaration') continue;
      for (const d of decl.declarations ?? []) {
        if (
          d?.init?.type === 'NewExpression' &&
          d.init.callee?.type === 'Identifier' &&
          statefulClasses.has(d.init.callee.name)
        ) {
          out.push({
            name: d.id?.type === 'Identifier' ? d.id.name : d.init.callee.name,
            line: lineOf(source, d.start)
          });
        }
      }
    }
  }
  return out.sort((a, b) => a.line - b.line);
}
```

5. In `parseComponentFacts`'s `.svelte` return object, add `moduleStateDecls: [],` next to `orphanEffects`.

- [ ] **Step 6: `emptyComponentFacts` + literal fixups**

Add `moduleStateDecls: [],` after `orphanEffects: [],` in `packages/core/src/component-collect.ts`'s `emptyComponentFacts`. Then run `pnpm typecheck` at the root and add `moduleStateDecls: []` to every flagged `ComponentFacts` literal — known sites: the 6 core test files and 2 cli test files listed in File Structure (each already has an `orphanEffects: []` line to sit next to). Also update the `emptyComponentFacts` `toEqual` in `component-collect.test.ts`. Re-run until clean.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test` then `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core packages/cli
git commit -m "feat(core): collect module-scope \$state declarations, share the module parser helpers"
```

---

### Task 2: `KitModuleFacts` types + parser (handlers, SEC004 reassignments, suppressions)

**Files:**

- Create: `packages/core/src/kit-module.ts`
- Create: `packages/core/src/kit-module-parse.ts`
- Create: `packages/core/test/kit-module-parse.test.ts`

**Interfaces:**

- Consumes (from Task 1, all from `./component-parse.js`): `parseModuleProgram`, `collectSuppressions`, `unwrapExport`, `rootObjectName`, `addBoundNames`, `scopeIntroducedNames`, `WALK_IGNORED_KEYS`; `lineOf` from `./svelte-ast.js`.
- Produces: `KitModuleFacts` (exact shape below); `parseKitModuleFacts(source: string, filename: string): Omit<KitModuleFacts, 'file' | 'kind'>`; internal `walkKit`/`collectHandlerFunctions`/`isFunctionNode`/`unwrapTs` that Task 3 extends; exported `resolveRunesModuleSpecifier` arrives in Task 3.

- [ ] **Step 1: Create the types file**

Create `packages/core/src/kit-module.ts`:

```ts
import type { SuppressionDirective } from './component.js';

/**
 * Facts parsed from one SvelteKit route/hooks file for the SSR shared-state rules
 * (SEC003–005). Collected by `collectKitModuleFacts` (static/CLI + vite build mode).
 */
export interface KitModuleFacts {
  /** Repo-relative source file. */
  file: string;
  /** 'server' = runs only on the server (+*.server, +server, hooks.server); 'universal' = +page.ts/+layout.ts (still runs on the server during SSR). */
  kind: 'server' | 'universal';
  /** Module-scope let/var reassigned from inside a function (SEC004). */
  moduleStateReassignments: { name: string; line: number; inHandler: boolean }[];
  /** Writes to an imported binding from inside an exported handler (SEC003). */
  importedStateWrites: { name: string; line: number; via: 'assignment' | 'set-call' }[];
  /** Writes to an imported binding outside handlers — top level or helper functions (SEC005's write flavour). */
  importedStateWritesOutsideHandlers: { name: string; line: number }[];
  /** Value imports whose specifier resolves to a repo-local `.svelte.ts`/`.svelte.js` runes module (SEC005). */
  runesModuleImports: { source: string; resolved: string; names: string[]; line: number }[];
  /** Inline `svelte-vitals-disable-next-line` directives in this file. */
  suppressions: SuppressionDirective[];
}
```

- [ ] **Step 2: Write the failing tests (handlers + SEC004 + suppressions)**

Create `packages/core/test/kit-module-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseKitModuleFacts } from '../src/kit-module-parse.js';

const facts = (src: string, file = 'src/routes/+page.server.ts') => parseKitModuleFacts(src, file);

describe('parseKitModuleFacts — module-scope reassignments (SEC004)', () => {
  it('flags the docs NEVER example: module let assigned from an action', () => {
    const src = [
      'let user;',
      'export function load() {',
      '  return { user };',
      '}',
      'export const actions = {',
      '  default: async ({ request }) => {',
      '    const data = await request.formData();',
      '    user = { name: data.get("name") };',
      '  }',
      '};'
    ].join('\n');
    expect(facts(src).moduleStateReassignments).toEqual([{ name: 'user', line: 8, inHandler: true }]);
  });
  it('flags compound and ??= reassignment and ++ from a load handler', () => {
    const src =
      'let hits = 0;\nlet cached;\nexport const load = async () => {\n  hits++;\n  cached ??= await fetch("/x");\n};';
    expect(facts(src).moduleStateReassignments).toEqual([
      { name: 'hits', line: 4, inHandler: true },
      { name: 'cached', line: 5, inHandler: true }
    ]);
  });
  it('flags a helper-function reassignment as inHandler: false', () => {
    const src = 'let last;\nfunction remember(v) {\n  last = v;\n}\nexport function load() {\n  remember(1);\n}';
    expect(facts(src).moduleStateReassignments).toEqual([{ name: 'last', line: 3, inHandler: false }]);
  });
  it('does not flag top-level initialisation, const mutation, or shadowed locals', () => {
    const src = [
      'let config = null;',
      'config = { ready: true };',
      'const cache = new Map();',
      'export function load() {',
      '  cache.set("k", 1);',
      '  let config = 2;',
      '  config = 3;',
      '}'
    ].join('\n');
    expect(facts(src).moduleStateReassignments).toEqual([]);
  });
  it('identifies actions members and HTTP-method handlers (satisfies unwrapped)', () => {
    const src = 'let n = 0;\nexport const GET = (() => {\n  n = 1;\n}) satisfies RequestHandler;';
    expect(facts(src, 'src/routes/api/+server.ts').moduleStateReassignments).toEqual([
      { name: 'n', line: 3, inHandler: true }
    ]);
  });
  it('identifies a hooks.server handle handler', () => {
    const src =
      'let lastPath;\nexport const handle = async ({ event, resolve }) => {\n  lastPath = event.url.pathname;\n  return resolve(event);\n};';
    expect(facts(src, 'src/hooks.server.ts').moduleStateReassignments).toEqual([
      { name: 'lastPath', line: 3, inHandler: true }
    ]);
  });
  it('collects suppressions against unwrapped line numbers', () => {
    const src = 'let user;\nexport function load() {\n  // svelte-vitals-disable-next-line SEC004\n  user = 1;\n}';
    const f = facts(src);
    expect(f.moduleStateReassignments).toEqual([{ name: 'user', line: 4, inHandler: true }]);
    expect(f.suppressions).toEqual([{ line: 4, ruleIds: ['SEC004'] }]);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-parse`
Expected: FAIL — module `../src/kit-module-parse.js` does not exist.

- [ ] **Step 4: Implement the parser skeleton**

Create `packages/core/src/kit-module-parse.ts`:

```ts
import {
  parseModuleProgram,
  collectSuppressions,
  unwrapExport,
  rootObjectName,
  addBoundNames,
  scopeIntroducedNames,
  WALK_IGNORED_KEYS
} from './component-parse.js';
import { lineOf } from './svelte-ast.js';
import type { KitModuleFacts } from './kit-module.js';

// Same pragmatic typing stance as component-parse.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/** Exported names whose function bodies run on the server per request (SvelteKit's contract). */
const HANDLER_NAMES = new Set([
  'load',
  'handle',
  'handleFetch',
  'handleError',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'fallback'
]);

/** Unwrap TS wrapper expressions (`x satisfies T`, `x as T`) to the underlying expression. */
function unwrapTs(expr: Node): Node {
  let cur = expr;
  while (cur?.type === 'TSSatisfiesExpression' || cur?.type === 'TSAsExpression') cur = cur.expression;
  return cur;
}

function isFunctionNode(n: Node): boolean {
  return n?.type === 'FunctionDeclaration' || n?.type === 'FunctionExpression' || n?.type === 'ArrowFunctionExpression';
}

/**
 * The function nodes of this file's server-executed entry points: exported
 * `load`/HTTP-method/hooks handlers (function or arrow, `satisfies` unwrapped) and
 * every member of `export const actions = { … }`. A handler assigned a non-function
 * expression (e.g. `export const handle = sequence(...)`) is skipped — conservative.
 */
function collectHandlerFunctions(program: Node): Set<Node> {
  const handlers = new Set<Node>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue;
    const decl = stmt.declaration;
    if (decl.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier' && HANDLER_NAMES.has(decl.id.name)) {
      handlers.add(decl);
      continue;
    }
    if (decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || !d.init) continue;
      const init = unwrapTs(d.init);
      if (HANDLER_NAMES.has(d.id.name) && isFunctionNode(init)) {
        handlers.add(init);
      } else if (d.id.name === 'actions' && init?.type === 'ObjectExpression') {
        for (const p of init.properties ?? []) {
          if (p?.type !== 'Property') continue;
          const v = unwrapTs(p.value);
          if (isFunctionNode(v)) handlers.add(v);
        }
      }
    }
  }
  return handlers;
}

/**
 * Walk the whole program threading (1) shadowed names (like component-parse's
 * `walkScoped`), (2) whether the CURRENT node sits inside any function body, and
 * (3) whether that function chain includes a server handler. Class bodies count as
 * function depth — their methods run when called, not at module evaluation.
 */
function walkKit(
  node: Node,
  handlerFns: Set<Node>,
  visit: (n: Node, shadowed: Set<string>, inFunction: boolean, inHandler: boolean) => void,
  shadowed: Set<string> = new Set(),
  inFunction = false,
  inHandler = false
): void {
  if (Array.isArray(node)) {
    for (const child of node) walkKit(child, handlerFns, visit, shadowed, inFunction, inHandler);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;

  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  const isBoundary = isFunctionNode(node) || node.type === 'ClassDeclaration' || node.type === 'ClassExpression';
  const nextInFunction = inFunction || isBoundary;
  const nextInHandler = inHandler || handlerFns.has(node);

  visit(node, scope, inFunction, inHandler);
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    walkKit(node[key], handlerFns, visit, scope, nextInFunction, nextInHandler);
  }
}

/**
 * Parse one SvelteKit route/hooks file's SSR shared-state facts (SEC003–005). Uses
 * the shared wrap parser (`parseModuleProgram`), so reported lines subtract the
 * 1-line wrap prefix; suppressions are scanned on the unwrapped source.
 */
export function parseKitModuleFacts(source: string, filename: string): Omit<KitModuleFacts, 'file' | 'kind'> {
  const suppressions = collectSuppressions(source);
  const { program, wrapped } = parseModuleProgram(source, filename);
  const moduleStateReassignments: KitModuleFacts['moduleStateReassignments'] = [];
  const importedStateWrites: KitModuleFacts['importedStateWrites'] = [];
  const importedStateWritesOutsideHandlers: KitModuleFacts['importedStateWritesOutsideHandlers'] = [];
  const runesModuleImports: KitModuleFacts['runesModuleImports'] = [];
  if (!program) {
    return {
      moduleStateReassignments,
      importedStateWrites,
      importedStateWritesOutsideHandlers,
      runesModuleImports,
      suppressions
    };
  }
  const line = (start: number) => Math.max(0, lineOf(wrapped, start) - 1);

  // Module-scope let/var bindings (top-level, export-unwrapped) — SEC004's targets.
  const moduleLets = new Set<string>();
  for (const stmt of program.body ?? []) {
    const decl = unwrapExport(stmt);
    if (decl?.type === 'VariableDeclaration' && (decl.kind === 'let' || decl.kind === 'var')) {
      for (const d of decl.declarations ?? []) addBoundNames(d?.id, moduleLets);
    }
  }

  const handlerFns = collectHandlerFunctions(program);
  walkKit(program, handlerFns, (n, shadowed, inFunction, inHandler) => {
    if (!inFunction) return; // top-level reassignment is initialisation, not shared-state mutation
    const flagLet = (name: string | undefined) => {
      if (name && !shadowed.has(name) && moduleLets.has(name)) {
        moduleStateReassignments.push({ name, line: line(n.start), inHandler });
      }
    };
    if (n.type === 'AssignmentExpression') {
      if (n.left?.type === 'Identifier') flagLet(n.left.name);
      else if (n.left?.type === 'ObjectPattern' || n.left?.type === 'ArrayPattern') {
        const bound = new Set<string>();
        addBoundNames(n.left, bound);
        for (const b of bound) flagLet(b);
      }
    } else if (n.type === 'UpdateExpression' && n.argument?.type === 'Identifier') {
      flagLet(n.argument.name);
    }
  });

  return {
    moduleStateReassignments,
    importedStateWrites,
    importedStateWritesOutsideHandlers,
    runesModuleImports,
    suppressions
  };
}
```

(`rootObjectName` is imported now but used from Task 3 — if the linter complains about the unused import, defer that import line to Task 3.)

- [ ] **Step 5: Run to verify Task 2 tests pass**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-parse`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @svelte-vitals/core typecheck && pnpm --filter @svelte-vitals/core test`

```bash
git add packages/core
git commit -m "feat(core): parse Kit route files for module-scope reassignment facts (SEC004)"
```

---

### Task 3: Parser part 2 — imported-binding writes + runes-module import resolution

**Files:**

- Modify: `packages/core/src/kit-module-parse.ts`
- Modify: `packages/core/test/kit-module-parse.test.ts` (new describes)

**Interfaces:**

- Produces: populated `importedStateWrites` / `importedStateWritesOutsideHandlers` / `runesModuleImports`; exported `resolveRunesModuleSpecifier(spec: string, importerFile: string): string | undefined` (Task 4's collect tests and Task 6's docs reference it conceptually; the export makes it unit-testable).

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/kit-module-parse.test.ts` (add `resolveRunesModuleSpecifier` to the import):

```ts
describe('parseKitModuleFacts — imported-state writes (SEC003/SEC005)', () => {
  it('flags the docs NEVER example: store.set inside load', () => {
    const src =
      "import { user } from '$lib/user';\nexport async function load({ fetch }) {\n  user.set(await (await fetch('/api/user')).json());\n}";
    expect(facts(src).importedStateWrites).toEqual([{ name: 'user', line: 3, via: 'set-call' }]);
  });
  it('flags property assignment, update, delete, and namespace-import writes in handlers', () => {
    const src = [
      "import { state } from './shared.js';",
      "import * as s from './other.js';",
      'export const actions = {',
      '  default: async () => {',
      '    state.user = 1;',
      '    state.count++;',
      '    delete state.tmp;',
      '    s.flag = true;',
      '  }',
      '};'
    ].join('\n');
    expect(facts(src).importedStateWrites).toEqual([
      { name: 'state', line: 5, via: 'assignment' },
      { name: 'state', line: 6, via: 'assignment' },
      { name: 'state', line: 7, via: 'assignment' },
      { name: 's', line: 8, via: 'assignment' }
    ]);
  });
  it('records writes outside handlers separately (top level and helper functions)', () => {
    const src =
      "import { theme } from './theme.svelte.js';\ntheme.mode = 'dark';\nfunction reset() {\n  theme.update((t) => t);\n}";
    const f = facts(src);
    expect(f.importedStateWrites).toEqual([]);
    expect(f.importedStateWritesOutsideHandlers).toEqual([
      { name: 'theme', line: 2 },
      { name: 'theme', line: 4 }
    ]);
  });
  it('does not flag reads, non-set method calls, local shadows, or writes to non-imports', () => {
    const src = [
      "import { logger, data } from './svc.js';",
      'export function load() {',
      '  logger.info(data.value);',
      '  const data2 = { x: 1 };',
      '  data2.x = 2;',
      '  const data3 = (d) => { d.set(1); };',
      '  data3(new Map());',
      '}'
    ].join('\n');
    const f = facts(src);
    expect(f.importedStateWrites).toEqual([]);
    expect(f.importedStateWritesOutsideHandlers).toEqual([]);
  });
});

describe('parseKitModuleFacts — runes-module imports (SEC005)', () => {
  it('resolves $lib and relative specifiers to repo-relative .svelte.ts paths', () => {
    const src =
      "import { quizState } from '$lib/quiz.svelte.js';\nimport { other } from '../store.svelte.ts';\nimport type { T } from '$lib/types.svelte.ts';\nimport pkg from 'some-pkg';";
    const f = facts(src, 'src/routes/deep/+page.server.ts');
    expect(f.runesModuleImports).toEqual([
      { source: '$lib/quiz.svelte.js', resolved: 'src/lib/quiz.svelte.js', names: ['quizState'], line: 1 },
      { source: '../store.svelte.ts', resolved: 'src/routes/store.svelte.ts', names: ['other'], line: 2 }
    ]);
  });
  it('canonicalises an extensionless .svelte specifier to .svelte.ts', () => {
    expect(resolveRunesModuleSpecifier('$lib/store.svelte', 'src/routes/+page.ts')).toBe('src/lib/store.svelte.ts');
    expect(resolveRunesModuleSpecifier('./a/../b.svelte.js', 'src/routes/x/+page.ts')).toBe('src/routes/x/b.svelte.js');
    expect(resolveRunesModuleSpecifier('$lib/util.ts', 'src/routes/+page.ts')).toBeUndefined();
    expect(resolveRunesModuleSpecifier('some-pkg', 'src/routes/+page.ts')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-parse`
Expected: FAIL — the new arrays stay empty / `resolveRunesModuleSpecifier` not exported.

- [ ] **Step 3: Implement**

In `packages/core/src/kit-module-parse.ts`:

1. Add the resolver (above `parseKitModuleFacts`):

```ts
/** Normalize a posix path, resolving `.` and `..` segments — string-only, no I/O. */
function normalizePosix(path: string): string {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

/**
 * Resolve an import specifier to a repo-relative `.svelte.ts`/`.svelte.js` path, or
 * undefined when it cannot be a runes module: `$lib/` maps to `src/lib/`, `./`/`../`
 * resolve against the importing file's directory; bare packages and other aliases are
 * skipped. An extensionless `…/x.svelte` specifier canonicalises to `….svelte.ts`
 * (SEC005 also tries the `.js` sibling when matching).
 */
export function resolveRunesModuleSpecifier(spec: string, importerFile: string): string | undefined {
  let path: string;
  if (spec.startsWith('$lib/')) path = `src/lib/${spec.slice('$lib/'.length)}`;
  else if (spec.startsWith('./') || spec.startsWith('../')) {
    const dir = importerFile.split('/').slice(0, -1).join('/');
    path = `${dir}/${spec}`;
  } else return undefined;
  path = normalizePosix(path);
  if (/\.svelte\.(ts|js)$/.test(path)) return path;
  if (path.endsWith('.svelte')) return `${path}.ts`;
  return undefined;
}
```

2. In `parseKitModuleFacts`, after the `line` helper, collect imports:

```ts
// Imported value bindings (type-only skipped): local name → declared, plus the
// subset whose specifier resolves to a repo-local runes module (SEC005).
const importedNames = new Set<string>();
for (const stmt of program.body ?? []) {
  if (stmt?.type !== 'ImportDeclaration' || stmt.importKind === 'type') continue;
  const names: string[] = [];
  for (const s of stmt.specifiers ?? []) {
    if (s?.importKind === 'type' || s?.local?.type !== 'Identifier') continue;
    names.push(s.local.name);
    importedNames.add(s.local.name);
  }
  if (names.length === 0) continue;
  const spec = typeof stmt.source?.value === 'string' ? stmt.source.value : '';
  const resolved = resolveRunesModuleSpecifier(spec, filename);
  if (resolved) runesModuleImports.push({ source: spec, resolved, names, line: line(stmt.start) });
}
```

3. Extend the `walkKit` visitor: after the SEC004 block (note the SEC004 block early-returns on `!inFunction` — restructure so the imported-write detection below runs for ALL nodes, including top level):

```ts
// SEC003 / SEC005 — a write whose root binding is an import.
let write: { name: string; via: 'assignment' | 'set-call' } | undefined;
const importedRoot = (expr: Node): string | undefined => {
  const r = rootObjectName(expr);
  return r && !shadowed.has(r) && importedNames.has(r) ? r : undefined;
};
if (n.type === 'AssignmentExpression' && n.left?.type === 'MemberExpression') {
  const r = importedRoot(n.left);
  if (r) write = { name: r, via: 'assignment' };
} else if (n.type === 'UpdateExpression' && n.argument?.type === 'MemberExpression') {
  const r = importedRoot(n.argument);
  if (r) write = { name: r, via: 'assignment' };
} else if (n.type === 'UnaryExpression' && n.operator === 'delete') {
  const r = importedRoot(n.argument);
  if (r) write = { name: r, via: 'assignment' };
} else if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression') {
  const method = n.callee.property?.type === 'Identifier' ? n.callee.property.name : undefined;
  if (method === 'set' || method === 'update') {
    const r = importedRoot(n.callee.object);
    if (r) write = { name: r, via: 'set-call' };
  }
} else if (n.type === 'AssignmentExpression' && (n.left?.type === 'ObjectPattern' || n.left?.type === 'ArrayPattern')) {
  // Destructuring-assignment targets: `[state.x] = arr`, `({ a: state.y } = obj)` —
  // scan the pattern for MemberExpression targets whose root is an import.
  walkKit(n.left, handlerFns, (t) => {
    if (t.type === 'MemberExpression' && !write) {
      const r = importedRoot(t);
      if (r) write = { name: r, via: 'assignment' };
    }
  });
}
if (write) {
  if (inHandler) importedStateWrites.push({ ...write, line: line(n.start) });
  else importedStateWritesOutsideHandlers.push({ name: write.name, line: line(n.start) });
}
```

- [ ] **Step 4: Run to verify all parser tests pass, then commit**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-parse && pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS.

```bash
git add packages/core
git commit -m "feat(core): parse imported-state writes and runes-module imports in Kit files (SEC003/SEC005)"
```

---

### Task 4: Collector + `RuleContext.kitModules` + CLI/vite wiring

**Files:**

- Create: `packages/core/src/kit-module-collect.ts`
- Modify: `packages/core/src/rule.ts` (RuleContext), `packages/core/src/index.ts` (exports)
- Modify: `packages/cli/src/index.ts` (~line 212 context assembly)
- Modify: `packages/vite/src/providers/source/components.ts`, `packages/vite/src/analyze.ts`
- Create: `packages/core/test/kit-module-collect.test.ts`

**Interfaces:**

- Consumes: `parseKitModuleFacts` (Task 2–3), `Runtime`.
- Produces: `collectKitModuleFacts(rt: Runtime, cwd: string): Promise<KitModuleFacts[]>`, `emptyKitModuleFacts(file, kind)`, `RuleContext.kitModules?: KitModuleFacts[]`; core index exports `collectKitModuleFacts`, `emptyKitModuleFacts`, `parseKitModuleFacts`, `resolveRunesModuleSpecifier`, `type KitModuleFacts`.

- [ ] **Step 1: Write the failing collect tests**

Create `packages/core/test/kit-module-collect.test.ts` (mirror `component-collect.test.ts`'s memory runtime):

```ts
import { describe, it, expect } from 'vitest';
import type { Runtime } from '../src/runtime.js';
import { collectKitModuleFacts, emptyKitModuleFacts } from '../src/kit-module-collect.js';

function createMemoryRuntime(files: Record<string, string>, unreadable: Set<string> = new Set()): Runtime {
  const map = new Map(Object.entries(files));
  return {
    async readFile(path) {
      if (unreadable.has(path)) throw new Error(`EACCES: ${path}`);
      const content = map.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    async exists(path) {
      return map.has(path);
    },
    async glob(pattern) {
      const rx = new RegExp(
        '^' +
          pattern
            .replace(/[.+^$()|[\]\\]/g, '\\$&')
            .replace(/\{([^}]+)\}/g, (_, alts: string) => `(${alts.split(',').join('|')})`)
            .replace(/\*\*\//g, '(.*/)?')
            .replace(/\*/g, '[^/]*') +
          '$'
      );
      return [...map.keys()].filter((k) => rx.test(k));
    },
    join(...parts) {
      return parts.filter((p) => p.length > 0).join('/');
    }
  };
}

describe('collectKitModuleFacts', () => {
  it('collects route server/universal files, +server endpoints, and hooks with kinds', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.server.ts': 'let user;\nexport function load() {\n  user = 1;\n}',
      'src/routes/about/+page.ts': 'export const load = () => ({});',
      'src/routes/api/+server.js': 'export function GET() {}',
      'src/hooks.server.ts': 'export const handle = ({ event, resolve }) => resolve(event);',
      'src/routes/+page.svelte': '<p>not collected</p>',
      'src/lib/server/db.ts': 'let conn;\nexport function get() {\n  conn = 1;\n}'
    });
    const facts = await collectKitModuleFacts(rt, '');
    expect(facts.map((f) => [f.file, f.kind])).toEqual([
      ['src/hooks.server.ts', 'server'],
      ['src/routes/+page.server.ts', 'server'],
      ['src/routes/about/+page.ts', 'universal'],
      ['src/routes/api/+server.js', 'server']
    ]);
    expect(facts[1]!.moduleStateReassignments).toEqual([{ name: 'user', line: 3, inHandler: true }]);
  });
  it('falls back to empty facts when a file fails to read', async () => {
    const rt = createMemoryRuntime({ 'src/routes/+page.server.ts': 'let x;' }, new Set(['src/routes/+page.server.ts']));
    expect(await collectKitModuleFacts(rt, '')).toEqual([emptyKitModuleFacts('src/routes/+page.server.ts', 'server')]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-collect`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the collector**

Create `packages/core/src/kit-module-collect.ts`:

```ts
import { parseKitModuleFacts } from './kit-module-parse.js';
import type { KitModuleFacts } from './kit-module.js';
import type { Runtime } from './runtime.js';

/** Fallback facts for a Kit file that fails to read or parse (dev tooling must never throw). */
export function emptyKitModuleFacts(file: string, kind: KitModuleFacts['kind']): KitModuleFacts {
  return {
    file,
    kind,
    moduleStateReassignments: [],
    importedStateWrites: [],
    importedStateWritesOutsideHandlers: [],
    runesModuleImports: [],
    suppressions: []
  };
}

/** 'server' when the file only ever runs on the server; 'universal' for +page.ts/+layout.ts. */
function kindOf(file: string): KitModuleFacts['kind'] {
  const base = file.split('/').pop() ?? file;
  return base.includes('.server.') || base.startsWith('+server.') ? 'server' : 'universal';
}

/**
 * Scan SvelteKit route/hooks files for SSR shared-state facts (SEC003–005): route
 * `+page`/`+layout` server and universal modules, `+server` endpoints, and
 * `src/hooks.server`. `src/lib/server/**` is deliberately NOT scanned — legitimate
 * module singletons (DB connections, clients) live there (design). A file that
 * fails to read or parse contributes empty facts instead of aborting the scan.
 */
export async function collectKitModuleFacts(rt: Runtime, cwd: string): Promise<KitModuleFacts[]> {
  const patterns = [
    'src/routes/**/+{page,layout}.server.{ts,js}',
    'src/routes/**/+{page,layout}.{ts,js}',
    'src/routes/**/+server.{ts,js}',
    'src/hooks.server.{ts,js}'
  ];
  const lists = await Promise.all(patterns.map((p) => rt.glob(p, cwd)));
  const files = [...new Set(lists.flat())];
  return Promise.all(
    files.sort().map(async (rel): Promise<KitModuleFacts> => {
      const kind = kindOf(rel);
      try {
        const source = await rt.readFile(rt.join(cwd, rel));
        return { file: rel, kind, ...parseKitModuleFacts(source, rel) };
      } catch {
        return emptyKitModuleFacts(rel, kind);
      }
    })
  );
}
```

- [ ] **Step 4: RuleContext + core exports**

In `packages/core/src/rule.ts`: add `import type { KitModuleFacts } from './kit-module.js';` and, after the `components?` field in `RuleContext`:

```ts
/** Per-file SvelteKit route/hooks facts for the SSR shared-state rules (static/CLI + vite build mode only). */
kitModules?: KitModuleFacts[];
```

In `packages/core/src/index.ts`, next to the component exports (the block around line 16-18 that exports `parseComponentFacts` / `collectComponentFacts`):

```ts
export type { KitModuleFacts } from './kit-module.js';
export { parseKitModuleFacts, resolveRunesModuleSpecifier } from './kit-module-parse.js';
export { collectKitModuleFacts, emptyKitModuleFacts } from './kit-module-collect.js';
```

- [ ] **Step 5: Wire the CLI and vite**

`packages/cli/src/index.ts`: add `collectKitModuleFacts` to the existing `@svelte-vitals/core` import list; below the `components` line (~212):

```ts
const kitModules = opts.route ? [] : await collectKitModuleFacts(rt, cwd);
```

and add `kitModules` to the `runRules(rules, { heads, images, headings, components, project, config })` context object.

`packages/vite/src/providers/source/components.ts`: extend line 4's import to `import { collectComponentFacts as collect, collectKitModuleFacts as collectKit, type ComponentFacts, type KitModuleFacts, type Runtime } from '@svelte-vitals/core';` and append:

```ts
/** Scan SvelteKit route/hooks files for SSR shared-state facts (SEC003–005, build mode only). */
export function collectKitModuleFacts(root: string): Promise<KitModuleFacts[]> {
  return collectKit(nodeRuntime, root);
}
```

`packages/vite/src/analyze.ts`: import `collectKitModuleFacts` from `./providers/source/components.js` (line 20's import), add below line 62:

```ts
const kitModules = await collectKitModuleFacts(cwd);
```

and add `kitModules` to the `runRules(...)` context object.

- [ ] **Step 6: Run tests + commit**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core build && pnpm test`
Expected: PASS across all packages (the new context field is optional — no rule reads it yet).

```bash
git add packages/core packages/cli packages/vite
git commit -m "feat(core): collect Kit route/hooks module facts and expose ctx.kitModules"
```

---

### Task 5: `kitModuleRule` factory + SEC003 + SEC004

**Files:**

- Create: `packages/core/src/rules/kit-module-rule.ts`
- Create: `packages/core/src/rules/security/sec003-load-state-write.ts`, `packages/core/src/rules/security/sec004-server-module-state.ts`
- Modify: `packages/core/src/rules/index.ts` (import after line 44; `allRules` after line 95; re-export after line 148), `packages/core/src/index.ts` (re-export after line 98)
- Create: `packages/core/test/security-kit-rules.test.ts`

**Interfaces:**

- Consumes: `KitModuleFacts`, `RuleContext.kitModules` (Task 4), `docsUrlFor`, `Result`/`Severity` types.
- Produces: `kitModuleRule(opts)` factory (Task 6 reuses it) with `applies/bad: (m: KitModuleFacts, ctx: RuleContext) => …`; exported `sec003LoadStateWrite`, `sec004ServerModuleState`.

- [ ] **Step 1: Write the failing rule tests**

Create `packages/core/test/security-kit-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sec003LoadStateWrite, sec004ServerModuleState } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { KitModuleFacts } from '../src/kit-module.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/types.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (kitModules: KitModuleFacts[], over: Partial<RuleContext> = {}): RuleContext => ({
  kitModules,
  ...base,
  ...over
});
const kit = (over: Partial<KitModuleFacts>): KitModuleFacts => ({
  file: 'src/routes/+page.server.ts',
  kind: 'server',
  moduleStateReassignments: [],
  importedStateWrites: [],
  importedStateWritesOutsideHandlers: [],
  runesModuleImports: [],
  suppressions: [],
  ...over
});

describe('SEC003 handler writes imported state', () => {
  it('flags a handler write as critical', async () => {
    const rs = await sec003LoadStateWrite.check(
      ctx([kit({ importedStateWrites: [{ name: 'user', line: 3, via: 'set-call' }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('critical');
    expect(rs[0]!.category).toBe('security');
    expect(rs[0]!.route).toBe('src/routes/+page.server.ts');
    expect(rs[0]!.line).toBe(3);
    expect(rs[0]!.message).toContain('"user"');
  });
  it('emits nothing without signal and in rendered mode', async () => {
    expect(await sec003LoadStateWrite.check(ctx([kit({})]))).toHaveLength(0);
    expect(await sec003LoadStateWrite.check(base as RuleContext)).toHaveLength(0);
  });
  it('is silenced by an inline suppression', async () => {
    const rs = await sec003LoadStateWrite.check(
      ctx([
        kit({
          importedStateWrites: [{ name: 'user', line: 3, via: 'assignment' }],
          suppressions: [{ line: 3, ruleIds: ['SEC003'] }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('SEC004 server module-scope state', () => {
  it('flags a handler reassignment as warning with the handler message', async () => {
    const rs = await sec004ServerModuleState.check(
      ctx([kit({ moduleStateReassignments: [{ name: 'user', line: 8, inHandler: true }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.message).toContain('request handler');
  });
  it('uses the softer message for helper-function reassignment', async () => {
    const rs = await sec004ServerModuleState.check(
      ctx([kit({ moduleStateReassignments: [{ name: 'last', line: 3, inHandler: false }] })])
    );
    expect(fails(rs)[0]!.message).toContain('from a function');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- security-kit-rules`
Expected: FAIL — exports do not exist.

- [ ] **Step 3: Implement the factory**

Create `packages/core/src/rules/kit-module-rule.ts`:

```ts
import type { Result, Severity } from '../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../rule.js';
import type { KitModuleFacts } from '../kit-module.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

/** An offending occurrence in a Kit route/hooks file (line + human message). */
export interface KitModuleIssue {
  line: number;
  message: string;
}

export interface KitModuleRuleOptions {
  id: string;
  title: string;
  /** The SSR shared-state rules are Security rules. */
  category: 'security';
  /** Default 'warning'. */
  severity?: Severity;
  /** Pass message / category label. */
  label: string;
  recommendation: string;
  rationale: string;
  /** Whether this file carries the signal at all (no signal → emit nothing for the file). */
  applies: (m: KitModuleFacts, ctx: RuleContext) => boolean;
  /** The offending occurrences (empty → the file passes). `ctx` lets SEC005 read ctx.components. */
  bad: (m: KitModuleFacts, ctx: RuleContext) => KitModuleIssue[];
}

/** Whether `ruleId`'s finding on `line` is silenced by an inline directive in this file. */
function isSuppressed(m: KitModuleFacts, ruleId: string, line: number): boolean {
  return (m.suppressions ?? []).some((s) => s.line === line && (!s.ruleIds || s.ruleIds.includes(ruleId)));
}

/**
 * Build a Kit-module-scoped rule (SEC003–005) over `ctx.kitModules`. Static/CLI and
 * vite build mode only — `ctx.kitModules` is unset in rendered mode, so it emits
 * nothing there. Findings use the source file as the scoring unit.
 */
export function kitModuleRule(opts: KitModuleRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  const severity = opts.severity ?? 'warning';
  return {
    id: opts.id,
    title: opts.title,
    category: opts.category,
    severity,
    scope: 'component',
    rationale: opts.rationale,
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const m of ctx.kitModules ?? []) {
        if (!opts.applies(m, ctx)) continue;
        const bad = opts.bad(m, ctx).filter((b) => !(b.line > 0 && isSuppressed(m, opts.id, b.line)));
        if (bad.length === 0) {
          out.push({
            id: opts.id,
            category: opts.category,
            severity,
            detection: PASS,
            route: m.file,
            message: opts.label,
            recommendation: opts.recommendation,
            docsUrl
          });
          continue;
        }
        for (const b of bad) {
          out.push({
            id: opts.id,
            category: opts.category,
            severity,
            detection: PENALIZED,
            route: m.file,
            location: m.file,
            ...(b.line > 0 ? { line: b.line } : {}),
            message: b.message,
            recommendation: opts.recommendation,
            docsUrl
          });
        }
      }
      return out;
    }
  };
}
```

- [ ] **Step 4: Implement SEC003 and SEC004**

Create `packages/core/src/rules/security/sec003-load-state-write.ts`:

```ts
import { kitModuleRule } from '../kit-module-rule.js';

export const sec003LoadStateWrite = kitModuleRule({
  id: 'SEC003',
  title: 'Handler writes imported state',
  category: 'security',
  severity: 'critical',
  label: 'Load/handler purity',
  recommendation:
    'Return the data from load (or the action) and pass it via page data instead of writing it to module state; per-user data belongs in cookies/locals plus a database.',
  rationale:
    "SvelteKit's docs mark this NEVER-DO-THIS: the server is one long-lived process shared by every user, so module state written during a request is visible to ALL later requests — one user's data can be served to another.",
  applies: (m) => m.importedStateWrites.length > 0,
  bad: (m) =>
    m.importedStateWrites.map((w) => ({
      line: w.line,
      message: `a server-executed handler writes imported module state "${w.name}" — shared across all requests on the server, one user's data can leak to another`
    }))
});
```

Create `packages/core/src/rules/security/sec004-server-module-state.ts`:

```ts
import { kitModuleRule } from '../kit-module-rule.js';

export const sec004ServerModuleState = kitModuleRule({
  id: 'SEC004',
  title: 'Server module-scope state',
  category: 'security',
  label: 'Server module state',
  recommendation:
    'Do not keep request data in module scope on the server — authenticate with cookies/locals and persist per-user data in a database. For a deliberate process-wide cache, prefer a const container (e.g. a Map) or add an inline suppression.',
  rationale:
    'Module scope on the server is one shared, long-lived instance (SvelteKit docs: "Avoid shared state on the server"): a value reassigned during one user\'s request is served to every other user, and it silently resets on every deploy or restart.',
  applies: (m) => m.moduleStateReassignments.length > 0,
  bad: (m) =>
    m.moduleStateReassignments.map((r) => ({
      line: r.line,
      message: r.inHandler
        ? `module-scope variable "${r.name}" is reassigned from a request handler — its value is shared across all requests on the server`
        : `module-scope variable "${r.name}" is reassigned from a function — if it runs during a request, the value is shared across all requests on the server`
    }))
});
```

- [ ] **Step 5: Register (four sites)**

1. `packages/core/src/rules/index.ts` after line 44:

```ts
import { sec003LoadStateWrite } from './security/sec003-load-state-write.js';
import { sec004ServerModuleState } from './security/sec004-server-module-state.js';
```

2. Same file, `allRules` after `sec002JavascriptUrl,` (line 95): `sec003LoadStateWrite,` and `sec004ServerModuleState,`
3. Same file, re-export block after line 148: same two names.
4. `packages/core/src/index.ts` after `sec002JavascriptUrl,` (line 98): same two names.

Verify: `grep -rn "sec003LoadStateWrite\|sec004ServerModuleState" packages/core/src` → 5 hits each (rule file + 3 + 1).

- [ ] **Step 6: Run to verify, then commit**

Run: `pnpm --filter @svelte-vitals/core test -- security-kit-rules && pnpm --filter @svelte-vitals/core test`
Expected: security-kit-rules PASS; full core suite passes EXCEPT `packages/cli/test/docs-links.test.ts` is a CLI test — expect it to FAIL only after `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals test` (missing sec003/sec004 docs pages — Task 7). Anything else failing must be fixed first.

```bash
git add packages/core
git commit -m "feat(core): add SEC003/SEC004 — SSR shared-state writes in Kit server files"
```

---

### Task 6: SEC005 — shared runes-state import

**Files:**

- Create: `packages/core/src/rules/security/sec005-shared-state-import.ts`
- Modify: `packages/core/src/rules/index.ts` (3 spots), `packages/core/src/index.ts` (1 spot)
- Modify: `packages/core/test/security-kit-rules.test.ts`

**Interfaces:**

- Consumes: `kitModuleRule` (Task 5), `KitModuleFacts.runesModuleImports` / `importedStateWrites*` (Task 3), `ComponentFacts.moduleStateDecls` (Task 1) via `ctx.components`.
- Produces: exported `sec005SharedStateImport`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/security-kit-rules.test.ts` — add `sec005SharedStateImport` to the `../src/index.js` import and `import type { ComponentFacts } from '../src/component.js';`, plus a component helper:

```ts
const stateModule = (file: string): ComponentFacts => ({
  file,
  eachBlocks: [],
  effects: [],
  htmlTags: [],
  javascriptUrls: [],
  loc: 0,
  propCount: 0,
  imports: [],
  importSpans: [],
  namespaceImports: [],
  constableStates: [],
  mutatedProps: [],
  orphanEffects: [],
  moduleStateDecls: [{ name: 'user', line: 1 }],
  suppressions: []
});

describe('SEC005 shared runes-state import on the server', () => {
  const imp = { source: '$lib/quiz.svelte.js', resolved: 'src/lib/quiz.svelte.js', names: ['quizState'], line: 1 };

  it('flags a read-only import of a module-scope $state module (stale/boot-time message)', async () => {
    const rs = await sec005SharedStateImport.check(
      ctx([kit({ runesModuleImports: [imp] })], { components: [stateModule('src/lib/quiz.svelte.js')] })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.line).toBe(1);
    expect(rs[0]!.message).toContain('boot-time');
  });
  it('uses the mutation message when the binding is written outside handlers', async () => {
    const rs = await sec005SharedStateImport.check(
      ctx(
        [
          kit({
            runesModuleImports: [imp],
            importedStateWritesOutsideHandlers: [{ name: 'quizState', line: 5 }]
          })
        ],
        { components: [stateModule('src/lib/quiz.svelte.js')] }
      )
    );
    expect(fails(rs)[0]!.message).toContain('mutates');
  });
  it('matches the .svelte.ts sibling of a .js-resolved import', async () => {
    const rs = await sec005SharedStateImport.check(
      ctx([kit({ runesModuleImports: [imp] })], { components: [stateModule('src/lib/quiz.svelte.ts')] })
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('does not double-report a binding already flagged by SEC003, and skips non-state modules', async () => {
    const covered = await sec005SharedStateImport.check(
      ctx(
        [
          kit({
            runesModuleImports: [imp],
            importedStateWrites: [{ name: 'quizState', line: 5, via: 'set-call' }]
          })
        ],
        { components: [stateModule('src/lib/quiz.svelte.js')] }
      )
    );
    expect(fails(covered)).toHaveLength(0);
    const noState = await sec005SharedStateImport.check(
      ctx([kit({ runesModuleImports: [imp] })], {
        components: [{ ...stateModule('src/lib/quiz.svelte.js'), moduleStateDecls: [] }]
      })
    );
    expect(fails(noState)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- security-kit-rules`
Expected: FAIL — `sec005SharedStateImport` not exported.

- [ ] **Step 3: Implement**

Create `packages/core/src/rules/security/sec005-shared-state-import.ts`:

```ts
import { kitModuleRule, type KitModuleIssue } from '../kit-module-rule.js';

/** The `.svelte.ts` ↔ `.svelte.js` sibling of a resolved runes-module path. */
function extSibling(path: string): string {
  return path.endsWith('.svelte.ts')
    ? path.replace(/\.svelte\.ts$/, '.svelte.js')
    : path.replace(/\.svelte\.js$/, '.svelte.ts');
}

export const sec005SharedStateImport = kitModuleRule({
  id: 'SEC005',
  title: 'Shared runes-state import on the server',
  category: 'security',
  label: 'Server state imports',
  recommendation:
    'Keep module-scope $state out of server-executed code: return data from load and share it via page data or the context API. If the module is genuinely client-only, restructure so server files do not import it, or add an inline suppression.',
  rationale:
    'A .svelte.ts module with module-scope $state is one shared instance on the server: mutated, it leaks data between users; read-only, every request sees the same boot-time value instead of per-user data.',
  applies: (m) => m.runesModuleImports.length > 0,
  bad: (m, ctx) => {
    const stateFiles = new Set((ctx.components ?? []).filter((c) => c.moduleStateDecls.length > 0).map((c) => c.file));
    const writtenOutside = new Set(m.importedStateWritesOutsideHandlers.map((w) => w.name));
    const writtenInHandler = new Set(m.importedStateWrites.map((w) => w.name));
    const out: KitModuleIssue[] = [];
    for (const imp of m.runesModuleImports) {
      if (!stateFiles.has(imp.resolved) && !stateFiles.has(extSibling(imp.resolved))) continue;
      // A binding already reported (critical) by SEC003 is not double-reported here.
      const names = imp.names.filter((n) => !writtenInHandler.has(n));
      if (names.length === 0) continue;
      const mutates = names.some((n) => writtenOutside.has(n));
      out.push({
        line: imp.line,
        message: mutates
          ? `server-executed code mutates shared module state from "${imp.source}" — on the server it is one instance shared by every request`
          : `"${imp.source}" holds module-scope $state — on the server it is shared by every request and keeps its boot-time value (a leak if it ever holds per-user data)`
      });
    }
    return out;
  }
});
```

- [ ] **Step 4: Register (four sites)**

Same pattern as Task 5: import + `allRules` + re-export in `packages/core/src/rules/index.ts` (each directly after the SEC004 entries added in Task 5), and the re-export in `packages/core/src/index.ts`. Verify: `grep -rn "sec005SharedStateImport" packages/core/src` → 5 hits.

- [ ] **Step 5: Run to verify, then commit**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS (core).

```bash
git add packages/core
git commit -m "feat(core): add SEC005 — server import of a module-scope \$state runes module"
```

---

### Task 7: Docs (en/ja ×3), suppression-range update, changeset, full verification

**Files:**

- Create: `docs/src/content/docs/rules/sec003.md`, `sec004.md`, `sec005.md` and `docs/src/content/docs/ja/rules/sec003.md`, `sec004.md`, `sec005.md`
- Modify: `docs/src/content/docs/guides/cli.md:217`, `docs/src/content/docs/ja/guides/cli.md:215`
- Create: `.changeset/sec003-005-ssr-shared-state.md`

**Interfaces:**

- Consumes: rule ids SEC003–005 (docs-links test derives required pages from `allRules`).

- [ ] **Step 1: Write the six rule pages**

`docs/src/content/docs/rules/sec003.md`:

````md
---
title: SEC003 · Handler writes imported state
description: A load function or action writes to imported module state — shared across all requests on the server.
---

**Severity:** critical · **Category:** security

## What it checks

Flags writes to an **imported binding** from inside a server-executed handler — `load`, a form action, a `+server` HTTP handler, or a `hooks.server` handler: property assignment (`state.user = …`), increment/`delete`, and `.set(...)` / `.update(...)` calls. Universal `+page.ts`/`+layout.ts` load functions are included — they run on the server during SSR.

Reads, other method calls (`logger.info(…)`), and writes to local variables are not flagged.

## Why it matters

This is the pattern SvelteKit's state-management docs mark "NEVER DO THIS". The server is one long-lived process shared by every user: module state written during Alice's request is still there when Bob's request arrives — Bob can be served Alice's data. It works perfectly in single-user dev and corrupts silently in production.

## How to fix

Return the data instead of storing it:

```ts
// +page.ts
import { user } from '$lib/user';

export async function load({ fetch }) {
  const response = await fetch('/api/user');
  user.set(await response.json()); // ❌ shared across ALL requests on the server

  return { user: await response.json() }; // ✅ per-request page data
}
```

Per-user data belongs in cookies/`locals` plus a database; share loaded data with components via `page.data` or the context API.
````

`docs/src/content/docs/rules/sec004.md`:

````md
---
title: SEC004 · Server module-scope state
description: A module-scope variable in a Kit server file is reassigned from a function — shared across all requests.
---

**Severity:** warning · **Category:** security

## What it checks

Flags reassignment (`=`, `+=`, `??=`, `++`, …) of a **module-scope `let`/`var`** from inside a function in a SvelteKit route or hooks file (`+page(.server).ts`, `+layout(.server).ts`, `+server.ts`, `hooks.server.ts`). Reassignment directly from a request handler gets a stronger message than one in a helper function.

Not flagged: top-level initialisation, `const` bindings, and mutation-style caches (`const cache = new Map()` + `cache.set(…)`) — the latter is a deliberate memoisation pattern, though putting request-derived data in one carries the same risk. `src/lib/server/**` is not scanned (legitimate singletons live there).

## Why it matters

SvelteKit's docs: "Avoid shared state on the server." A module variable on the server is one instance shared by every user — if an action stores Alice's form data there, Bob's next request reads it. The value also silently resets whenever the process restarts.

## How to fix

```ts
// +page.server.ts
let user; // ❌ one variable for every user of this server

export const actions = {
  default: async ({ request, cookies, locals }) => {
    const data = await request.formData();
    user = { name: data.get('name') }; // ❌ NEVER DO THIS

    await db.saveUser(locals.session, data); // ✅ per-user persistence
  }
};
```

Authenticate with cookies/`locals` and persist per-user data to a database. For a deliberate process-wide cache, prefer a `const` container or add `// svelte-vitals-disable-next-line SEC004` above the assignment.
````

`docs/src/content/docs/rules/sec005.md`:

````md
---
title: SEC005 · Shared runes-state import on the server
description: A Kit server/universal file imports a .svelte.ts module holding module-scope $state — one shared instance per server process.
---

**Severity:** warning · **Category:** security

## What it checks

Flags an import in a SvelteKit route/hooks file whose specifier resolves to a repo-local `.svelte.ts`/`.svelte.js` module with **module-scope `$state`** (a top-level `$state(...)` declaration, or a module-scope instance of a class with `$state` fields). Two flavours:

- the server code **mutates** the imported state (outside handlers — handler writes are reported by SEC003 as critical), or
- the import is **read-only** — on the server the state is still one shared instance that keeps its boot-time value.

Direct imports only (`$lib/…` and relative specifiers); `import type` is excluded. Client-only usage of such modules — the idiomatic shared-store pattern — is fine and never flagged; only imports from server-executed files are.

## Why it matters

On the browser each user gets their own module instance; on the server there is exactly one, shared by every request. If it ever holds per-user data, users see each other's data; even if it doesn't, server reads see a stale boot-time value rather than what the current user's client sees.

## How to fix

Don't reach for shared module state in server-executed code — return data from `load` and pass it via `page.data` or the context API:

```ts
// +page.server.ts
import { quizState } from '$lib/quiz.svelte.js'; // ❌ one instance for all users on the server

export async function load({ locals }) {
  return { bookmarks: await db.bookmarksFor(locals.user) }; // ✅
}
```

If the module is genuinely client-only, restructure so server files don't import it — or, if the import is deliberate and safe, add `// svelte-vitals-disable-next-line SEC005` above it.
````

`docs/src/content/docs/ja/rules/sec003.md`:

````md
---
title: SEC003 · handler から import した状態への書き込み
description: load 関数や action が import したモジュール状態に書き込んでいます — サーバー上では全リクエストで共有されます。
---

**重大度:** critical · **カテゴリ:** security

## チェック内容

サーバーで実行される handler(`load`、form action、`+server` の HTTP handler、`hooks.server` の handler)の内部から、**import した binding** への書き込みを検出します — プロパティ代入(`state.user = …`)、インクリメント/`delete`、`.set(...)` / `.update(...)` 呼び出しが対象です。universal な `+page.ts`/`+layout.ts` の load も対象です — SSR 時はサーバーで実行されるためです。

読み取り、その他のメソッド呼び出し(`logger.info(…)`)、ローカル変数への書き込みは検出対象外です。

## 重要な理由

SvelteKit の状態管理ドキュメントが「NEVER DO THIS」と明記するパターンです。サーバーは全ユーザーが共有する長寿命の1プロセスです: Alice のリクエスト中に書き込まれたモジュール状態は、Bob のリクエストが来たときもそこに残っています — Bob に Alice のデータが配信され得ます。開発中(シングルユーザー)では完璧に動き、本番で静かに壊れます。

## 修正方法

保存せずにデータを返します:

```ts
// +page.ts
import { user } from '$lib/user';

export async function load({ fetch }) {
  const response = await fetch('/api/user');
  user.set(await response.json()); // ❌ サーバー上では全リクエストで共有される

  return { user: await response.json() }; // ✅ リクエストごとの page data
}
```

ユーザー別データは cookies/`locals` + データベースへ。load したデータは `page.data` か context API でコンポーネントに渡します。
````

`docs/src/content/docs/ja/rules/sec004.md`:

````md
---
title: SEC004 · サーバーのモジュールスコープ状態
description: Kit の server ファイルのモジュールスコープ変数が関数内から再代入されています — 全リクエストで共有されます。
---

**重大度:** warning · **カテゴリ:** security

## チェック内容

SvelteKit のルート/フックファイル(`+page(.server).ts`、`+layout(.server).ts`、`+server.ts`、`hooks.server.ts`)で、**モジュールスコープの `let`/`var`** への関数内からの再代入(`=`、`+=`、`??=`、`++` など)を検出します。request handler から直接の再代入は、ヘルパー関数内のものより強いメッセージになります。

検出対象外: トップレベルでの初期化、`const` の binding、変異型キャッシュ(`const cache = new Map()` + `cache.set(…)`)— 後者は意図的なメモ化パターンです(ただしリクエスト由来データを入れれば同じリスクがあります)。`src/lib/server/**` はスキャンしません(正当なシングルトンが置かれる場所のため)。

## 重要な理由

SvelteKit のドキュメントいわく「サーバーでの共有状態を避けよ」。サーバー上のモジュール変数は全ユーザー共有の1インスタンスです — action が Alice のフォームデータをそこへ入れれば、次の Bob のリクエストがそれを読みます。プロセス再起動のたびに値が静かに消える問題もあります。

## 修正方法

```ts
// +page.server.ts
let user; // ❌ このサーバーの全ユーザーで1つの変数

export const actions = {
  default: async ({ request, cookies, locals }) => {
    const data = await request.formData();
    user = { name: data.get('name') }; // ❌ NEVER DO THIS

    await db.saveUser(locals.session, data); // ✅ ユーザーごとの永続化
  }
};
```

cookies/`locals` で認証し、ユーザー別データはデータベースへ永続化します。意図的なプロセス全体キャッシュには `const` コンテナを使うか、代入行の直前に `// svelte-vitals-disable-next-line SEC004` を書いてください。
````

`docs/src/content/docs/ja/rules/sec005.md`:

````md
---
title: SEC005 · サーバーからの共有 runes 状態の import
description: Kit の server/universal ファイルが、モジュールスコープ $state を持つ .svelte.ts モジュールを import しています — サーバープロセスで1インスタンス共有です。
---

**重大度:** warning · **カテゴリ:** security

## チェック内容

SvelteKit のルート/フックファイル内の import のうち、参照先がリポジトリ内の `.svelte.ts`/`.svelte.js` モジュールで、**モジュールスコープの `$state`**(トップレベルの `$state(...)` 宣言、または `$state` フィールドを持つクラスのモジュールスコープインスタンス)を持つものを検出します。2つのフレーバーがあります:

- サーバーコードがその状態を**変異させている**(handler 外での書き込み — handler 内の書き込みは SEC003 が critical で報告します)
- **読み取り専用** — それでもサーバー上では起動時の値を保持し続ける全リクエスト共有の1インスタンスです

直接 import のみが対象です(`$lib/…` と相対パス)。`import type` は対象外。こうしたモジュールのクライアント専用での利用 — 慣用的な共有ストアパターン — は正当であり、決して検出されません。サーバーで実行されるファイルからの import だけが対象です。

## 重要な理由

ブラウザではユーザーごとに独自のモジュールインスタンスが作られますが、サーバーでは全リクエスト共有のちょうど1つです。ユーザー別データを入れればユーザー間でデータが見え合い、入れなくてもサーバー側の読み取りは現在のユーザーのクライアントと一致しない起動時の古い値になります。

## 修正方法

サーバーで実行されるコードで共有モジュール状態に頼らず、`load` からデータを返して `page.data` か context API で渡します:

```ts
// +page.server.ts
import { quizState } from '$lib/quiz.svelte.js'; // ❌ サーバー上では全ユーザーで1インスタンス

export async function load({ locals }) {
  return { bookmarks: await db.bookmarksFor(locals.user) }; // ✅
}
```

モジュールが本当にクライアント専用なら、server ファイルから import しない構造に変えます — import が意図的で安全なら、その直前に `// svelte-vitals-disable-next-line SEC005` を書いてください。
````

- [ ] **Step 2: Update the suppression range (en/ja)**

In `docs/src/content/docs/guides/cli.md` line 217 and `docs/src/content/docs/ja/guides/cli.md` line 215: change `SEC001–002` to `SEC001–005` (keep each file's existing dash character; nothing else on the line changes).

- [ ] **Step 3: Verify docs-links passes**

Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals test -- docs-links`
Expected: PASS.

- [ ] **Step 4: Add the changeset**

Create `.changeset/sec003-005-ssr-shared-state.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add SEC003–005: SSR shared-state leak detection for SvelteKit server/universal route files. SEC003 (critical) flags load/action/endpoint handlers writing to imported module state; SEC004 (warning) flags module-scope `let`/`var` reassigned from functions in Kit server files; SEC005 (warning) flags server-side imports of `.svelte.ts` modules holding module-scope `$state`. Kit route/hooks files are now analyzed via a new `KitModuleFacts` channel.
```

- [ ] **Step 5: Full verification**

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

All green (run `pnpm format` and re-run lint if formatting fails). If `pnpm build` changed `packages/action/dist/index.js`, leave it for Step 6's second commit.

- [ ] **Step 6: Commit**

```bash
git add docs/src/content/docs .changeset
git commit -m "docs: add SEC003-005 rule references (en/ja), extend suppression range, changeset"
git add packages/action/dist/index.js
git commit -m "chore(action): rebuild dist/ with the SEC003-005 core changes"
```

(Skip the second commit if `git status` shows no dist change.)

---

## Done criteria

- `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all green from the repo root.
- `grep -rn "sec003LoadStateWrite\|sec004ServerModuleState\|sec005SharedStateImport" packages/core/src` shows 5 hits per rule.
- Manual smoke (`/verify` before the PR): running the CLI against a project containing the spec's `+page.server.ts` NEVER-DO-THIS example reports SEC004 (warning) at the assignment line and, with a `user.set(...)` in load, SEC003 (critical).
- PR body in English (repo convention).
