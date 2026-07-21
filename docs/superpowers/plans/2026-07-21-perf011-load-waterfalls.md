# PERF011 / PERF013 Load Waterfalls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PERF011 (dependent sequential awaits in universal loads → move to server load, warning) and PERF013 (independent sequential awaits in any load → Promise.all, info), fed by a forward-taint analysis of the exported `load` function.

**Architecture:** A new parser function `collectLoadWaterfalls` in `kit-module-parse.ts` scans the load body's straight-line statements (direct `try` blocks inlined), classifies each await site as dependent/independent via forward taint propagation with nested-function shadow threading, and records the lines in a new optional `KitModuleFacts.loadWaterfalls` fact. Two `kitModuleRule`-factory rules consume it, split by the existing `kind` field. No CLI/vite producer changes — the kit-module channel already flows end to end.

**Tech Stack:** TypeScript, existing kit-module wrap-parse infrastructure, vitest.

**Spec:** `docs/superpowers/specs/2026-07-21-perf011-load-waterfalls-design.md` (approved).

## Global Constraints

- **Core purity**: no `node:` imports, no I/O in `packages/core/src`.
- PERF011: id `PERF011`, title `Load waterfall`, category `performance`, severity `warning`, fires only for `kind === 'universal'` files. Message (exact): `Sequential dependent awaits in a universal load create a client-side request waterfall — each hop is a network round trip from the browser. Move this chain to a server load (+page.server.ts / +layout.server.ts), where the hops run server-side.`
- PERF013: id `PERF013`, title `Sequential independent awaits`, category `performance`, severity `info`, fires for both kinds. Message (exact): `This await does not use the results of the awaits before it — the requests run sequentially for no reason. Start them together and await them with Promise.all.`
- Never detected: single-await loads; awaits inside `if`/loops/`switch`/`catch`/nested closures (direct `try` blocks ARE scanned); `await parent()` sites (excluded from classification, but their bound names DO taint); dependent chains in server loads (fact recorded, PERF011 filters); files without a `load` export; `actions`/HTTP handlers; malformed sources (the collect layer's existing catch yields empty facts — the parse layer itself may throw, as it does today).
- One await site per statement; a site is classified dependent when ANY of its awaits' argument subtrees references a tainted name (shadow-aware); otherwise independent if a prior non-excluded site exists.
- Registration in four places per rule; `grep -rn "perf011LoadWaterfall" packages/core/src` and `grep -rn "perf013SequentialAwaits" packages/core/src` must each yield exactly 5 hits.
- Environment: EVERY pnpm command must be prefixed `npm_config_verify_deps_before_run=false pnpm ...`; NEVER run `pnpm install`. Build core before cli/vite tests: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core build`. CLI package filter name is `svelte-vitals`.
- `packages/cli/test/docs-links.test.ts` fails for PERF011/PERF013 until Task 4 adds the docs pages — expected until then.
- Run `pnpm exec prettier --write` on every touched file before each commit.
- Conventional commits scoped by package.

---

### Task 1: Parser — `collectLoadWaterfalls` + fact field

**Files:**

- Modify: `packages/core/src/kit-module-parse.ts` (new functions + wiring into `parseKitModuleFacts`)
- Modify: `packages/core/src/kit-module.ts` (fact field)
- Test: `packages/core/test/load-waterfalls.test.ts` (new)

**Interfaces:**

- Consumes (already in kit-module-parse.ts or imported there): `unwrapTs`, `unwrapExport`, `collectTopLevelBindings`, `isFunctionNode`, `addBoundNames`, `scopeIntroducedNames`, `WALK_IGNORED_KEYS`, `lineOf`.
- Produces: `KitModuleFacts.loadWaterfalls?: { dependentLines: number[]; independentLines: number[] }` — consumed by Task 2's rules.

- [ ] **Step 1: Add the fact field**

In `packages/core/src/kit-module.ts`, after the `ssrDisabled` member, add:

```ts
  /** Sequential-await analysis of the exported `load` function (PERF011/PERF013): 1-based lines of await sites that depend on an earlier await's result, and of sites independent of all earlier awaits. Set only when at least one list is non-empty. */
  loadWaterfalls?: { dependentLines: number[]; independentLines: number[] };
```

- [ ] **Step 2: Write the failing tests**

Create `packages/core/test/load-waterfalls.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseKitModuleFacts } from '../src/kit-module-parse.js';

const wf = (src: string) => parseKitModuleFacts(src, 'src/routes/+page.ts').loadWaterfalls;

describe('collectLoadWaterfalls — dependent chains', () => {
  it('flags a direct dependent await', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const user = await fetch("/api/user").then((r) => r.json());',
      '  const posts = await fetch(`/api/posts/${user.id}`);',
      '  return { user, posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [3], independentLines: [] });
  });

  it('tracks taint through an intermediate const', () => {
    const src = [
      'export const load = async ({ fetch }) => {',
      '  const res = await fetch("/api/user");',
      '  const id = res.id;',
      '  const posts = await fetch(`/api/posts/${id}`);',
      '  return { posts };',
      '};'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [4], independentLines: [] });
  });

  it('tracks destructured bindings', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const { id } = await fetch("/api/user").then((r) => r.json());',
      '  const posts = await fetch(`/api/posts/${id}`);',
      '  return { posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [3], independentLines: [] });
  });

  it('classifies a chained member await as dependent', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const res = await fetch("/api/user");',
      '  const data = (await res.json()).items;',
      '  return { data };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [3], independentLines: [] });
  });
});

describe('collectLoadWaterfalls — independent sites', () => {
  it('flags the second of two unrelated awaits', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const a = await fetch("/api/a");',
      '  const b = await fetch("/api/b");',
      '  return { a, b };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3] });
  });

  it('flags an independent await in a return object', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const user = await fetch("/api/user").then((r) => r.json());',
      '  return { user, posts: await fetch("/api/posts") };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3] });
  });

  it('mixes dependent and independent sites in one load', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const user = await fetch("/api/user").then((r) => r.json());',
      '  const posts = await fetch(`/api/posts/${user.id}`);',
      '  const banner = await fetch("/api/banner");',
      '  return { user, posts, banner };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [3], independentLines: [4] });
  });
});

describe('collectLoadWaterfalls — exclusions and scope', () => {
  it('excludes await parent() but lets its bindings taint', () => {
    const src = [
      'export async function load({ parent, fetch }) {',
      '  const p = await parent();',
      '  const extra = await fetch(`/api/extra/${p.section}`);',
      '  return { extra };',
      '}'
    ].join('\n');
    // parent() is not a site; the fetch depends on p → dependent, and there is no independent site.
    expect(wf(src)).toEqual({ dependentLines: [3], independentLines: [] });
  });

  it('does not count a first await after parent() as independent', () => {
    const src = [
      'export async function load({ parent, fetch }) {',
      '  await parent();',
      '  const a = await fetch("/api/a");',
      '  return { a };',
      '}'
    ].join('\n');
    expect(wf(src)).toBeUndefined();
  });

  it('ignores a shadowing callback parameter', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const items = await fetch("/api/items").then((r) => r.json());',
      '  const names = await fetch("/api/names", { headers: mk((items) => items.h) });',
      '  return { items, names };',
      '}'
    ].join('\n');
    // the inner `items` param shadows the tainted binding → NOT dependent
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3] });
  });

  it('scans direct try-block statements', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  try {',
      '    const a = await fetch("/api/a");',
      '    const b = await fetch("/api/b");',
      '    return { a, b };',
      '  } catch {',
      '    return {};',
      '  }',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [4] });
  });

  it('does not descend into if blocks, loops, or nested functions', () => {
    const src = [
      'export async function load({ fetch, url }) {',
      '  const a = await fetch("/api/a");',
      '  if (url.searchParams.has("x")) {',
      '    const b = await fetch("/api/b");',
      '  }',
      '  for (const p of [1, 2]) {',
      '    await fetch(`/api/${p}`);',
      '  }',
      '  const helper = async () => await fetch("/api/c");',
      '  return { a };',
      '}'
    ].join('\n');
    expect(wf(src)).toBeUndefined();
  });

  it('resolves an alias-exported load', () => {
    const src = [
      'const myLoad = async ({ fetch }) => {',
      '  const a = await fetch("/api/a");',
      '  const b = await fetch("/api/b");',
      '  return { a, b };',
      '};',
      'export { myLoad as load };'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3] });
  });

  it('is unset for single-await loads and no-load files', () => {
    expect(wf('export async function load({ fetch }) {\n  return { a: await fetch("/a") };\n}')).toBeUndefined();
    expect(wf('export const actions = {};')).toBeUndefined();
    // Malformed sources throw at this layer by design — collectKitModuleFacts catches
    // and falls back to emptyKitModuleFacts (already pinned by the existing
    // malformed-file tests), so `loadWaterfalls` stays unset there too.
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test -- load-waterfalls`
Expected: FAIL — `loadWaterfalls` is undefined in every positive case.

- [ ] **Step 4: Implement the parser**

In `packages/core/src/kit-module-parse.ts`, add these functions (place them after `findSsrFalseOptOut`):

```ts
/**
 * The exported `load` function node (inline `export function load` / `export const
 * load = …`, `satisfies`/`as` unwrapped) or a same-file alias export. Cross-file
 * re-exports stay unresolved, matching the other collectors' scope.
 */
function findLoadFunction(program: Node): Node | undefined {
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue;
    const decl = stmt.declaration;
    if (decl.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier' && decl.id.name === 'load') return decl;
    if (decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || d.id.name !== 'load' || !d.init) continue;
      const init = unwrapTs(d.init);
      if (isFunctionNode(init)) return init;
    }
  }
  const bindings = collectTopLevelBindings(program);
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.specifiers || stmt.source || stmt.exportKind === 'type')
      continue;
    for (const s of stmt.specifiers) {
      if (s?.exportKind === 'type' || s?.exported?.type !== 'Identifier' || s?.local?.type !== 'Identifier') continue;
      if (s.exported.name !== 'load') continue;
      const resolved = bindings.get(s.local.name);
      if (resolved && isFunctionNode(resolved)) return resolved;
    }
  }
  return undefined;
}

/** All AwaitExpression nodes in `node`, not descending into nested functions. */
function collectAwaits(node: Node, out: Node[] = []): Node[] {
  if (Array.isArray(node)) {
    for (const child of node) collectAwaits(child, out);
    return out;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return out;
  if (isFunctionNode(node)) return out;
  if (node.type === 'AwaitExpression') out.push(node);
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    collectAwaits(node[key], out);
  }
  return out;
}

/** Whether `await`'s argument is a `parent()` / `<x>.parent()` call (Kit's parent-load step, PERF011/013-exempt). */
function isParentCall(arg: Node): boolean {
  const e = unwrapTs(arg);
  if (e?.type !== 'CallExpression') return false;
  const callee = e.callee;
  if (callee?.type === 'Identifier' && callee.name === 'parent') return true;
  return callee?.type === 'MemberExpression' && !callee.computed && callee.property?.name === 'parent';
}

/**
 * Whether the expression references any tainted name. Threads nested-function
 * shadowing (`scopeIntroducedNames`) so a callback parameter that shadows a
 * tainted binding does not create a false dependency; non-computed member
 * properties and object keys don't count as references.
 */
function refsTainted(node: Node, tainted: Set<string>): boolean {
  let hit = false;
  const walk = (n: Node, shadowed: Set<string>): void => {
    if (hit) return;
    if (Array.isArray(n)) {
      for (const child of n) walk(child, shadowed);
      return;
    }
    if (!n || typeof n !== 'object' || typeof n.type !== 'string') return;
    const introduced = scopeIntroducedNames(n);
    const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
    if (n.type === 'Identifier' && tainted.has(n.name) && !scope.has(n.name)) {
      hit = true;
      return;
    }
    for (const key of Object.keys(n)) {
      if (WALK_IGNORED_KEYS.has(key)) continue;
      if (n.type === 'MemberExpression' && key === 'property' && !n.computed) continue;
      if (n.type === 'Property' && key === 'key' && !n.computed) continue;
      walk(n[key], scope);
    }
  };
  walk(node, new Set());
  return hit;
}

/**
 * PERF011/PERF013 — forward-taint analysis of the exported `load`'s straight-line
 * statements (direct `try` blocks inlined; `if`/loops/`switch`/`catch`/nested
 * functions are not entered). One await site per statement; a site whose awaits'
 * argument subtrees reference an earlier site's bindings (transitively, through
 * intermediate consts) is dependent, otherwise independent when a prior site
 * exists. `await parent()` is never a site, but its bindings taint. Lines are
 * returned in ORIGINAL-source coordinates (the −1 wrap shift is applied here).
 */
function collectLoadWaterfalls(
  program: Node,
  wrapped: string
): { dependentLines: number[]; independentLines: number[] } {
  const dependentLines: number[] = [];
  const independentLines: number[] = [];
  const load = findLoadFunction(program);
  if (!load?.body || load.body.type !== 'BlockStatement') return { dependentLines, independentLines };

  const statements: Node[] = [];
  const pushStmts = (body: Node[]): void => {
    for (const stmt of body ?? []) {
      if (stmt?.type === 'TryStatement' && stmt.block?.type === 'BlockStatement') pushStmts(stmt.block.body);
      else if (stmt) statements.push(stmt);
    }
  };
  pushStmts(load.body.body);

  const line = (start: number) => Math.max(0, lineOf(wrapped, start) - 1);
  const tainted = new Set<string>();
  let sawAwaitSite = false;

  for (const stmt of statements) {
    if (stmt.type === 'VariableDeclaration' || stmt.type === 'ExpressionStatement' || stmt.type === 'ReturnStatement') {
      const sites = collectAwaits(stmt).filter((a) => !isParentCall(a.argument));
      if (sites.length > 0) {
        const first = sites.reduce((m, a) => (a.start < m.start ? a : m));
        if (sites.some((a) => refsTainted(a.argument, tainted))) dependentLines.push(line(first.start));
        else if (sawAwaitSite) independentLines.push(line(first.start));
        sawAwaitSite = true;
      }
      if (stmt.type === 'VariableDeclaration') {
        for (const d of stmt.declarations ?? []) {
          if (!d?.id || !d.init) continue;
          if (collectAwaits(d.init).length > 0 || refsTainted(d.init, tainted)) addBoundNames(d.id, tainted);
        }
      }
    }
  }
  return { dependentLines, independentLines };
}
```

- [ ] **Step 5: Wire into `parseKitModuleFacts`**

In `parseKitModuleFacts` (same file), next to where `ssrOptOut` is computed near the end, add:

```ts
const waterfalls = collectLoadWaterfalls(program, wrapped);
```

and in the returned object, after the `ssrDisabled` spread line, add:

```ts
    ...(waterfalls.dependentLines.length > 0 || waterfalls.independentLines.length > 0
      ? { loadWaterfalls: waterfalls }
      : {}),
```

Note the malformed-source early return (`if (!program)`) already returns a facts object without the field — no change needed there.

- [ ] **Step 6: Run tests to verify they pass, then the full core suite**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test -- load-waterfalls`
Expected: PASS (13 tests).
Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test`
Expected: all pass (the new field is optional; existing kit-module tests that assert whole-object equality use per-field matchers, but if any full-equality assertion fails only by the new field, update that pin and note it in your report).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/kit-module-parse.ts packages/core/src/kit-module.ts packages/core/test/load-waterfalls.test.ts
git commit -m "feat(core): analyze load functions for await waterfalls (PERF011/PERF013 fact)"
```

---

### Task 2: Rules PERF011 + PERF013, factory `fix` support, registration

**Files:**

- Modify: `packages/core/src/rules/kit-module-rule.ts` (widen category union; optional `fix`)
- Create: `packages/core/src/rules/perf/perf011-load-waterfall.ts`
- Create: `packages/core/src/rules/perf/perf013-sequential-awaits.ts`
- Modify: `packages/core/src/rules/index.ts` (imports + `allRules` + re-exports)
- Modify: `packages/core/src/index.ts` (named re-exports — the untypechecked fourth place)
- Test: `packages/core/test/perf-waterfall-rules.test.ts` (new)

**Interfaces:**

- Consumes: `KitModuleFacts.loadWaterfalls` and `kind` (Task 1); `kitModuleRule` factory.
- Produces: exported rules `perf011LoadWaterfall`, `perf013SequentialAwaits`.

- [ ] **Step 1: Extend the factory**

In `packages/core/src/rules/kit-module-rule.ts`:

1. Add to the imports: `import type { Fix, Result, Severity } from '../types.js';` (replace the existing type-import line).
2. In `KitModuleRuleOptions`, change the category line and add `fix`:

```ts
  /** Kit-file rules report as Security (SEC003–005), SEO (SEO031), or Performance (PERF011/PERF013). */
  category: 'security' | 'seo' | 'performance';
  /** Agent-actionable remediation attached to the rule and each penalized finding. */
  fix?: Fix;
```

3. In the returned rule object, add `...(opts.fix ? { fix: opts.fix } : {}),` after `rationale`, and in the penalized-result push (the `for (const b of bad)` loop), add `...(opts.fix ? { fix: { ...opts.fix } } : {}),` after `docsUrl`.

- [ ] **Step 2: Write the failing rule tests**

Create `packages/core/test/perf-waterfall-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { perf011LoadWaterfall } from '../src/rules/perf/perf011-load-waterfall.js';
import { perf013SequentialAwaits } from '../src/rules/perf/perf013-sequential-awaits.js';
import { emptyKitModuleFacts } from '../src/kit-module-collect.js';
import { defaultProject, defaultConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { KitModuleFacts } from '../src/kit-module.js';

function ctx(modules: KitModuleFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config: defaultConfig, kitModules: modules } as RuleContext;
}

function mod(
  file: string,
  kind: KitModuleFacts['kind'],
  loadWaterfalls?: KitModuleFacts['loadWaterfalls']
): KitModuleFacts {
  return { ...emptyKitModuleFacts(file, kind), ...(loadWaterfalls ? { loadWaterfalls } : {}) };
}

describe('PERF011 load waterfall', () => {
  it('flags dependent lines in universal files only', async () => {
    const results = await perf011LoadWaterfall.check(
      ctx([
        mod('src/routes/+page.ts', 'universal', { dependentLines: [3, 7], independentLines: [] }),
        mod('src/routes/admin/+page.server.ts', 'server', { dependentLines: [4], independentLines: [] })
      ])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized.map((r) => ({ file: r.location, line: r.line }))).toEqual([
      { file: 'src/routes/+page.ts', line: 3 },
      { file: 'src/routes/+page.ts', line: 7 }
    ]);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toContain('client-side request waterfall');
    expect(penalized[0]!.fix?.description).toBeTruthy();
  });

  it('emits nothing without dependent lines', async () => {
    const results = await perf011LoadWaterfall.check(
      ctx([mod('src/routes/+page.ts', 'universal', { dependentLines: [], independentLines: [2] })])
    );
    expect(results).toEqual([]);
  });
});

describe('PERF013 sequential independent awaits', () => {
  it('flags independent lines in both kinds at info severity', async () => {
    const results = await perf013SequentialAwaits.check(
      ctx([
        mod('src/routes/+page.ts', 'universal', { dependentLines: [], independentLines: [3] }),
        mod('src/routes/+page.server.ts', 'server', { dependentLines: [], independentLines: [5] })
      ])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized.map((r) => ({ file: r.location, line: r.line }))).toEqual([
      { file: 'src/routes/+page.ts', line: 3 },
      { file: 'src/routes/+page.server.ts', line: 5 }
    ]);
    expect(penalized[0]!.severity).toBe('info');
    expect(penalized[0]!.message).toContain('Promise.all');
  });

  it('is registered along with PERF011', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'PERF011')).toBe(true);
    expect(allRules.some((r) => r.id === 'PERF013')).toBe(true);
    expect(explainRule('perf011')?.severity).toBe('warning');
    expect(explainRule('perf013')?.severity).toBe('info');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test -- perf-waterfall-rules`
Expected: FAIL — rule modules not found.

- [ ] **Step 4: Implement the two rules**

Create `packages/core/src/rules/perf/perf011-load-waterfall.ts`:

```ts
import { kitModuleRule } from '../kit-module-rule.js';

const MESSAGE =
  'Sequential dependent awaits in a universal load create a client-side request waterfall — each hop is a network round trip from the browser. Move this chain to a server load (+page.server.ts / +layout.server.ts), where the hops run server-side.';

/**
 * PERF011 — dependent await chains in universal loads. Server loads are exempt:
 * a dependent chain cannot be parallelized, and on the server there is no better
 * placement to suggest.
 */
export const perf011LoadWaterfall = kitModuleRule({
  id: 'PERF011',
  title: 'Load waterfall',
  category: 'performance',
  severity: 'warning',
  label: 'No load waterfalls',
  recommendation:
    'Move the dependent await chain into a server load (+page.server.ts / +layout.server.ts), where the hops run server-to-server.',
  rationale:
    'In a universal load, every await that depends on a previous result costs a full network round trip from the browser on client-side navigation; chains multiply latency on every page visit. A server load runs the same hops server-side.',
  fix: {
    description:
      'Move the dependent await chain into a server load (+page.server.ts), where hops run server-to-server.',
    snippet:
      '// +page.server.ts — same chain, server-side hops\nexport async function load({ fetch }) {\n  const user = await fetch(`/api/user`).then((r) => r.json());\n  const posts = await fetch(`/api/posts/${user.id}`).then((r) => r.json());\n  return { user, posts };\n}',
    lang: 'ts'
  },
  applies: (m) => m.kind === 'universal' && (m.loadWaterfalls?.dependentLines.length ?? 0) > 0,
  bad: (m) => m.loadWaterfalls!.dependentLines.map((line) => ({ line, message: MESSAGE }))
});
```

Create `packages/core/src/rules/perf/perf013-sequential-awaits.ts`:

```ts
import { kitModuleRule } from '../kit-module-rule.js';

const MESSAGE =
  'This await does not use the results of the awaits before it — the requests run sequentially for no reason. Start them together and await them with Promise.all.';

/**
 * PERF013 — independent sequential awaits in any load. Info severity: static
 * data flow cannot see side-effect ordering (e.g. a setup call an API relies
 * on), so the parallelize suggestion stays advisory.
 */
export const perf013SequentialAwaits = kitModuleRule({
  id: 'PERF013',
  title: 'Sequential independent awaits',
  category: 'performance',
  severity: 'info',
  label: 'No needlessly sequential awaits',
  recommendation: 'Start the independent requests together and await them with Promise.all.',
  rationale:
    'Awaits that do not use each other’s results still run one after another, adding their latencies; starting them together costs nothing and bounds the wait to the slowest request.',
  fix: {
    description: 'Start the independent requests together and await them with Promise.all.',
    snippet: 'const [a, b] = await Promise.all([fetchA(), fetchB()]);',
    lang: 'ts'
  },
  applies: (m) => (m.loadWaterfalls?.independentLines.length ?? 0) > 0,
  bad: (m) => m.loadWaterfalls!.independentLines.map((line) => ({ line, message: MESSAGE }))
});
```

- [ ] **Step 5: Register both rules in all four places**

1. `packages/core/src/rules/index.ts` — after the `perf012MinifyDisabled` import:
   ```ts
   import { perf011LoadWaterfall } from './perf/perf011-load-waterfall.js';
   import { perf013SequentialAwaits } from './perf/perf013-sequential-awaits.js';
   ```
2. Same file — append `perf011LoadWaterfall,` and `perf013SequentialAwaits` at the END of `allRules` (after `perf012MinifyDisabled`).
3. Same file — append both names at the END of the `export { … }` block.
4. `packages/core/src/index.ts` — append both names in the rule re-export block after `perf012MinifyDisabled`. **Untypechecked — do not skip.**

- [ ] **Step 6: Verify registration with grep**

Run: `grep -rn "perf011LoadWaterfall" packages/core/src | wc -l` → Expected `5`.
Run: `grep -rn "perf013SequentialAwaits" packages/core/src | wc -l` → Expected `5`.

- [ ] **Step 7: Run the full core suite**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test`
Expected: all pass. If a test pins the full rule list or per-category counts, update the pin and note it.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/kit-module-rule.ts packages/core/src/rules/perf/perf011-load-waterfall.ts packages/core/src/rules/perf/perf013-sequential-awaits.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/perf-waterfall-rules.test.ts
git commit -m "feat(core): add PERF011 load-waterfall and PERF013 sequential-awaits rules"
```

---

### Task 3: CLI integration fixtures

**Files:**

- Create: `packages/cli/test/fixtures/waterfall-project/package.json`
- Create: `packages/cli/test/fixtures/waterfall-project/src/app.html`
- Create: `packages/cli/test/fixtures/waterfall-project/src/routes/+page.svelte`
- Create: `packages/cli/test/fixtures/waterfall-project/src/routes/+page.ts`
- Create: `packages/cli/test/fixtures/waterfall-project/src/routes/server/+page.svelte`
- Create: `packages/cli/test/fixtures/waterfall-project/src/routes/server/+page.server.ts`
- Test: `packages/cli/test/analyze-project.test.ts` (add cases)

**Interfaces:**

- Consumes: rules from Task 2 via the built core package; the existing `analyzeProject` harness in the test file.
- Produces: end-to-end pins for file/line/severity of both rules.

- [ ] **Step 0: Build core**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core build`

- [ ] **Step 1: Create the fixture**

`packages/cli/test/fixtures/waterfall-project/package.json`:

```json
{
  "name": "waterfall-project-fixture",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@sveltejs/kit": "^2.0.0"
  }
}
```

`packages/cli/test/fixtures/waterfall-project/src/app.html`:

```html
<!doctype html>
<html lang="en">
  <body>
    %sveltekit.body%
  </body>
</html>
```

`packages/cli/test/fixtures/waterfall-project/src/routes/+page.svelte`:

```svelte
<script>
  let { data } = $props();
</script>

<svelte:head>
  <title>Waterfall</title>
</svelte:head>

<h1>{data.user}</h1>
```

`packages/cli/test/fixtures/waterfall-project/src/routes/+page.ts` (dependent at line 3, independent at line 4):

```ts
export async function load({ fetch }) {
  const user = await fetch('/api/user').then((r) => r.json());
  const posts = await fetch(`/api/posts/${user.id}`).then((r) => r.json());
  const banner = await fetch('/api/banner').then((r) => r.json());
  return { user, posts, banner };
}
```

`packages/cli/test/fixtures/waterfall-project/src/routes/server/+page.svelte`:

```svelte
<script>
  let { data } = $props();
</script>

<svelte:head>
  <title>Server</title>
</svelte:head>

<p>{data.a}</p>
```

`packages/cli/test/fixtures/waterfall-project/src/routes/server/+page.server.ts` (dependent chain lines 2–3 must NOT produce PERF011; independent at line 4 produces PERF013):

```ts
export async function load({ fetch }) {
  const user = await fetch('/api/user').then((r) => r.json());
  const detail = await fetch(`/api/detail/${user.id}`).then((r) => r.json());
  const extra = await fetch('/api/extra').then((r) => r.json());
  return { user, detail, extra };
}
```

- [ ] **Step 2: Add the integration tests**

In `packages/cli/test/analyze-project.test.ts`, mirroring the existing fixture-driven cases (reuse the file's `analyzeProject` call shape and fixtures-path helper):

```ts
it('flags PERF011 and PERF013 in a universal load, PERF013 only in a server load', async () => {
  const { results } = await analyzeProject({ cwd: fixture('waterfall-project') });
  const perf011 = results.filter((r) => r.id === 'PERF011' && r.detection.presence === 'none');
  expect(perf011.map((r) => ({ file: r.location, line: r.line }))).toEqual([{ file: 'src/routes/+page.ts', line: 3 }]);
  const perf013 = results.filter((r) => r.id === 'PERF013' && r.detection.presence === 'none');
  expect(perf013.map((r) => ({ file: r.location, line: r.line }))).toEqual([
    { file: 'src/routes/+page.ts', line: 4 },
    { file: 'src/routes/server/+page.server.ts', line: 4 }
  ]);
});
```

(If the results ordering differs, sort both sides by file then line before comparing.)

- [ ] **Step 3: Run the CLI suite**

Run: `npm_config_verify_deps_before_run=false pnpm --filter svelte-vitals test`
Expected: all pass EXCEPT `docs-links.test.ts` failures for PERF011/PERF013 (docs land in Task 4 — expected; everything else must pass).

- [ ] **Step 4: Commit**

```bash
git add packages/cli/test/fixtures/waterfall-project packages/cli/test/analyze-project.test.ts
git commit -m "test(cli): pin PERF011/PERF013 end-to-end behavior on a waterfall fixture"
```

---

### Task 4: Docs (en/ja ×2 rules), changeset, action dist, full verify

**Files:**

- Create: `docs/src/content/docs/rules/perf011.md`, `docs/src/content/docs/ja/rules/perf011.md`
- Create: `docs/src/content/docs/rules/perf013.md`, `docs/src/content/docs/ja/rules/perf013.md`
- Create: `.changeset/perf011-load-waterfalls.md`
- Modify: `packages/action/dist/*` (rebuild)

- [ ] **Step 1: Write `docs/src/content/docs/rules/perf011.md`**

````markdown
---
title: PERF011 · Load waterfall
description: Dependent sequential awaits in a universal load cost a network round trip from the browser per hop.
---

**Severity:** warning · **Category:** performance

## What it checks

Flags await chains in a **universal** load (`+page.ts` / `+layout.ts`) where a later await uses the result of an earlier one — directly, through destructured bindings, or through intermediate constants. Each dependent hop is a full network round trip from the browser on client-side navigation.

The scan is deliberately conservative: it follows the load body's straight-line statements (including directly `try`-wrapped ones) and does not enter `if` branches, loops, or nested functions. `await parent()` is never flagged itself, but data derived from it counts as a dependency. Dependent chains in **server** loads are not flagged — they cannot be parallelized, and they already run server-side.

## Why it matters

SvelteKit's performance guidance names request waterfalls as a primary latency source. A universal load re-runs in the browser on client-side navigation, so a chain of N dependent requests costs N sequential round trips — on every visit. Moving the chain to a server load keeps the same logic but runs the hops server-to-server, collapsing the client cost to one round trip.

## How to fix

Move the dependent chain into a server load:

```ts
// +page.server.ts — same chain, server-side hops
export async function load({ fetch }) {
  const user = await fetch(`/api/user`).then((r) => r.json());
  const posts = await fetch(`/api/posts/${user.id}`).then((r) => r.json());
  return { user, posts };
}
```

If part of the data is independent, split it out and parallelize (see PERF013).

## Limitations

Only the literal dependent-chain shape is detected; chains hidden behind branches, loops, helper functions, or module-level caches are not. A finding can be silenced per line with `// svelte-vitals-disable-next-line PERF011`.

## Disabling

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF011: 'off'
  }
};
```
````

- [ ] **Step 2: Write `docs/src/content/docs/ja/rules/perf011.md`**

````markdown
---
title: PERF011 · Load waterfall
description: universal load 内の依存する逐次 await は、1ホップごとにブラウザからのネットワーク往復を要します。
---

**重大度:** warning · **カテゴリ:** performance

## チェック内容

**universal** load(`+page.ts` / `+layout.ts`)内で、後続の await が先行する await の結果を使っているチェーン(直接参照、分割代入した束縛、中間定数経由を含む)を検出します。依存ホップ1つごとに、クライアントサイドナビゲーション時はブラウザからの完全なネットワーク往復が発生します。

走査は意図的に保守的です。load ボディの直線状のステートメント(直接 `try` で包まれたものを含む)だけを追い、`if` 分岐、ループ、ネストした関数には入りません。`await parent()` 自体は検出対象になりませんが、そこから得たデータは依存としてカウントされます。**server** load 内の依存チェーンは検出しません（並列化は不可能で、すでにサーバーサイドで実行されているためです）。

## 重要な理由

SvelteKit のパフォーマンスガイドは、リクエストウォーターフォールを主要なレイテンシ源として挙げています。universal load はクライアントサイドナビゲーションのたびにブラウザで再実行されるため、N 個の依存リクエストのチェーンは毎回 N 回の逐次往復を要します。チェーンを server load に移せばロジックはそのままに、ホップはサーバー間通信となり、クライアントのコストは1往復に収まります。

## 修正方法

依存チェーンを server load に移動します:

```ts
// +page.server.ts — same chain, server-side hops
export async function load({ fetch }) {
  const user = await fetch(`/api/user`).then((r) => r.json());
  const posts = await fetch(`/api/posts/${user.id}`).then((r) => r.json());
  return { user, posts };
}
```

一部のデータが独立している場合は、切り出して並列化してください（PERF013 を参照）。

## 制限事項

検出できるのはリテラルな依存チェーンの形だけです。分岐、ループ、ヘルパー関数、モジュールレベルのキャッシュの背後に隠れたチェーンは検出されません。行単位の抑制は `// svelte-vitals-disable-next-line PERF011` で可能です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF011: 'off'
  }
};
```
````

- [ ] **Step 3: Write `docs/src/content/docs/rules/perf013.md`**

````markdown
---
title: PERF013 · Sequential independent awaits
description: Awaits that don't use each other's results still run one after another — start them together.
---

**Severity:** info · **Category:** performance

## What it checks

Flags an await in a `load` function (universal or server) that does not use the results of any await before it — the requests serialize for no data-flow reason. Detection uses the same conservative straight-line scan as PERF011: forward taint through bindings and intermediate constants, callback-parameter shadowing respected, `await parent()` exempt.

## Why it matters

Two independent requests awaited sequentially cost the sum of their latencies; started together they cost only the slowest. In a load function this is pure waste on every page visit — `Promise.all` gives the same data with no behavior change when the requests are truly independent.

## How to fix

```ts
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

## Limitations

Static data flow cannot see side-effect ordering. If an earlier await performs setup a later request relies on (sessions, locale, cache warming), the sequence is intentional — that is why this rule reports at `info` severity. Suppress a deliberate sequence per line with `// svelte-vitals-disable-next-line PERF013`, or raise/lower the severity in your config.

## Disabling

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF013: 'off'
  }
};
```
````

- [ ] **Step 4: Write `docs/src/content/docs/ja/rules/perf013.md`**

````markdown
---
title: PERF013 · Sequential independent awaits
description: 互いの結果を使わない await の逐次実行は無駄です。同時に開始しましょう。
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

`load` 関数(universal / server の両方)内で、先行するどの await の結果も使っていない await を検出します。データフロー上の理由なくリクエストが直列化されている状態です。検出は PERF011 と同じ保守的な直線走査を使います（束縛と中間定数を通じた前方 taint 伝播、コールバック引数のシャドーイング考慮、`await parent()` は対象外）。

## 重要な理由

独立した2つのリクエストを逐次 await すると、レイテンシは両者の合計になります。同時に開始すれば最も遅いリクエスト分だけで済みます。load 関数内でのこの直列化はページ訪問のたびに発生する純粋な無駄で、リクエストが本当に独立していれば `Promise.all` は挙動を変えずに同じデータを返します。

## 修正方法

```ts
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

## 制限事項

静的なデータフロー解析には副作用の順序が見えません。先行する await が後続リクエストの前提となるセットアップ（セッション、ロケール、キャッシュ準備など）を行っている場合、その逐次実行は意図的です。このルールが `info` で報告するのはそのためです。意図的な逐次実行は `// svelte-vitals-disable-next-line PERF013` で行単位に抑制するか、設定で severity を調整してください。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF013: 'off'
  }
};
```
````

- [ ] **Step 5: Verify docs-links, add the changeset**

Run: `npm_config_verify_deps_before_run=false pnpm --filter svelte-vitals test -- docs-links`
Expected: PASS.

Create `.changeset/perf011-load-waterfalls.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add PERF011 (Load waterfall) and PERF013 (Sequential independent awaits): a forward-taint analysis of `load` functions flags dependent await chains in universal loads (move them to a server load) and independent sequential awaits in any load (parallelize with `Promise.all`).
```

- [ ] **Step 6: Rebuild action dist and run the full verify**

```bash
npm_config_verify_deps_before_run=false pnpm build
npm_config_verify_deps_before_run=false pnpm typecheck
npm_config_verify_deps_before_run=false pnpm test
npm_config_verify_deps_before_run=false pnpm lint
git status --short packages/action/dist
```

Expected: all four pass (lint: only the 2 pre-existing `meta-object.test.ts` warnings); `pnpm build` regenerates `packages/action/dist` — its diff must be committed. **Note:** run the FULL `pnpm build` (not just core+action) so the action bundle picks up every rebuilt workspace dependency — a stale sibling dist caused a CI failure on the previous branch.

- [ ] **Step 7: Commit (two commits)**

```bash
git add docs/src/content/docs/rules/perf011.md docs/src/content/docs/rules/perf013.md docs/src/content/docs/ja/rules/perf011.md docs/src/content/docs/ja/rules/perf013.md .changeset/perf011-load-waterfalls.md
git commit -m "docs: add PERF011/PERF013 rule pages (en/ja) and changeset"
git add packages/action/dist
git commit -m "chore(action): rebuild dist for PERF011/PERF013"
```
