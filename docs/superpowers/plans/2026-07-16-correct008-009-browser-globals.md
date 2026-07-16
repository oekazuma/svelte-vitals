# CORRECT008/009 — Browser Globals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CORRECT008 (critical — browser globals in server-executed module code) and CORRECT009 (warning — browser globals at a component instance script's top level), catching the classic SSR `ReferenceError: window is not defined` before deploy.

**Architecture:** One new position-aware scanner (`collectBrowserGlobalRefs`) in `component-parse.ts`, composed from existing machinery: eval-scope boundaries, shadow threading, plus new guard skipping (`browser` from `$app/environment`, `typeof X !== 'undefined'`) and top-level-binding disqualification. Facts land on both channels (`ComponentFacts.browserGlobalRefs` with `context: 'module' | 'instance'` — the instance script is scanned for the first time; `KitModuleFacts.browserGlobalRefs` with the CORRECT007 flag positions and a same-file `ssr = false` opt-out). CORRECT008 is a custom two-channel check (CORRECT007's shape); CORRECT009 is a plain `componentRule`.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, `svelte/compiler` `parse`, Astro Starlight docs, Changesets.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-correct008-009-browser-globals-design.md`. Branch: `feat/correct008-009-browser-globals` (exists with the spec commit; work on it). Run `git fetch origin` first — rebase onto `origin/main` if it moved past `3cda63a`.
- Tracked globals — exactly these 17, module constant `BROWSER_GLOBALS`: `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `location`, `history`, `screen`, `matchMedia`, `requestAnimationFrame`, `cancelAnimationFrame`, `IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `alert`, `confirm`, `prompt`. No dynamic list, no Node-shared names.
- Scanner semantics (spec §2): read positions only (never non-computed member property / non-computed object key / declaration id / import-export specifier / label); bare `typeof <global>` operand never matches; guard clauses (if/ternary/logical whose test references the `$app/environment` `browser` binding, alias-resolved, or contains `typeof <tracked-global> === | !== 'undefined'`) are skipped ENTIRELY including else branches; names imported or declared at the program's top level are disqualified program-wide; eval-scope boundaries + shadow threading as in CORRECT007.
- `.svelte` instance scans use the UNION of both scripts' guard bindings and top-level bindings (module-script `const document = …` is visible in the instance script).
- Kit flag positions identical to CORRECT007's `lifecycleCalls`: top level (`inHandler: false`), handler bodies (`true`), `init` (`false`); helper functions exempt; **closures nested inside handlers are NOT descended into** (they are typically client callbacks — a deliberate, documented difference from CORRECT007's nested-in-handler stance). Same-file `export const ssr = false` (incl. `satisfies` and alias-export forms) empties the kit facts; `csr = false` does not.
- Rules: `CORRECT008` "Browser global in server module code", `critical`, custom `check(ctx)` over component `context === 'module'` facts + kit facts; `CORRECT009` "Browser global during component initialisation", `warning`, `componentRule` over `context === 'instance'`. Messages/recommendation verbatim from spec §4.
- New facts are REQUIRED fields → literal fixups (lists in Tasks 1–2).
- `packages/core/src`: no `node:` imports, no I/O. en/ja docs together; suppression range `CORRECT001–007` → `CORRECT001–009`. Changeset: core / `svelte-vitals` / vite / mcp — minor. cli tests need `pnpm --filter @svelte-vitals/core build` first. Root verify: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` (2 pre-existing warnings in `packages/cli/test/meta-object.test.ts` are not yours). Final `chore(action)` dist commit if `pnpm build` changes it. Conventional commits.

---

## File Structure

- Modify: `packages/core/src/component-parse.ts` — `BROWSER_GLOBALS`, `collectBrowserGuardImports`, `collectProgramBindings`, `isBrowserGuardTest`, `collectBrowserGlobalRefs` (exported for the Kit parser), wiring in `parseModuleFacts` + `parseComponentFacts` (Task 1).
- Modify: `packages/core/src/component.ts` (`BrowserGlobalRefFact` + field), `packages/core/src/component-collect.ts` — Task 1.
- Modify (ComponentFacts literal fixups, Task 1): `packages/core/test/component-collect.test.ts`, `component-rule.test.ts`, `security-rules.test.ts`, `bundle-rules.test.ts`, `correctness-rules.test.ts` (`comp()`), `architecture-rules.test.ts`, `security-kit-rules.test.ts` (`stateModule`), `packages/cli/test/malformed-svelte.test.ts`, `packages/cli/test/suppression-e2e.test.ts`.
- Modify: `packages/core/src/kit-module.ts`, `packages/core/src/kit-module-parse.ts`, `packages/core/src/kit-module-collect.ts`; KitModuleFacts literal fixups: `packages/core/test/security-kit-rules.test.ts` (`kit()`), `packages/core/test/correctness-rules.test.ts` (`kitFacts()`) — Task 2.
- Create: `packages/core/src/rules/correctness/correct008-browser-globals.ts`, `correct009-instance-browser-globals.ts`; Modify: `packages/core/src/rules/index.ts` (3 spots ×2), `packages/core/src/index.ts` (2 spots), `packages/core/test/correctness-rules.test.ts` — Task 3.
- Create: `docs/src/content/docs/rules/correct008.md`, `correct009.md` + ja mirrors; Modify: guides `cli.md` en/ja; Create: `.changeset/correct008-009-browser-globals.md` — Task 4.

---

### Task 1: The scanner + `ComponentFacts.browserGlobalRefs`

**Files:**

- Modify: `packages/core/src/component-parse.ts` (new section after `collectOrphanLifecycleCalls`, ~line 815; wiring in `parseModuleFacts` ~line 899 and `parseComponentFacts` ~line 935)
- Modify: `packages/core/src/component.ts` (interface after `OrphanLifecycleCallFact`; field after `orphanLifecycleCalls`)
- Modify: `packages/core/src/component-collect.ts` (`emptyComponentFacts`)
- Modify: `packages/core/test/component-parse.test.ts` (new describe)
- Modify (add `browserGlobalRefs: []` next to `orphanLifecycleCalls: []`): the 7 core + 2 cli files in File Structure

**Interfaces:**

- Consumes: existing `EVAL_SCOPE_BOUNDARIES`, `WALK_IGNORED_KEYS`, `scopeIntroducedNames`, `addBoundNames`, `unwrapExport`, `walkEstree`, `lineOf`, `parseModuleProgram`.
- Produces (Task 2 imports from `./component-parse.js`): `BROWSER_GLOBALS: Set<string>`, `collectBrowserGuardImports(program): Set<string>`, `collectProgramBindings(program): Set<string>`, `collectBrowserGlobalRefs(program, source, extra?: { guards?: Set<string>; bound?: Set<string> }): { name: string; line: number }[]`. Plus `ComponentFacts.browserGlobalRefs: BrowserGlobalRefFact[]` (Task 3 reads it).

- [ ] **Step 1: Rebase check**

```bash
git switch feat/correct008-009-browser-globals
git fetch origin
git log --oneline origin/main -1   # if not 3cda63a, run: git rebase origin/main
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/core/test/component-parse.test.ts`:

```ts
describe('parseComponentFacts — browser-global refs (CORRECT008/009)', () => {
  const refs = (src: string, file = 'src/lib/store.svelte.ts') => parseComponentFacts(src, file).browserGlobalRefs;

  it('flags bare and member-object reads at module scope', () => {
    const src = 'const w = window.innerWidth;\nlocalStorage.setItem("k", "v");\ndocument.title = "x";';
    expect(refs(src)).toEqual([
      { name: 'window', line: 1, context: 'module' },
      { name: 'localStorage', line: 2, context: 'module' },
      { name: 'document', line: 3, context: 'module' }
    ]);
  });
  it('does not flag typeof operands, property keys, or member property names', () => {
    const src =
      'const ok = typeof window;\nconst o = { window: 1, document: 2 };\nconst x = o.window;\napi.localStorage.get();';
    expect(refs(src)).toEqual([]);
  });
  it('does not flag names imported or declared at top level', () => {
    const src =
      "import { window } from 'happy-dom';\nconst document = makeDoc();\nwindow.open();\ndocument.write('x');";
    expect(refs(src)).toEqual([]);
  });
  it('skips browser-guarded clauses entirely (if / ternary / logical, alias included)', () => {
    const src = [
      "import { browser as isBrowser } from '$app/environment';",
      'if (isBrowser) {',
      '  window.scrollTo(0, 0);',
      '} else {',
      '  document.title;',
      '}',
      'const w = isBrowser ? window.innerWidth : 0;',
      'isBrowser && localStorage.clear();'
    ].join('\n');
    expect(refs(src)).toEqual([]);
  });
  it('skips typeof-guarded clauses', () => {
    const src =
      "if (typeof window !== 'undefined') {\n  window.addEventListener('x', f);\n}\nconst s = typeof localStorage === 'undefined' ? null : localStorage.getItem('k');";
    expect(refs(src)).toEqual([]);
  });
  it('does not flag reads inside functions, onMount, or $effect', () => {
    const src = [
      "import { onMount } from 'svelte';",
      'export function width() {',
      '  return window.innerWidth;',
      '}',
      'onMount(() => document.title);',
      '$effect(() => {',
      '  localStorage.setItem("a", "b");',
      '});'
    ].join('\n');
    expect(refs(src)).toEqual([]);
  });
  it('splits module vs instance contexts in .svelte files', () => {
    const src = [
      '<script module>',
      'const w = window.innerWidth;',
      '</script>',
      '<script>',
      "  const stored = localStorage.getItem('k');",
      '</script>'
    ].join('\n');
    expect(parseComponentFacts(src, 'C.svelte').browserGlobalRefs).toEqual([
      { name: 'window', line: 2, context: 'module' },
      { name: 'localStorage', line: 5, context: 'instance' }
    ]);
  });
  it("shares the module script's guard and bindings with the instance scan", () => {
    const src = [
      '<script module>',
      "import { browser } from '$app/environment';",
      'const document = makeDoc();',
      '</script>',
      '<script>',
      '  if (browser) {',
      '    window.scrollTo(0, 0);',
      '  }',
      "  document.write('x');",
      '</script>'
    ].join('\n');
    expect(parseComponentFacts(src, 'C.svelte').browserGlobalRefs).toEqual([]);
  });
  it('does not flag a shadowed name in a top-level block', () => {
    const src = '{\n  const window = fake();\n  window.open();\n}';
    expect(refs(src)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: FAIL — `browserGlobalRefs` is `undefined`.

- [ ] **Step 4: Add the fact type**

In `packages/core/src/component.ts`, after `OrphanLifecycleCallFact`:

```ts
/** A browser-only global read in code that runs on the server — SSR crashes with "<name> is not defined" (CORRECT008/009). */
export interface BrowserGlobalRefFact {
  /** The global's name, e.g. 'window'. */
  name: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /** 'module' = module evaluation (script module / runes module — CORRECT008); 'instance' = component-init top level (runs on the server during SSR — CORRECT009). */
  context: 'module' | 'instance';
}
```

In `ComponentFacts`, after `orphanLifecycleCalls`:

```ts
/** Browser-global reads in server-executed positions of this file (CORRECT008/009). */
browserGlobalRefs: BrowserGlobalRefFact[];
```

- [ ] **Step 5: Implement the scanner**

In `packages/core/src/component-parse.ts`, add `BrowserGlobalRefFact` to the type import, and after `collectOrphanLifecycleCalls` (~line 815) add:

```ts
/** Browser-only globals worth flagging in server-executed code (CORRECT008/009) — curated high-signal names absent from Node; NOT the full `globals.browser` list, which would false-positive on generic identifiers without scope analysis. */
export const BROWSER_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
  'screen',
  'matchMedia',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IntersectionObserver',
  'ResizeObserver',
  'MutationObserver',
  'alert',
  'confirm',
  'prompt'
]);

/**
 * Local names of `browser` value-imported from '$app/environment' (alias-resolved) —
 * the guard binding recognised by the browser-global scanner (CORRECT008/009).
 * Shared with the Kit-module parser.
 */
export function collectBrowserGuardImports(program: Node): Set<string> {
  const out = new Set<string>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ImportDeclaration' || stmt.importKind === 'type' || stmt.source?.value !== '$app/environment')
      continue;
    for (const s of stmt.specifiers ?? []) {
      if (s?.importKind === 'type' || s?.local?.type !== 'Identifier') continue;
      if (s.type === 'ImportSpecifier' && s.imported?.type === 'Identifier' && s.imported.name === 'browser') {
        out.add(s.local.name);
      }
    }
  }
  return out;
}

/**
 * Names bound at the program's top level: every import's local name plus every
 * export-unwrapped declaration name. A tracked global with such a binding is a real
 * binding, not a global read (`const document = …`, `import { window } from …`) —
 * disqualified program-wide by the browser-global scanner (CORRECT008/009).
 * Shared with the Kit-module parser.
 */
export function collectProgramBindings(program: Node): Set<string> {
  const bound = new Set<string>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type === 'ImportDeclaration') {
      for (const s of stmt.specifiers ?? []) if (s?.local?.type === 'Identifier') bound.add(s.local.name);
      continue;
    }
    const decl = unwrapExport(stmt);
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations ?? []) addBoundNames(d?.id, bound);
    } else if (
      (decl?.type === 'FunctionDeclaration' || decl?.type === 'ClassDeclaration') &&
      decl.id?.type === 'Identifier'
    ) {
      bound.add(decl.id.name);
    }
  }
  return bound;
}

/**
 * Whether a guard-clause test establishes a browser environment: it references the
 * `$app/environment` `browser` binding, or contains a
 * `typeof <tracked-global> === | !== 'undefined'` comparison (CORRECT008/009).
 * Over-matching here only widens the skip — a conservative miss, never a false positive.
 */
function isBrowserGuardTest(test: Node, guardBindings: Set<string>): boolean {
  let guarded = false;
  walkEstree(test, (n) => {
    if (n.type === 'Identifier' && guardBindings.has(n.name)) guarded = true;
    if (n.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(n.operator)) {
      const sides = [n.left, n.right];
      const hasTypeofGlobal = sides.some(
        (s: Node) =>
          s?.type === 'UnaryExpression' &&
          s.operator === 'typeof' &&
          s.argument?.type === 'Identifier' &&
          BROWSER_GLOBALS.has(s.argument.name)
      );
      const hasUndefinedString = sides.some((s: Node) => s?.type === 'Literal' && s.value === 'undefined');
      if (hasTypeofGlobal && hasUndefinedString) guarded = true;
    }
  });
  return guarded;
}

/**
 * Browser-global reads in code that executes when `program` (or a passed function body)
 * is evaluated (CORRECT008/009). Position-aware — only read positions match: never a
 * non-computed member property or object key, a declaration id, an import/export
 * specifier, a label, or a bare `typeof` operand (that idiom never throws). Stops at
 * eval-scope boundaries (function/class bodies), threads the shadow set, disqualifies
 * names bound at the program's top level (`extra.bound` adds more, e.g. the other
 * script's bindings or a handler's parameters), and skips guard clauses ENTIRELY —
 * if/ternary/logical whose test passes `isBrowserGuardTest` — including their else
 * branches (a documented conservative miss). `extra.guards` adds guard bindings beyond
 * this program's own `$app/environment` import.
 */
export function collectBrowserGlobalRefs(
  program: Node,
  source: string,
  extra?: { guards?: Set<string>; bound?: Set<string> }
): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  const bound = new Set([...collectProgramBindings(program), ...(extra?.bound ?? [])]);
  const guards = new Set([...collectBrowserGuardImports(program), ...(extra?.guards ?? [])]);

  const visit = (n: Node, shadowed: Set<string>): void => {
    if (!n) return;
    if (Array.isArray(n)) {
      for (const c of n) visit(c, shadowed);
      return;
    }
    if (typeof n !== 'object' || typeof n.type !== 'string') return;
    if (EVAL_SCOPE_BOUNDARIES.has(n.type)) return;

    if ((n.type === 'IfStatement' || n.type === 'ConditionalExpression') && isBrowserGuardTest(n.test, guards)) return;
    if (n.type === 'LogicalExpression' && isBrowserGuardTest(n.left, guards)) return;

    const introduced = scopeIntroducedNames(n);
    const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;

    switch (n.type) {
      case 'Identifier':
        if (BROWSER_GLOBALS.has(n.name) && !bound.has(n.name) && !scope.has(n.name)) {
          out.push({ name: n.name, line: lineOf(source, n.start) });
        }
        return;
      case 'UnaryExpression':
        if (n.operator === 'typeof' && n.argument?.type === 'Identifier') return; // guard idiom — never throws
        break;
      case 'MemberExpression':
        visit(n.object, scope);
        if (n.computed) visit(n.property, scope);
        return;
      case 'Property':
        if (n.computed) visit(n.key, scope);
        visit(n.value, scope);
        return;
      case 'VariableDeclarator':
        visit(n.init, scope); // the id is a binding target, not a read
        return;
      case 'LabeledStatement':
        visit(n.body, scope);
        return;
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
        return;
      case 'ExportNamedDeclaration':
        if (!n.declaration) return; // bare specifiers aren't reads
        break;
    }
    for (const key of Object.keys(n)) {
      if (WALK_IGNORED_KEYS.has(key)) continue;
      visit(n[key], scope);
    }
  };
  visit(program, new Set());
  return out;
}
```

- [ ] **Step 6: Wire the facts**

1. `parseModuleFacts`: alongside the other collectors add

```ts
const browserGlobalRefs: BrowserGlobalRefFact[] = program
  ? collectBrowserGlobalRefs(program, wrapped).map((r) => ({ ...r, line: shift(r.line), context: 'module' as const }))
  : [];
```

and include `browserGlobalRefs` in the return object. Extend the doc comment's populated-facts list.

2. `parseComponentFacts` (`.svelte` path): after the `orphanLifecycleCalls` line add

```ts
const browserGlobalRefs: BrowserGlobalRefFact[] = [];
const moduleProgram = ast.module?.content;
if (moduleProgram) {
  for (const r of collectBrowserGlobalRefs(moduleProgram, source)) {
    browserGlobalRefs.push({ ...r, context: 'module' });
  }
}
```

and inside the existing `if (program) { … }` instance block (at its end, after the `constableStates` loop):

```ts
// Instance top level runs on the server during SSR (CORRECT009). The module
// script's guard binding and top-level bindings are visible here — pass them in.
const moduleExtra = moduleProgram
  ? { guards: collectBrowserGuardImports(moduleProgram), bound: collectProgramBindings(moduleProgram) }
  : undefined;
for (const r of collectBrowserGlobalRefs(program, source, moduleExtra)) {
  browserGlobalRefs.push({ ...r, context: 'instance' });
}
```

Add `browserGlobalRefs` to the return object. NOTE: the existing code destructures `ast.module?.content` inline in two places — introduce the single `moduleProgram` const near the top of the `.svelte` path and reuse it for the existing `ast.module?.content` uses (pure refactor).

3. `emptyComponentFacts` in `component-collect.ts`: add `browserGlobalRefs: [],`.

- [ ] **Step 7: Literal fixups**

Root `pnpm typecheck`; add `browserGlobalRefs: []` to every flagged `ComponentFacts` literal (the 7 core + 2 cli files listed in File Structure, next to `orphanLifecycleCalls: []`). Re-run until clean.

- [ ] **Step 8: Run tests to verify pass**

Run: `pnpm --filter @svelte-vitals/core test` then `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals test`
Expected: PASS, no existing assertion changed.

- [ ] **Step 9: Commit**

```bash
git add packages/core packages/cli
git commit -m "feat(core): scan server-executed component code for browser-global reads"
```

---

### Task 2: `KitModuleFacts.browserGlobalRefs` + `ssr = false` opt-out

**Files:**

- Modify: `packages/core/src/kit-module.ts` (field after `lifecycleCalls`)
- Modify: `packages/core/src/kit-module-parse.ts`
- Modify: `packages/core/src/kit-module-collect.ts` (`emptyKitModuleFacts`)
- Modify: `packages/core/test/kit-module-parse.test.ts` (new describe); KitModuleFacts literal fixups: `packages/core/test/security-kit-rules.test.ts` (`kit()`), `packages/core/test/correctness-rules.test.ts` (`kitFacts()`)

**Interfaces:**

- Consumes (Task 1, from `./component-parse.js`): `collectBrowserGlobalRefs`, `collectBrowserGuardImports`, `collectProgramBindings`; existing kit internals `collectHandlerFunctions`, `collectStartupFunctions`, `collectTopLevelBindings`, `unwrapTs`, `unwrapExport`, `addBoundNames`, the `line()` shift helper.
- Produces: `KitModuleFacts.browserGlobalRefs: { name: string; line: number; inHandler: boolean }[]` (Task 3 reads it).

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/kit-module-parse.test.ts`:

```ts
describe('parseKitModuleFacts — browser-global refs (CORRECT008)', () => {
  it('flags reads at top level and inside load with the right inHandler flags', () => {
    const src = "const w = window.innerWidth;\nexport function load() {\n  return { s: localStorage.getItem('k') };\n}";
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([
      { name: 'window', line: 1, inHandler: false },
      { name: 'localStorage', line: 3, inHandler: true }
    ]);
  });
  it('flags init-hook reads with inHandler false and exempts helper functions', () => {
    const src = [
      'export async function init() {',
      '  document.title;',
      '}',
      'export function helper() {',
      '  return window.innerWidth;',
      '}'
    ].join('\n');
    expect(facts(src, 'src/hooks.server.ts').browserGlobalRefs).toEqual([
      { name: 'document', line: 2, inHandler: false }
    ]);
  });
  it('does not descend into closures nested inside a handler', () => {
    const src = 'export function load() {\n  return { getWidth: () => window.innerWidth };\n}';
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
  });
  it('respects browser/typeof guards and handler-parameter shadowing inside handlers', () => {
    const src = [
      "import { browser } from '$app/environment';",
      'export function load({ window }) {',
      '  if (browser) {',
      '    document.title;',
      '  }',
      '  window.close();',
      "  return typeof localStorage !== 'undefined' ? localStorage.getItem('k') : null;",
      '}'
    ].join('\n');
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
  });
  it('empties the facts when the file itself exports ssr = false, but not for csr = false', () => {
    const ssrOff =
      'export const ssr = false;\nconst w = window.innerWidth;\nexport function load() {\n  return { t: document.title };\n}';
    expect(facts(ssrOff, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
    const csrOff = 'export const csr = false;\nconst w = window.innerWidth;';
    expect(facts(csrOff, 'src/routes/+page.ts').browserGlobalRefs).toEqual([
      { name: 'window', line: 2, inHandler: false }
    ]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-parse`
Expected: FAIL — `browserGlobalRefs` is `undefined`.

- [ ] **Step 3: Implement**

1. `packages/core/src/kit-module.ts`, after `lifecycleCalls`:

```ts
/** Browser-global reads in server-executed positions — top level, handler bodies, the `init` hook (CORRECT008). Empty when the file itself exports `ssr = false`. */
browserGlobalRefs: {
  name: string;
  line: number;
  inHandler: boolean;
}
[];
```

2. `packages/core/src/kit-module-parse.ts`:
   - Extend the import from `./component-parse.js` with `collectBrowserGlobalRefs, collectBrowserGuardImports, collectProgramBindings`.
   - Add helper near `collectStartupFunctions`:

```ts
/**
 * Whether this file opts out of the server entirely via `export const ssr = false`
 * (satisfies-unwrapped; same-file alias export `export { ssr }` resolved). Such a file
 * never runs on the server, so browser globals in it are legal (CORRECT008).
 */
function hasSsrFalseOptOut(program: Node): boolean {
  const isFalse = (init: Node): boolean => {
    const v = unwrapTs(init);
    return v?.type === 'Literal' && v.value === false;
  };
  for (const stmt of program.body ?? []) {
    const decl = unwrapExport(stmt);
    if (decl?.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type === 'Identifier' && d.id.name === 'ssr' && d.init && isFalse(d.init)) {
        if (stmt.type === 'ExportNamedDeclaration') return true;
      }
    }
  }
  // Alias export: `const ssr = false; export { ssr };`
  const bindings = collectTopLevelBindings(program);
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.specifiers || stmt.source || stmt.exportKind === 'type')
      continue;
    for (const s of stmt.specifiers) {
      if (s?.exportKind === 'type' || s?.exported?.type !== 'Identifier' || s?.local?.type !== 'Identifier') continue;
      if (s.exported.name !== 'ssr') continue;
      const resolved = bindings.get(s.local.name);
      if (resolved?.type === 'Literal' && resolved.value === false) return true;
    }
  }
  return false;
}
```

- In `parseKitModuleFacts`: declare `const browserGlobalRefs: KitModuleFacts['browserGlobalRefs'] = [];` with the other arrays; include it in the early `!program` return and in the final return as `byLine(browserGlobalRefs)`.
- After `startupFns` is computed, add the collection (NOT inside `walkKit` — the scanner has its own walk):

```ts
// CORRECT008 — browser-global reads in server-executed positions. The scanner stops
// at function boundaries, so run it once over the program (top level) and once per
// handler/init body; closures nested inside handlers are deliberately not entered
// (they are typically client-side callbacks returned to components).
if (!hasSsrFalseOptOut(program)) {
  // The scanner returns line numbers computed against `wrapped` — subtract the
  // 1-line wrap prefix (the local `line()` helper takes a byte OFFSET, not a line,
  // so it must not be used here).
  const shiftLine = (l: number) => Math.max(0, l - 1);
  const guards = collectBrowserGuardImports(program);
  const bound = collectProgramBindings(program);
  for (const r of collectBrowserGlobalRefs(program, wrapped, { guards, bound })) {
    browserGlobalRefs.push({ name: r.name, line: shiftLine(r.line), inHandler: false });
  }
  const scanFn = (fn: Node, inHandler: boolean) => {
    if (!fn?.body) return;
    const params = new Set<string>();
    for (const p of fn.params ?? []) addBoundNames(p, params);
    for (const r of collectBrowserGlobalRefs(fn.body, wrapped, { guards, bound: new Set([...bound, ...params]) })) {
      browserGlobalRefs.push({ name: r.name, line: shiftLine(r.line), inHandler });
    }
  };
  for (const fn of handlerFns) scanFn(fn, true);
  for (const fn of startupFns) scanFn(fn, false);
}
```

3. `emptyKitModuleFacts` in `kit-module-collect.ts`: add `browserGlobalRefs: [],`.
4. Fixups: add `browserGlobalRefs: [],` to the `kit()` helper in `security-kit-rules.test.ts` and the `kitFacts()` helper in `correctness-rules.test.ts`; root typecheck for stragglers.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS.

```bash
git add packages/core
git commit -m "feat(core): collect browser-global reads in Kit route/hooks files with ssr=false opt-out"
```

---

### Task 3: CORRECT008 + CORRECT009 rules

**Files:**

- Create: `packages/core/src/rules/correctness/correct008-browser-globals.ts`, `packages/core/src/rules/correctness/correct009-instance-browser-globals.ts`
- Modify: `packages/core/src/rules/index.ts` (import/`allRules`/re-export, each after the `correct007OrphanLifecycle` entries), `packages/core/src/index.ts` (after `correct007OrphanLifecycle,`)
- Modify: `packages/core/test/correctness-rules.test.ts`

**Interfaces:**

- Consumes: `ComponentFacts.browserGlobalRefs` (Task 1), `KitModuleFacts.browserGlobalRefs` (Task 2), `componentRule`, `docsUrlFor`.
- Produces: exported `correct008BrowserGlobals: Rule`, `correct009InstanceBrowserGlobals: Rule`.

- [ ] **Step 1: Write the failing rule tests**

In `packages/core/test/correctness-rules.test.ts`, add both rule names to the `../src/index.js` import and append:

```ts
describe('CORRECT008 browser global in server module code', () => {
  it('flags a module-context read as critical with the module message', async () => {
    const rs = await correct008BrowserGlobals.check(
      ctx([
        comp({
          file: 'src/lib/store.svelte.ts',
          browserGlobalRefs: [{ name: 'window', line: 1, context: 'module' }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('critical');
    expect(rs[0]!.message).toContain('window');
    expect(rs[0]!.message).toContain('is not defined');
  });
  it('ignores instance-context refs (CORRECT009 territory) and reads the kit channel', async () => {
    const rs = await correct008BrowserGlobals.check({
      ...ctx([comp({ browserGlobalRefs: [{ name: 'window', line: 3, context: 'instance' }] })]),
      kitModules: [kitFacts({ browserGlobalRefs: [{ name: 'localStorage', line: 3, inHandler: true }] })]
    });
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/routes/+page.ts');
    expect(fails(rs)[0]!.message).toContain('load/handler');
  });
  it('is silenced by suppressions and emits nothing in rendered mode', async () => {
    const rs = await correct008BrowserGlobals.check(
      ctx([
        comp({
          browserGlobalRefs: [{ name: 'window', line: 2, context: 'module' }],
          suppressions: [{ line: 2, ruleIds: ['CORRECT008'] }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
    expect(await correct008BrowserGlobals.check(base as RuleContext)).toHaveLength(0);
  });
});

describe('CORRECT009 browser global during component initialisation', () => {
  it('flags an instance-context read as warning', async () => {
    const rs = await correct009InstanceBrowserGlobals.check(
      ctx([
        comp({
          file: 'src/lib/Widget.svelte',
          browserGlobalRefs: [{ name: 'localStorage', line: 4, context: 'instance' }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.line).toBe(4);
    expect(rs[0]!.message).toContain('localStorage');
  });
  it('ignores module-context refs and files without instance refs', async () => {
    expect(
      fails(
        await correct009InstanceBrowserGlobals.check(
          ctx([comp({ browserGlobalRefs: [{ name: 'window', line: 1, context: 'module' }] })])
        )
      )
    ).toHaveLength(0);
    expect(await correct009InstanceBrowserGlobals.check(ctx([comp({})]))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- correctness-rules`
Expected: FAIL — rules not exported.

- [ ] **Step 3: Implement CORRECT008**

Create `packages/core/src/rules/correctness/correct008-browser-globals.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { SuppressionDirective } from '../../component.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

const ID = 'CORRECT008';
const DOCS_URL = docsUrlFor(ID);
const LABEL = 'Server-safe module code';
const RECOMMENDATION =
  'Move browser-only code into onMount or $effect (they never run on the server), or guard it with browser from $app/environment (or a typeof check).';

const moduleMessage = (name: string) =>
  `${name} is accessed at module scope — it does not exist on the server, so importing this file crashes SSR with "${name} is not defined"`;

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
 * CORRECT008 — browser globals read in server-executed MODULE code: module scope of
 * runes modules / `<script module>`, and Kit route/hooks files (top level, handler
 * bodies, the `init` hook). All of it runs on the server, where these globals do not
 * exist — SSR crashes with a ReferenceError. Instance-script reads are CORRECT009's
 * (warning) territory. A custom check because the facts live on both channels.
 */
export const correct008BrowserGlobals: Rule = {
  id: ID,
  title: 'Browser global in server module code',
  category: 'correctness',
  severity: 'critical',
  scope: 'component',
  rationale:
    'window, document, localStorage and friends do not exist on the server; a read in module scope or a load/handler crashes SSR with a ReferenceError — the compiler does not catch it, and it surfaces as a production 500.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const c of ctx.components ?? []) {
      const refs = (c.browserGlobalRefs ?? []).filter((r) => r.context === 'module');
      if (refs.length === 0) continue;
      emitFile(
        out,
        c.file,
        refs.map((r) => ({ line: r.line, message: moduleMessage(r.name) })),
        c.suppressions
      );
    }
    for (const m of ctx.kitModules ?? []) {
      const refs = m.browserGlobalRefs ?? [];
      if (refs.length === 0) continue;
      emitFile(
        out,
        m.file,
        refs.map((r) => ({
          line: r.line,
          message: r.inHandler
            ? `${r.name} is accessed in a load/handler — it runs on the server during SSR, where ${r.name} is not defined`
            : moduleMessage(r.name)
        })),
        m.suppressions
      );
    }
    return out;
  }
};
```

- [ ] **Step 4: Implement CORRECT009**

Create `packages/core/src/rules/correctness/correct009-instance-browser-globals.ts`:

```ts
import { componentRule } from '../component-rule.js';

export const correct009InstanceBrowserGlobals = componentRule({
  id: 'CORRECT009',
  title: 'Browser global during component initialisation',
  category: 'correctness',
  label: 'Server-safe component init',
  recommendation:
    'Move browser-only code into onMount or $effect (they never run on the server), or guard it with browser from $app/environment (or a typeof check).',
  rationale:
    'A component instance script runs on the server on every SSR render, where window/document/localStorage do not exist. Warning, not critical: a component rendered only behind a parent {#if browser} (or a client-only dynamic import) is a legitimate pattern that static analysis cannot prove cross-file.',
  applies: (c) => (c.browserGlobalRefs ?? []).some((r) => r.context === 'instance'),
  bad: (c) =>
    (c.browserGlobalRefs ?? [])
      .filter((r) => r.context === 'instance')
      .map((r) => ({
        line: r.line,
        message: `${r.name} is accessed during component initialisation — during SSR this runs on the server, where ${r.name} is not defined`
      }))
});
```

- [ ] **Step 5: Register (four sites × 2 rules) and verify**

`packages/core/src/rules/index.ts`: imports + `allRules` entries + re-exports for both rules, each directly after the `correct007OrphanLifecycle` line. `packages/core/src/index.ts`: both after `correct007OrphanLifecycle,`.

Run: `grep -rn "correct008BrowserGlobals\|correct009InstanceBrowserGlobals" packages/core/src`
Expected: 5 hits each.

- [ ] **Step 6: Run to verify, then commit**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS (cli `docs-links` fails until Task 4 — expected).

```bash
git add packages/core
git commit -m "feat(core): add CORRECT008/009 — flag browser globals in server-executed code"
```

---

### Task 4: Docs (en/ja ×2), suppression range, changeset, full verification

**Files:**

- Create: `docs/src/content/docs/rules/correct008.md`, `correct009.md`, `docs/src/content/docs/ja/rules/correct008.md`, `correct009.md`
- Modify: `docs/src/content/docs/guides/cli.md` (~line 217), `ja/guides/cli.md` (~line 215): `CORRECT001–007` → `CORRECT001–009`, nothing else, dash preserved
- Create: `.changeset/correct008-009-browser-globals.md`

- [ ] **Step 1: Write the four rule pages**

`docs/src/content/docs/rules/correct008.md`:

````md
---
title: CORRECT008 · Browser global in server module code
description: window, document, localStorage accessed in module scope or a load/handler crash SSR with a ReferenceError.
---

**Severity:** critical · **Category:** correctness

## What it checks

Flags reads of browser-only globals (`window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `location`, `history`, `screen`, `matchMedia`, `requestAnimationFrame`, `cancelAnimationFrame`, `IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `alert`, `confirm`, `prompt`) in code that always runs on the server:

- **module scope** of a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>` block (crashes when the module is imported on the server), and
- **SvelteKit route/hooks files** — top level, `load`/action/endpoint handler bodies, and the `init` hook (crashes at import or on every request).

Not flagged: code guarded by `browser` from `$app/environment` (aliases included) or a `typeof window !== 'undefined'` check; code inside `onMount`/`$effect`/ordinary functions (they don't run at module evaluation); a bare `typeof window` (never throws); names you imported or declared yourself (`const document = …`); closures nested inside handlers (typically client callbacks); and files that export `ssr = false` themselves.

## Why it matters

None of these globals exist in Node. A module-scope `window` read crashes the server the moment the file is imported; in a `load` it crashes every SSR request — `ReferenceError: window is not defined`, a production 500 the compiler never warns about.

## How to fix

```ts
// +page.ts
export function load() {
  const stored = localStorage.getItem('filters'); // ❌ ReferenceError on the server

  return {};
}
```

Move the browser access to the client side:

```svelte
<!-- +page.svelte -->
<script>
  let stored = $state(null);
  $effect(() => {
    stored = localStorage.getItem('filters'); // ✅ effects never run on the server
  });
</script>
```

Or guard it explicitly:

```ts
import { browser } from '$app/environment';

const stored = browser ? localStorage.getItem('filters') : null; // ✅
```
````

`docs/src/content/docs/rules/correct009.md`:

````md
---
title: CORRECT009 · Browser global during component initialisation
description: A component's instance script runs on the server during SSR — window/document reads at its top level crash the render.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags reads of browser-only globals (the same list as [CORRECT008](/svelte-vitals/rules/correct008)) at the **top level of a component's `<script>`** — that code runs on the server on every SSR render of the component. The same guards apply: `browser` from `$app/environment`, `typeof` checks, `onMount`/`$effect` bodies, your own bindings, and shadowed locals are never flagged.

## Why it matters

`const width = window.innerWidth;` at the top of a component works in the browser and in a client-only dev flow, then crashes the first SSR render with `ReferenceError: window is not defined`.

This is a **warning**, not critical: a component that is only ever rendered behind a parent's `{#if browser}` (or dynamically imported on the client) legitimately never runs on the server — and that cannot be proven from the component file alone. If that is your case, add `// svelte-vitals-disable-next-line CORRECT009` above the line.

## How to fix

```svelte
<script>
  const width = window.innerWidth; // ❌ crashes SSR

  let width2 = $state(0);
  $effect(() => {
    width2 = window.innerWidth; // ✅ client-only
  });
</script>
```
````

`docs/src/content/docs/ja/rules/correct008.md`:

````md
---
title: CORRECT008 · サーバー実行モジュールコードでの browser global
description: モジュールスコープや load/handler での window・document・localStorage 参照は SSR を ReferenceError でクラッシュさせます。
---

**重大度:** critical · **カテゴリ:** correctness

## チェック内容

**必ずサーバーで実行されるコード**での browser 専用 global(`window`、`document`、`localStorage`、`sessionStorage`、`navigator`、`location`、`history`、`screen`、`matchMedia`、`requestAnimationFrame`、`cancelAnimationFrame`、`IntersectionObserver`、`ResizeObserver`、`MutationObserver`、`alert`、`confirm`、`prompt`)の読み取りを検出します:

- `.svelte.ts`/`.svelte.js` runes モジュールや `.svelte` の `<script module>` ブロックの**モジュールスコープ**(サーバーで import された瞬間にクラッシュ)
- **SvelteKit のルート/フックファイル** — トップレベル、`load`/action/エンドポイント handler 本体、`init` フック(import 時またはリクエストごとにクラッシュ)

検出対象外: `$app/environment` の `browser`(エイリアス込み)や `typeof window !== 'undefined'` チェックでガードされたコード、`onMount`/`$effect`/通常の関数内(モジュール評価時には実行されない)、裸の `typeof window`(throw しない)、自分で import/宣言した名前(`const document = …`)、handler 内にネストしたクロージャ(典型的にはクライアント側コールバック)、自身が `ssr = false` を export するファイル。

## 重要な理由

これらの global は Node に存在しません。モジュールスコープの `window` 参照はファイルがサーバーで import された瞬間に、`load` 内なら SSR リクエストのたびにクラッシュします — `ReferenceError: window is not defined`、コンパイラは一切警告しない本番 500 です。

## 修正方法

```ts
// +page.ts
export function load() {
  const stored = localStorage.getItem('filters'); // ❌ サーバーで ReferenceError

  return {};
}
```

ブラウザアクセスをクライアント側へ移します:

```svelte
<!-- +page.svelte -->
<script>
  let stored = $state(null);
  $effect(() => {
    stored = localStorage.getItem('filters'); // ✅ effect はサーバーでは実行されない
  });
</script>
```

または明示的にガードします:

```ts
import { browser } from '$app/environment';

const stored = browser ? localStorage.getItem('filters') : null; // ✅
```
````

`docs/src/content/docs/ja/rules/correct009.md`:

````md
---
title: CORRECT009 · コンポーネント初期化中の browser global
description: コンポーネントの instance script は SSR 時にサーバーで実行されます — トップレベルの window/document 参照はレンダリングをクラッシュさせます。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

**コンポーネントの `<script>` トップレベル**での browser 専用 global([CORRECT008](/svelte-vitals/rules/correct008) と同じリスト)の読み取りを検出します — このコードはコンポーネントの SSR レンダリングのたびにサーバーで実行されます。ガードの扱いも同じです: `$app/environment` の `browser`、`typeof` チェック、`onMount`/`$effect` 本体、自前の binding、シャドーされたローカルは検出されません。

## 重要な理由

コンポーネント冒頭の `const width = window.innerWidth;` はブラウザ上とクライアント専用の開発フローでは動きますが、最初の SSR レンダリングで `ReferenceError: window is not defined` になります。

これが critical ではなく **warning** なのは、親の `{#if browser}` の内側でのみレンダリングされる(またはクライアントで動的 import される)コンポーネントは正当にサーバーで実行されないためです — これはコンポーネントファイル単体からは証明できません。該当する場合は対象行の直前に `// svelte-vitals-disable-next-line CORRECT009` を書いてください。

## 修正方法

```svelte
<script>
  const width = window.innerWidth; // ❌ SSR がクラッシュ

  let width2 = $state(0);
  $effect(() => {
    width2 = window.innerWidth; // ✅ クライアント専用
  });
</script>
```
````

- [ ] **Step 2: Update the suppression range and verify docs-links**

Both guide lines: `CORRECT001–007` → `CORRECT001–009`. Then:

Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals test -- docs-links`
Expected: PASS.

- [ ] **Step 3: Add the changeset**

Create `.changeset/correct008-009-browser-globals.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add CORRECT008 (critical) and CORRECT009 (warning): flag browser-only globals (`window`, `document`, `localStorage`, …) read in server-executed code — module scope of runes modules and `<script module>`, SvelteKit load/handler/`init` bodies and file top levels (CORRECT008), and component instance-script top levels that run during SSR (CORRECT009). Recognises `browser`/`typeof` guards, respects same-file `export const ssr = false`, and never descends into `onMount`/`$effect`/function bodies.
```

- [ ] **Step 4: Full verification and commits**

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

All green (`pnpm format` + re-run if formatting-only failure; fold reformats into the matching commit).

```bash
git add docs/src/content/docs .changeset
git commit -m "docs: add CORRECT008/009 rule references (en/ja), extend suppression range, changeset"
git add packages/action/dist/index.js
git commit -m "chore(action): rebuild dist/ with the CORRECT008/009 core changes"
```

(Skip the second commit if no dist change.)

---

## Done criteria

- `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all green from the repo root.
- 5 grep hits per rule export in `packages/core/src`.
- Manual smoke (`/verify` before the PR): a fixture with `localStorage` in `load` reports critical CORRECT008; a component with top-level `window` reports warning CORRECT009; the same component with the access inside `$effect` reports nothing.
- PR body in English.
