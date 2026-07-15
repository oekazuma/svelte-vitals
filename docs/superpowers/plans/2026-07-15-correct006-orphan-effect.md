# CORRECT006 — Orphan `$effect` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CORRECT006 — a `critical` correctness rule that flags `$effect` calls guaranteed to throw `effect_orphan` at runtime (module-scope effects in `.svelte.ts`/`.svelte.js` runes modules and `.svelte` `<script module>` blocks), and make the component-facts pipeline collect those module files for the first time.

**Architecture:** A new `ComponentFacts.orphanEffects: OrphanEffectFact[]` fact, produced by a conservative "eval-scope" walk that never crosses function/class boundaries. `.svelte.ts`/`.svelte.js` sources are parsed by wrapping them in a `<script lang="ts">` tag and reusing the Svelte script parser (verified working on svelte 5.56.4 incl. top-level await / `satisfies` / type-only imports — no new dependency). The rule itself is a plain `componentRule`, so CLI, vite, and MCP pick it up automatically.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces (`@svelte-vitals/core` + downstream), `svelte/compiler` `parse`, Astro Starlight docs, Changesets.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-correct006-orphan-effect-design.md`. Verified facts recorded there: the Svelte compiler (5.56.4) passes all these patterns through to runtime; eslint-plugin-svelte has no equivalent rule.
- Detection is conservative — **never cross a function boundary**. Only two kinds:
  - `'top-level'`: a bare `$effect(...)` / `$effect.pre(...)` executing at module evaluation (incl. inside top-level blocks/`if`), excluding calls lexically inside an `$effect.root(...)` callback.
  - `'constructor-instantiated'`: a module-scope `new X()` where class `X` is declared in the same file and its **constructor body** directly calls `$effect`/`$effect.pre` outside `$effect.root`. Reported line = the `new` site.
- NOT flagged (v1, by design): effects inside functions/IIFEs, factory functions, cross-file classes, classes never `new`-ed at module scope, `.svelte` instance scripts.
- Rule: `id 'CORRECT006'`, `category 'correctness'`, `severity 'critical'`, `scope 'component'` (via `componentRule`, which takes `severity?: Severity` — `'critical'` is valid).
- `ComponentFacts.orphanEffects` is a **required** field (matches `emptyComponentFacts`'s "add new fields HERE so TypeScript catches every call site" contract). Every existing `ComponentFacts` literal must gain `orphanEffects: []` — the full list of files is in Task 1.
- Module-file facts: only `orphanEffects` + `suppressions` populated; everything else empty and `loc: 0` (keeps ARCH001 and PERF009/010 from suddenly firing on module files).
- Existing `isEffectCall` covers `$effect` + `$effect.pre` and already excludes `$effect.root`/`$effect.tracking` (`component-parse.ts:64-71`). Reuse it.
- Suppressions: `collectSuppressions` is a plain text scan (`component-parse.ts:539-549`) — run it on the **unwrapped** module source so directive line numbers align with the −1-corrected effect lines.
- Conventional commits scoped by package. Branch: `feat/correct006-orphan-effect`.
- Verify from the repo root: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`. If working in a fresh worktree: root `pnpm install` fails writing `docs/.vscode/settings.json` — use `pnpm install --filter "./packages/**"`.

---

## File Structure

- Modify: `packages/core/src/component.ts` — `OrphanEffectFact` type + `ComponentFacts.orphanEffects` (Task 1).
- Modify: `packages/core/src/component-parse.ts` — eval-scope walk + orphan collector + `<script module>` wiring (Task 1); module-file branch `parseModuleFacts` (Task 2).
- Modify: `packages/core/src/component-collect.ts` — `emptyComponentFacts` (Task 1); glob extension (Task 3).
- Modify: `packages/core/test/component-parse.test.ts` — capture tests (Tasks 1–2).
- Modify: `packages/core/test/component-collect.test.ts` — literal fixup (Task 1); collection tests (Task 3).
- Modify (literal fixups only, Task 1): `packages/core/test/component-rule.test.ts`, `security-rules.test.ts`, `bundle-rules.test.ts`, `correctness-rules.test.ts`, `architecture-rules.test.ts`, `packages/cli/test/malformed-svelte.test.ts`, `packages/cli/test/suppression-e2e.test.ts`.
- Create: `packages/core/src/rules/correctness/correct006-orphan-effect.ts` (Task 4).
- Modify: `packages/core/src/rules/index.ts` (3 spots), `packages/core/src/index.ts` (1 spot), `packages/core/test/correctness-rules.test.ts` (Task 4).
- Create: `docs/src/content/docs/rules/correct006.md`, `docs/src/content/docs/ja/rules/correct006.md`, `.changeset/correct006-orphan-effect.md` (Task 5).

---

### Task 1: `OrphanEffectFact` capture from `.svelte` `<script module>`

**Files:**

- Modify: `packages/core/src/component.ts` (after `EffectFact`, ~line 23; `ComponentFacts` after `mutatedProps`, ~line 62)
- Modify: `packages/core/src/component-parse.ts` (helper after `isEffectCall` ~line 71; walk/collector before `parseComponentFacts` ~line 550; wiring inside `parseComponentFacts`)
- Modify: `packages/core/src/component-collect.ts` (`emptyComponentFacts`, line 11-27)
- Modify: `packages/core/test/component-parse.test.ts` (new describe at end)
- Modify (add `orphanEffects: []` to every `ComponentFacts` literal): `packages/core/test/component-collect.test.ts` (the `emptyComponentFacts` `toEqual` at lines 29-44), `packages/core/test/component-rule.test.ts`, `packages/core/test/security-rules.test.ts`, `packages/core/test/bundle-rules.test.ts`, `packages/core/test/correctness-rules.test.ts` (the `comp()` helper), `packages/core/test/architecture-rules.test.ts`, `packages/cli/test/malformed-svelte.test.ts`, `packages/cli/test/suppression-e2e.test.ts` (the `comp()` helper)

**Interfaces:**

- Consumes: existing `isEffectCall(node)`, `lineOf(source, start)`, `parse` from `svelte/compiler`.
- Produces: `OrphanEffectFact { line: number; kind: 'top-level' | 'constructor-instantiated'; className?: string }`; `ComponentFacts.orphanEffects: OrphanEffectFact[]`; internal `collectOrphanEffects(program, source): OrphanEffectFact[]` and `walkEvalScope(node, visit)` in `component-parse.ts` (Task 2 reuses both).

- [ ] **Step 1: Create the branch**

```bash
git switch -c feat/correct006-orphan-effect
```

- [ ] **Step 2: Write the failing capture tests**

Append to `packages/core/test/component-parse.test.ts`:

```ts
describe('parseComponentFacts — orphan $effect in <script module> (CORRECT006)', () => {
  const orphans = (src: string) => parseComponentFacts(src, 'C.svelte').orphanEffects;

  it('flags a top-level $effect in <script module>', () => {
    const src = '<script module>\nlet c = $state(0);\n$effect(() => { console.log(c); });\n</script>\n<p>hi</p>';
    expect(orphans(src)).toEqual([{ line: 3, kind: 'top-level' }]);
  });
  it('does not flag $effect in the instance script (component init context)', () => {
    expect(orphans('<script>\n$effect(() => { console.log(1); });\n</script>')).toEqual([]);
  });
  it('flags $effect.pre inside a top-level if block', () => {
    const src = '<script module>\nif (globalThis.browser) {\n  $effect.pre(() => { console.log(1); });\n}\n</script>';
    expect(orphans(src)).toEqual([{ line: 3, kind: 'top-level' }]);
  });
  it('does not flag an effect inside an $effect.root callback', () => {
    const src = '<script module>\n$effect.root(() => {\n  $effect(() => { console.log(1); });\n});\n</script>';
    expect(orphans(src)).toEqual([]);
  });
  it('does not flag an effect inside a function declaration', () => {
    const src = '<script module>\nexport function setup() {\n  $effect(() => { console.log(1); });\n}\n</script>';
    expect(orphans(src)).toEqual([]);
  });
  it('flags a module-scope new of a same-file class with a bare constructor effect', () => {
    const src = [
      '<script module>',
      'class Store {',
      '  v = $state(0);',
      '  constructor() {',
      '    $effect(() => { console.log(this.v); });',
      '  }',
      '}',
      'export const store = new Store();',
      '</script>'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 8, kind: 'constructor-instantiated', className: 'Store' }]);
  });
  it('does not flag the class when it is never instantiated at module scope', () => {
    const src = [
      '<script module>',
      'export class Store {',
      '  constructor() {',
      '    $effect(() => {});',
      '  }',
      '}',
      '</script>'
    ].join('\n');
    expect(orphans(src)).toEqual([]);
  });
  it('does not flag when the constructor effect is wrapped in $effect.root', () => {
    const src = [
      '<script module>',
      'class Store {',
      '  constructor() {',
      '    $effect.root(() => {',
      '      $effect(() => {});',
      '    });',
      '  }',
      '}',
      'export const store = new Store();',
      '</script>'
    ].join('\n');
    expect(orphans(src)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: FAIL — `orphanEffects` is `undefined` (property does not exist yet).

- [ ] **Step 4: Add the fact type**

In `packages/core/src/component.ts`, after the `EffectFact` interface (line 23), add:

```ts
/** A `$effect` guaranteed to run outside component initialisation — it throws `effect_orphan` at runtime (CORRECT006). */
export interface OrphanEffectFact {
  /** 1-based source line, or 0 if unknown. For 'constructor-instantiated', the module-scope `new` site. */
  line: number;
  /** 'top-level' = runs at module evaluation; 'constructor-instantiated' = module-scope `new` of a same-file class whose constructor creates a bare effect. */
  kind: 'top-level' | 'constructor-instantiated';
  /** Class name when kind is 'constructor-instantiated' (used in the finding message). */
  className?: string;
}
```

In `ComponentFacts`, after `mutatedProps` (line 62), add:

```ts
/** `$effect` calls guaranteed to run outside component initialisation — module scope in `.svelte.ts`/`.svelte.js` or `<script module>` (CORRECT006). */
orphanEffects: OrphanEffectFact[];
```

- [ ] **Step 5: Implement the eval-scope walk and orphan collector**

In `packages/core/src/component-parse.ts`:

Add `OrphanEffectFact` to the type import from `./component.js` (line 2).

After `isEffectCall` (line 71), add:

```ts
/** Whether a CallExpression is `$effect.root(...)` — a legal standalone reactive scope (CORRECT006). */
function isEffectRootCall(node: Node): boolean {
  const c = node?.callee;
  return (
    c?.type === 'MemberExpression' &&
    c.object?.type === 'Identifier' &&
    c.object.name === '$effect' &&
    c.property?.type === 'Identifier' &&
    c.property.name === 'root'
  );
}
```

After `collectSuppressions` (line 549), add:

```ts
/** Nodes whose bodies do NOT run when the surrounding code is evaluated: functions run when called; class member/constructor code runs on construction (CORRECT006). */
const EVAL_SCOPE_BOUNDARIES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassDeclaration',
  'ClassExpression'
]);

/**
 * Walk only the code that executes when `node` itself is evaluated: every node is
 * visited, but children of eval-scope boundaries (function/class bodies) are not
 * entered. `visit` returning true skips a node's children — used to exempt
 * `$effect.root(...)` callbacks (CORRECT006).
 */
function walkEvalScope(node: Node, visit: (n: Node) => boolean | undefined): void {
  if (Array.isArray(node)) {
    for (const child of node) walkEvalScope(child, visit);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (visit(node)) return;
  if (EVAL_SCOPE_BOUNDARIES.has(node.type)) return;
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    walkEvalScope(node[key], visit);
  }
}

/** Lines of `$effect`/`$effect.pre` calls that run when `root` itself is evaluated (CORRECT006). */
function collectEvalScopeEffectLines(root: Node, source: string): number[] {
  const lines: number[] = [];
  walkEvalScope(root, (n) => {
    if (n.type !== 'CallExpression') return undefined;
    if (isEffectRootCall(n)) return true;
    if (isEffectCall(n)) lines.push(lineOf(source, n.start));
    return undefined;
  });
  return lines;
}

/**
 * Orphan `$effect` facts for a module-context program (CORRECT006): (1) effects that run
 * at module evaluation time, (2) a module-scope `new` of a same-file class whose
 * constructor creates a bare effect. Conservative by construction — never crosses a
 * function boundary, so factory functions, IIFEs, and cross-file classes are not flagged.
 */
function collectOrphanEffects(program: Node, source: string): OrphanEffectFact[] {
  const out: OrphanEffectFact[] = collectEvalScopeEffectLines(program, source).map((line) => ({
    line,
    kind: 'top-level' as const
  }));

  const effectfulClasses = new Set<string>();
  walkEvalScope(program, (n) => {
    if ((n.type === 'ClassDeclaration' || n.type === 'ClassExpression') && n.id?.type === 'Identifier') {
      const ctor = (n.body?.body ?? []).find((m: Node) => m?.type === 'MethodDefinition' && m.kind === 'constructor');
      if (ctor?.value?.body && collectEvalScopeEffectLines(ctor.value.body, source).length > 0) {
        effectfulClasses.add(n.id.name);
      }
    }
    return undefined;
  });
  if (effectfulClasses.size > 0) {
    walkEvalScope(program, (n) => {
      if (n.type === 'NewExpression' && n.callee?.type === 'Identifier' && effectfulClasses.has(n.callee.name)) {
        out.push({ line: lineOf(source, n.start), kind: 'constructor-instantiated', className: n.callee.name });
      }
      return undefined;
    });
  }
  return out.sort((a, b) => a.line - b.line);
}
```

- [ ] **Step 6: Wire into `parseComponentFacts` and `emptyComponentFacts`**

In `parseComponentFacts`: add `orphanEffects: OrphanEffectFact[];` to the declared return type (after `mutatedProps`, line 566). After the module-imports block (lines 581-584), add:

```ts
const orphanEffects: OrphanEffectFact[] = ast.module?.content ? collectOrphanEffects(ast.module.content, source) : [];
```

Add `orphanEffects` to the returned object (after `mutatedProps`).

In `packages/core/src/component-collect.ts`, add `orphanEffects: [],` to `emptyComponentFacts` (after `mutatedProps: [],`).

- [ ] **Step 7: Fix every `ComponentFacts` literal typecheck flags**

Run: `pnpm --filter @svelte-vitals/core --filter svelte-vitals typecheck`

Add `orphanEffects: [],` next to `mutatedProps: [],` in each flagged literal. Known sites: `packages/core/test/component-collect.test.ts` (the `emptyComponentFacts` `toEqual`), `component-rule.test.ts`, `security-rules.test.ts`, `bundle-rules.test.ts`, `correctness-rules.test.ts` (`comp()` helper), `architecture-rules.test.ts`, `packages/cli/test/malformed-svelte.test.ts`, `packages/cli/test/suppression-e2e.test.ts` (`comp()` helper). Re-run typecheck until clean — also run `pnpm typecheck` at the root to catch any site outside core/cli.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: PASS (all new CORRECT006 capture tests, no existing test broken).

- [ ] **Step 9: Run the full core + cli suites**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter svelte-vitals test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/core packages/cli
git commit -m "feat(core): collect orphan \$effect facts from .svelte <script module>"
```

---

### Task 2: Parse `.svelte.ts` / `.svelte.js` runes modules

**Files:**

- Modify: `packages/core/src/component-parse.ts` (module branch before/inside `parseComponentFacts`)
- Modify: `packages/core/test/component-parse.test.ts` (new describe at end)

**Interfaces:**

- Consumes: `collectOrphanEffects`, `collectSuppressions` from Task 1; `ComponentFacts`, `OrphanEffectFact` types.
- Produces: `parseComponentFacts(source, filename)` now accepts `.svelte.ts`/`.svelte.js` filenames and returns module facts; shared `ParsedFacts` return type.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/component-parse.test.ts`:

```ts
describe('parseComponentFacts — orphan $effect in runes modules (.svelte.ts/.svelte.js)', () => {
  const orphans = (src: string, file = 'src/lib/store.svelte.ts') => parseComponentFacts(src, file).orphanEffects;

  it('flags a top-level $effect, with line numbers matching the unwrapped source', () => {
    expect(orphans('let c = $state(0);\n$effect(() => { console.log(c); });')).toEqual([
      { line: 2, kind: 'top-level' }
    ]);
  });
  it('flags the shared-state-class pattern: bare constructor effect + module-scope new', () => {
    const src = [
      'class QuizStateManager {',
      '  bookmarks = $state([]);',
      '  constructor() {',
      '    $effect(() => { save(this.bookmarks); });',
      '  }',
      '}',
      'export const quizState = new QuizStateManager();'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 7, kind: 'constructor-instantiated', className: 'QuizStateManager' }]);
  });
  it('does not flag effects inside $effect.root, functions, or non-instantiated classes', () => {
    expect(orphans('$effect.root(() => {\n  $effect(() => {});\n});')).toEqual([]);
    expect(orphans('export function useThing() {\n  $effect(() => {});\n}')).toEqual([]);
    expect(orphans('export class S {\n  constructor() {\n    $effect(() => {});\n  }\n}')).toEqual([]);
  });
  it('does not flag a constructor effect wrapped in $effect.root, even when instantiated', () => {
    const src = [
      'class S {',
      '  constructor() {',
      '    $effect.root(() => {',
      '      $effect(() => {});',
      '    });',
      '  }',
      '}',
      'export const s = new S();'
    ].join('\n');
    expect(orphans(src)).toEqual([]);
  });
  it('parses TS module syntax (type-only imports, satisfies, top-level await)', () => {
    const src = [
      'import type { Foo } from "./types";',
      'const cfg = { a: 1 } satisfies Record<string, number>;',
      'export const x = await Promise.resolve(1);',
      '$effect(() => { console.log(x); });'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 4, kind: 'top-level' }]);
  });
  it('handles .svelte.js too', () => {
    expect(orphans('$effect(() => {});', 'src/lib/store.svelte.js')).toEqual([{ line: 1, kind: 'top-level' }]);
  });
  it('collects suppression directives against unwrapped line numbers', () => {
    const facts = parseComponentFacts(
      '// svelte-vitals-disable-next-line CORRECT006\n$effect(() => {});',
      'src/lib/s.svelte.ts'
    );
    expect(facts.orphanEffects).toEqual([{ line: 2, kind: 'top-level' }]);
    expect(facts.suppressions).toEqual([{ line: 2, ruleIds: ['CORRECT006'] }]);
  });
  it('keeps component-only facts empty for a module file', () => {
    const facts = parseComponentFacts('let c = $state(0);\nexport function inc() { c += 1; }', 'src/lib/c.svelte.ts');
    expect(facts.effects).toEqual([]);
    expect(facts.eachBlocks).toEqual([]);
    expect(facts.constableStates).toEqual([]);
    expect(facts.loc).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: FAIL — the Svelte parser errors on bare module source (`.svelte.ts` content is not a component), or `orphanEffects` is empty.

- [ ] **Step 3: Implement the module branch**

In `packages/core/src/component-parse.ts`:

Change the type import on line 2 to include `ComponentFacts`:

```ts
import type {
  ComponentFacts,
  EachBlockFact,
  EffectFact,
  OrphanEffectFact,
  SourceSpan,
  SuppressionDirective
} from './component.js';
```

Directly above `parseComponentFacts`, add:

```ts
/** A Svelte runes module file — the whole file is one module-scope program (CORRECT006). */
const MODULE_FILE_RE = /\.svelte\.(ts|js)$/;

/** What the per-file parsers produce — `ComponentFacts` minus `file`, with `suppressions` always present. */
type ParsedFacts = Omit<ComponentFacts, 'file' | 'suppressions'> & { suppressions: SuppressionDirective[] };

/**
 * Facts for a `.svelte.ts`/`.svelte.js` runes module (CORRECT006). The whole file runs at
 * import time, so only `orphanEffects` and `suppressions` are populated — component-only
 * facts stay empty and `loc` is 0 so ARCH001/PERF009 don't fire on module files. The
 * source is wrapped in a `<script lang="ts">` tag so the Svelte script parser (which
 * handles TS natively) yields the ESTree program; the 1-line wrap prefix is subtracted
 * from every reported line. A source containing a literal `"</script>"` string defeats
 * the wrap and throws here — callers already treat a throw as empty facts.
 */
function parseModuleFacts(source: string, filename: string): ParsedFacts {
  const wrapped = `<script lang="ts">\n${source}\n</script>`;
  const ast = parse(wrapped, { modern: true, filename }) as Node;
  const program = ast.instance?.content;
  const orphanEffects = program
    ? collectOrphanEffects(program, wrapped).map((f) => ({ ...f, line: Math.max(0, f.line - 1) }))
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
    orphanEffects
  };
}
```

Replace `parseComponentFacts`'s long inline return-type annotation with `: ParsedFacts` (it is structurally identical after Task 1 added `orphanEffects`), and make the first statement of the function body:

```ts
if (MODULE_FILE_RE.test(filename)) return parseModuleFacts(source, filename);
```

Update the function's doc comment to mention runes modules, e.g.:

```ts
/**
 * Parse one source file's facts (CLI/static + vite build mode): a `.svelte` component's
 * reactivity/correctness + security + architecture facts, or a `.svelte.ts`/`.svelte.js`
 * runes module's orphan-$effect facts (CORRECT006).
 */
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: PASS.

- [ ] **Step 5: Typecheck + full core suite, then commit**

Run: `pnpm --filter @svelte-vitals/core typecheck && pnpm --filter @svelte-vitals/core test`
Expected: PASS.

```bash
git add packages/core
git commit -m "feat(core): parse .svelte.ts/.svelte.js runes modules for orphan \$effect facts"
```

---

### Task 3: Collect module files in `collectComponentFacts`

**Files:**

- Modify: `packages/core/src/component-collect.ts` (`collectComponentFacts`, lines 29-47)
- Modify: `packages/core/test/component-collect.test.ts` (mock glob + new tests)

**Interfaces:**

- Consumes: `parseComponentFacts` module support from Task 2; `Runtime.glob(pattern, cwd)`.
- Produces: `collectComponentFacts(rt, cwd)` results now include `.svelte.ts`/`.svelte.js` entries — CLI, vite, and MCP receive them with no further changes.

- [ ] **Step 1: Make the test mock pattern-aware and write the failing tests**

In `packages/core/test/component-collect.test.ts`, replace `createMemoryRuntime`'s `glob` (lines 18-20) with:

```ts
async glob(pattern) {
  if (pattern.endsWith('*.svelte.ts')) return [...map.keys()].filter((k) => k.endsWith('.svelte.ts'));
  if (pattern.endsWith('*.svelte.js')) return [...map.keys()].filter((k) => k.endsWith('.svelte.js'));
  return [...map.keys()].filter((k) => k.endsWith('.svelte'));
},
```

Add `orphanEffects: []` to the `emptyComponentFacts` `toEqual` if not already done in Task 1. Append to the `collectComponentFacts` describe:

```ts
it('picks up .svelte.ts/.svelte.js runes modules with orphan-$effect facts', async () => {
  const rt = createMemoryRuntime({
    'src/lib/store.svelte.ts': '$effect(() => {});',
    'src/lib/legacy.svelte.js': '$effect(() => {});'
  });
  const facts = await collectComponentFacts(rt, '');
  expect(facts.map((f) => f.file)).toEqual(['src/lib/legacy.svelte.js', 'src/lib/store.svelte.ts']);
  expect(facts[0]!.orphanEffects).toEqual([{ line: 1, kind: 'top-level' }]);
  expect(facts[1]!.orphanEffects).toEqual([{ line: 1, kind: 'top-level' }]);
});

it('never rejects on a module source containing a literal "</script>" string', async () => {
  const rt = createMemoryRuntime({ 'src/lib/tricky.svelte.ts': 'const s = "</' + 'script>";' });
  const facts = await collectComponentFacts(rt, '');
  expect(facts).toHaveLength(1);
  expect(facts[0]!.file).toBe('src/lib/tricky.svelte.ts');
});
```

(The second test pins the documented fail-safe: whatever the wrap-parse does with that source, the collector resolves with an entry for the file instead of rejecting.)

- [ ] **Step 2: Run to verify the first new test fails**

Run: `pnpm --filter @svelte-vitals/core test -- component-collect`
Expected: FAIL — module files are not globbed, so `facts` is empty.

- [ ] **Step 3: Extend the collector**

In `packages/core/src/component-collect.ts`, replace the glob line (36) with:

```ts
const patterns = ['src/**/*.svelte', 'src/**/*.svelte.ts', 'src/**/*.svelte.js'];
const lists = await Promise.all(patterns.map((p) => rt.glob(p, cwd)));
const files = [...new Set(lists.flat())];
```

Update the function's doc comment first line to:

```ts
/**
 * Scan every `.svelte` component and `.svelte.ts`/`.svelte.js` runes module under `src/`
 * for Correctness/Security/Architecture/Bundle-Performance facts. Independent of route
 * resolution — covers `$lib` and non-route components too. A file that fails to read or
 * parse contributes empty facts instead of aborting the whole scan (dev tooling must
 * never throw).
 */
```

- [ ] **Step 4: Run to verify all collect tests pass**

Run: `pnpm --filter @svelte-vitals/core test -- component-collect`
Expected: PASS (including the existing sort/fallback tests — the `Set` dedupe keeps the pattern-oblivious inline mock in the sort test from double-counting).

- [ ] **Step 5: Run downstream suites (vite consumes this collector), then commit**

Run: `pnpm test`
Expected: PASS across all packages.

```bash
git add packages/core
git commit -m "feat(core): collect .svelte.ts/.svelte.js runes modules in collectComponentFacts"
```

---

### Task 4: The CORRECT006 rule + registration

**Files:**

- Create: `packages/core/src/rules/correctness/correct006-orphan-effect.ts`
- Modify: `packages/core/src/rules/index.ts` (import after line 42; `allRules` after line 91; re-export after line 143)
- Modify: `packages/core/src/index.ts` (re-export after line 88)
- Modify: `packages/core/test/correctness-rules.test.ts` (new describe)

**Interfaces:**

- Consumes: `componentRule` factory; `ComponentFacts.orphanEffects` from Task 1.
- Produces: exported `correct006OrphanEffect: Rule`, registered in `allRules` (CLI/vite/MCP pick it up automatically).

- [ ] **Step 1: Write the failing rule tests**

In `packages/core/test/correctness-rules.test.ts`: add `correct006OrphanEffect` to the import from `../src/index.js`, add `parseComponentFacts` to a new import from `../src/component-parse.js`, and append:

```ts
describe('CORRECT006 orphan $effect', () => {
  it('flags a top-level module $effect as critical', async () => {
    const rs = await correct006OrphanEffect.check(
      ctx([comp({ file: 'src/lib/store.svelte.ts', orphanEffects: [{ line: 2, kind: 'top-level' }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('critical');
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.route).toBe('src/lib/store.svelte.ts');
    expect(rs[0]!.line).toBe(2);
    expect(rs[0]!.message).toContain('effect_orphan');
  });
  it('names the class in the constructor-instantiated message', async () => {
    const rs = await correct006OrphanEffect.check(
      ctx([
        comp({
          orphanEffects: [{ line: 8, kind: 'constructor-instantiated', className: 'QuizStateManager' }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('QuizStateManager');
    expect(rs[0]!.message).toContain('constructor');
  });
  it('emits nothing for a component with no orphan effects', async () => {
    expect(await correct006OrphanEffect.check(ctx([comp({})]))).toHaveLength(0);
  });
  it('emits nothing when the component channel is unset (rendered mode)', async () => {
    expect(await correct006OrphanEffect.check(base as RuleContext)).toHaveLength(0);
  });
  it('end-to-end: real module source yields a critical finding; a suppression silences its line', async () => {
    const src = '// svelte-vitals-disable-next-line CORRECT006\n$effect(() => {});\n$effect.pre(() => {});';
    const facts = parseComponentFacts(src, 'src/lib/store.svelte.ts');
    const rs = await correct006OrphanEffect.check(ctx([{ file: 'src/lib/store.svelte.ts', ...facts }]));
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.line).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- correctness-rules`
Expected: FAIL — `correct006OrphanEffect` is not exported.

- [ ] **Step 3: Implement the rule**

Create `packages/core/src/rules/correctness/correct006-orphan-effect.ts`:

```ts
import { componentRule } from '../component-rule.js';

export const correct006OrphanEffect = componentRule({
  id: 'CORRECT006',
  title: 'Orphan $effect',
  category: 'correctness',
  severity: 'critical',
  label: '$effect context',
  recommendation:
    'Wrap the effect in $effect.root (and own the returned cleanup), or restructure so the effect is created during component initialisation (e.g. call a setup method from a component).',
  rationale:
    'An $effect created outside component initialisation throws effect_orphan at runtime — the compiler does not catch it, and it typically surfaces as a production 500.',
  applies: (c) => c.orphanEffects.length > 0,
  bad: (c) =>
    c.orphanEffects.map((o) => ({
      line: o.line,
      message:
        o.kind === 'top-level'
          ? '$effect at module scope runs outside component initialisation — it throws effect_orphan at runtime'
          : `class "${o.className}" runs $effect in its constructor and is instantiated at module scope — it throws effect_orphan at runtime`
    }))
});
```

- [ ] **Step 4: Register in all four sites**

1. `packages/core/src/rules/index.ts` — after the `correct005PropMutation` import (line 42):

```ts
import { correct006OrphanEffect } from './correctness/correct006-orphan-effect.js';
```

2. Same file — in `allRules`, after `correct005PropMutation,` (line 91): `correct006OrphanEffect,`
3. Same file — in the re-export block, after `correct005PropMutation,` (line 143): `correct006OrphanEffect,`
4. `packages/core/src/index.ts` — in the `export { ... } from './rules/index.js'` list, after `correct005PropMutation,` (line 88): `correct006OrphanEffect,`

Then verify no site was missed (the fourth is not typechecked):

Run: `grep -rn "correct006OrphanEffect" packages/core/src`
Expected: 5 hits — the rule file itself, 3 in `rules/index.ts`, 1 in `index.ts`.

- [ ] **Step 5: Run to verify the rule tests pass**

Run: `pnpm --filter @svelte-vitals/core test -- correctness-rules`
Expected: PASS.

- [ ] **Step 6: Full test suite (docs-links will now fail — expected), then commit**

Run: `pnpm test`
Expected: everything passes EXCEPT `packages/cli/test/docs-links.test.ts`, which fails because `docs/src/content/docs/rules/correct006.md` / `ja/rules/correct006.md` don't exist yet (Task 5). If anything else fails, fix it before committing.

```bash
git add packages/core
git commit -m "feat(core): add CORRECT006 — flag orphan \$effect that throws effect_orphan at runtime"
```

---

### Task 5: Docs (en/ja), changeset, full verification

**Files:**

- Create: `docs/src/content/docs/rules/correct006.md`
- Create: `docs/src/content/docs/ja/rules/correct006.md`
- Create: `.changeset/correct006-orphan-effect.md`

**Interfaces:**

- Consumes: the rule id CORRECT006 (docs-links test derives required doc paths from `allRules`).
- Produces: release notes + rule reference pages; nothing downstream.

- [ ] **Step 1: Write the English rule page**

Create `docs/src/content/docs/rules/correct006.md`:

````md
---
title: CORRECT006 · Orphan $effect
description: An $effect created outside component initialisation throws effect_orphan at runtime.
---

**Severity:** critical · **Category:** correctness

## What it checks

Flags `$effect` / `$effect.pre` calls that are guaranteed to run outside component initialisation, so they throw Svelte's `effect_orphan` error at runtime:

- A **top-level effect** in a `.svelte.ts` / `.svelte.js` runes module or in a `.svelte` `<script module>` block — it runs when the module is imported, outside any component's initialisation.
- A **module-scope `new`** of a class declared in the same file whose constructor creates a bare `$effect` (one not wrapped in `$effect.root`) — the shared-state-manager pattern. The finding points at the `new` site.

Not flagged: effects inside functions (including factory functions and IIFEs), effects inside an `$effect.root(...)` callback, classes that are only instantiated inside components, and classes imported from another file. Detection never crosses a function boundary, so it has no false positives by construction — at the cost of missing cross-file and factory variants.

## Why it matters

The Svelte compiler compiles all of these patterns without a warning; the failure is runtime-only. In development it can go unnoticed (the module may only be imported on certain routes), and in production it surfaces as a crash — typically a 500 on every page that imports the module. Reactive effects can only be created while a component is initialising, or inside an explicit `$effect.root` scope.

## How to fix

```ts
// store.svelte.ts
class QuizStateManager {
  bookmarks = $state<string[]>([]);
  constructor() {
    // ❌ effect_orphan at runtime — no component context at module scope
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  }
}
export const quizState = new QuizStateManager();
```

Either create a standalone reactive scope with `$effect.root` — fine when the effect should live for the whole app; own the returned cleanup function if it shouldn't:

```ts
constructor() {
  $effect.root(() => {
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  });
}
```

Or set the effect up during component initialisation instead:

```ts
class QuizStateManager {
  bookmarks = $state<string[]>([]);
  startPersisting() {
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  }
}
export const quizState = new QuizStateManager();
```

```svelte
<!-- +layout.svelte -->
<script>
  import { quizState } from '$lib/store.svelte.ts';
  quizState.startPersisting();
</script>
```
````

- [ ] **Step 2: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/correct006.md`:

````md
---
title: CORRECT006 · 孤立した $effect
description: コンポーネント初期化の外で作られた $effect はランタイムで effect_orphan エラーになります。
---

**重大度:** critical · **カテゴリ:** correctness

## チェック内容

コンポーネント初期化の外で実行されることが確定している `$effect` / `$effect.pre` 呼び出しを検出します — これらはランタイムで Svelte の `effect_orphan` エラーを投げます:

- `.svelte.ts` / `.svelte.js` の runes モジュール、または `.svelte` の `<script module>` ブロックの**トップレベルの effect** — モジュールの import 時に実行され、どのコンポーネントの初期化コンテキストにも属しません。
- constructor で裸の `$effect`(`$effect.root` で包まれていないもの)を作るクラス(同一ファイル内で宣言)の**モジュールスコープでの `new`** — 共有状態マネージャのパターンです。検出位置は `new` の行になります。

検出対象外: 関数内の effect(ファクトリ関数・IIFE を含む)、`$effect.root(...)` コールバック内の effect、コンポーネント内でのみインスタンス化されるクラス、他ファイルから import されたクラス。検出は関数境界を決して越えないため、構造上誤検出はありません — その代わりクロスファイルやファクトリ経由のケースは検出できません。

## 重要な理由

Svelte コンパイラはこれらのパターンをすべて警告なしでコンパイルします — 失敗はランタイムでのみ起こります。開発中は気づかないことがあり(そのモジュールが特定のルートでしか import されない場合など)、本番ではクラッシュとして顕在化します — 典型的にはそのモジュールを import するすべてのページで 500 エラーになります。リアクティブな effect はコンポーネントの初期化中、または明示的な `$effect.root` スコープ内でしか作れません。

## 修正方法

```ts
// store.svelte.ts
class QuizStateManager {
  bookmarks = $state<string[]>([]);
  constructor() {
    // ❌ ランタイムで effect_orphan — モジュールスコープにコンポーネントコンテキストはない
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  }
}
export const quizState = new QuizStateManager();
```

`$effect.root` でスタンドアロンのリアクティブスコープを作るか(アプリ全体と同じ寿命ならそのままで可、そうでなければ返り値のクリーンアップ関数を確実に呼ぶこと):

```ts
constructor() {
  $effect.root(() => {
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  });
}
```

または effect のセットアップをコンポーネント初期化時に行うよう構造を変えます:

```ts
class QuizStateManager {
  bookmarks = $state<string[]>([]);
  startPersisting() {
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  }
}
export const quizState = new QuizStateManager();
```

```svelte
<!-- +layout.svelte -->
<script>
  import { quizState } from '$lib/store.svelte.ts';
  quizState.startPersisting();
</script>
```
````

- [ ] **Step 3: Verify docs-links passes**

Run: `pnpm --filter svelte-vitals test -- docs-links`
Expected: PASS.

- [ ] **Step 4: Add the changeset**

Create `.changeset/correct006-orphan-effect.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add CORRECT006 (critical): flag orphan `$effect` calls that throw `effect_orphan` at runtime — a top-level `$effect` in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>`, and a module-scope `new` of a class whose constructor creates a bare `$effect`. `.svelte.ts`/`.svelte.js` runes modules are now analyzed by the component-facts pipeline.
```

- [ ] **Step 5: Full verification**

Run, from the repo root, and confirm each passes:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

If `pnpm lint` fails on formatting, run `pnpm format` and re-run.

- [ ] **Step 6: Commit**

```bash
git add docs/src/content/docs/rules/correct006.md docs/src/content/docs/ja/rules/correct006.md .changeset/correct006-orphan-effect.md
git commit -m "docs: add CORRECT006 rule reference (en/ja) and changeset"
```

---

## Done criteria

- `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all green from the repo root.
- `grep -rn "correct006OrphanEffect" packages/core/src` shows all 5 registration hits.
- Running the CLI against a project containing the spec's `QuizStateManager` module reports a critical CORRECT006 finding at the `new` line (manual smoke check via `/verify` before the PR).
- PR body in English (repo convention).
