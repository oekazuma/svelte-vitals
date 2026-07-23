# correctness/nonreactive-builtin-state Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `correctness/nonreactive-builtin-state`, a warning-severity component rule flagging plain `Map`/`Set`/`Date`/`URL`/`URLSearchParams` in `$state` whose type-specific mutations are observed inside functions — mutations `$state` cannot track, so the UI silently stops updating.

**Architecture:** A candidate pass (mirroring `state-raw`'s top-level scan, via `isPlainStateCall` + `NewExpression` type match) feeds one dedicated shadow-aware walker that threads an in-function flag and records, per candidate, type-specific mutations (in-function only) and whole-binding reassignments (bare self-assign `b = b` excluded — a Svelte 5 no-op). Flag = mutated AND never reassigned. A `componentRule` consumes the new `ComponentFacts.nonreactiveBuiltinStates` list.

**Tech Stack:** TypeScript, svelte/compiler modern AST, vitest.

**Spec:** `docs/superpowers/specs/2026-07-23-nonreactive-builtin-state-design.md` (approved after adversarial design review; the reactivity premise and the `b = b` no-op were verified empirically against svelte 5.56.6's runtime).

## Global Constraints

- Rule metadata exactly: id `correctness/nonreactive-builtin-state`, title `Non-reactive built-in in $state`, category `correctness`, severity `warning`, label `Reactive collections in $state`.
- Message template (exact, `<name>`/`<Type>` interpolated): `"<name>" is a plain <Type> in $state — its mutations are not tracked, so the UI silently stops updating when it changes. Use Svelte<Type> from 'svelte/reactivity'.`
- Recommendation (exact): `Import the reactive equivalent from 'svelte/reactivity' (SvelteMap, SvelteSet, SvelteDate, SvelteURL, SvelteURLSearchParams) and construct that instead.`
- Flag ONLY when ALL hold: (1) top-level instance-script Identifier declarator, plain `$state(new X(...))` with X in {Map, Set, Date, URL, URLSearchParams} (`$state.raw` excluded); (2) a type-specific mutation on the binding INSIDE a function body or template inline handler (top-level init mutations never count); (3) the binding is never whole-binding-reassigned — EXCEPT bare `b = b`, which does not exempt (Svelte 5 no-op).
- Deep member calls count as mutation for `URL` bindings ONLY (final method in the URLSearchParams mutation set); for the other four types only direct `b.<m>(...)` calls count.
- Registration in four places; `grep -rn "correctnessNonreactiveBuiltinState" packages/core/src | wc -l` must be exactly 5.
- Core purity: no `node:` imports, no I/O.
- **Environment — pnpm is BROKEN. NEVER run any pnpm command or install.** Direct binaries: tests `cd packages/core && ../../node_modules/.bin/vitest run <pattern>`; builds `cd packages/<pkg> && ../../node_modules/.bin/tsup`; typecheck `cd packages/<pkg> && ../../node_modules/.bin/tsc --noEmit`; format/lint `node_modules/.bin/oxfmt <files>` / `node_modules/.bin/oxfmt --check .` / `node_modules/.bin/oxlint .` from the root; docs `cd docs && node_modules/.bin/astro build`.
- `node_modules/.bin/oxfmt` on every touched file before each commit (transcribed code blocks may carry double quotes — oxfmt normalizes to repo style).
- `docs-links` (cli suite) fails for the new rule until Task 3 — expected.

---

### Task 1: Parser — fact, tables, scanner, wiring

**Files:**

- Modify: `packages/core/src/component.ts` (fact field), `packages/core/src/component-collect.ts` (`emptyComponentFacts`), `packages/core/src/component-parse.ts` (tables + scanner + candidate pass + wiring + `parseModuleFacts` empty default)
- Test: `packages/core/test/nonreactive-builtin-state-parse.test.ts` (new)

**Interfaces:**

- Consumes: existing `isPlainStateCall` (~line 449), `isDeferredBody` (~line 444), `unwrapTs`, `scopeIntroducedNames`, `rootObjectName`, `addBoundNames`, `WALK_IGNORED_KEYS`, `lineOf`.
- Produces: `ComponentFacts.nonreactiveBuiltinStates: { name: string; type: string; line: number }[]`.

- [ ] **Step 1: Fact field + empties**

`packages/core/src/component.ts`, after `rawableStates`:

```ts
/** Plain built-in instances (Map/Set/Date/URL/URLSearchParams) in $state whose type-specific mutations were observed inside functions, with no exempting reassignment — untracked by reactivity (correctness/nonreactive-builtin-state). */
nonreactiveBuiltinStates: {
  name: string;
  type: string;
  line: number;
}
[];
```

Add `nonreactiveBuiltinStates: [],` to `emptyComponentFacts` (component-collect.ts) and to `parseModuleFacts`'s returned object (component-parse.ts), each next to `rawableStates: [],`.

- [ ] **Step 2: Write the failing parse tests**

Create `packages/core/test/nonreactive-builtin-state-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const nrb = (src: string) => parseComponentFacts(src, 'A.svelte').nonreactiveBuiltinStates;

const script = (body: string, template = '<p>x</p>') => `<script>\n${body}\n</script>\n${template}`;

describe('nonreactiveBuiltinStates — records', () => {
  it('records each built-in type when mutated in a function', () => {
    const cases: [string, string, string][] = [
      ['Map', 'new Map()', 'm.set("k", 1);'],
      ['Set', 'new Set()', 'm.add(1);'],
      ['Date', 'new Date()', 'm.setHours(0);'],
      ['URLSearchParams', 'new URLSearchParams()', 'm.append("k", "v");']
    ];
    for (const [type, ctor, mutation] of cases) {
      const src = script(`let m = $state(${ctor});\nfunction f() {\n  ${mutation}\n}`);
      expect(nrb(src), type).toEqual([{ name: 'm', type, line: 2 }]);
    }
  });

  it('records URL via property write and via deep searchParams mutation', () => {
    const href = script(`let u = $state(new URL("https://x.dev"));\nfunction f() {\n  u.href = "https://y.dev";\n}`);
    expect(nrb(href)).toEqual([{ name: 'u', type: 'URL', line: 2 }]);
    const deep = script(
      `let u = $state(new URL("https://x.dev"));\nfunction f() {\n  u.searchParams.set("k", "v");\n}`
    );
    expect(nrb(deep)).toEqual([{ name: 'u', type: 'URL', line: 2 }]);
  });

  it('records constructor-with-arguments and template inline-handler mutations', () => {
    const withArgs = script(`let m = $state(new Map(entries));\nfunction f() {\n  m.clear();\n}`);
    expect(nrb(withArgs)).toEqual([{ name: 'm', type: 'Map', line: 2 }]);
    const inline = script(`let s = $state(new Set());`, '<button onclick={() => s.add(1)}>x</button>');
    expect(nrb(inline)).toEqual([{ name: 's', type: 'Set', line: 2 }]);
  });

  it('records a mutation inside $effect and keeps the migrated self-assign hack flagged', () => {
    const effect = script(`let m = $state(new Map());\n$effect(() => {\n  m.set("k", 1);\n});`);
    expect(nrb(effect)).toEqual([{ name: 'm', type: 'Map', line: 2 }]);
    const selfAssign = script(`let m = $state(new Map());\nfunction f() {\n  m.set("k", 1);\n  m = m;\n}`);
    expect(nrb(selfAssign)).toEqual([{ name: 'm', type: 'Map', line: 2 }]);
  });
});

describe('nonreactiveBuiltinStates — exclusions', () => {
  it('does not record reassign-only or mutate-then-fresh-reassign usage', () => {
    const reassignOnly = script(`let d = $state(new Date());\nfunction f() {\n  d = new Date();\n}`);
    expect(nrb(reassignOnly)).toEqual([]);
    const freshReassign = script(`let m = $state(new Map());\nfunction f() {\n  m.set("k", 1);\n  m = new Map(m);\n}`);
    expect(nrb(freshReassign)).toEqual([]);
  });

  it('does not record top-level init mutations, read-only, or escape-only usage', () => {
    const topLevel = script(`let d = $state(new Date());\nd.setHours(0, 0, 0, 0);`);
    expect(nrb(topLevel)).toEqual([]);
    const readOnly = script(`let m = $state(new Map());\nfunction f() {\n  return m.get("k") && m.has("k");\n}`);
    expect(nrb(readOnly)).toEqual([]);
    const urlRead = script(
      `let u = $state(new URL("https://x.dev"));\nfunction f() {\n  return u.searchParams.get("k");\n}`
    );
    expect(nrb(urlRead)).toEqual([]);
    const escape = script(`let m = $state(new Map());\nfunction f() {\n  register(m);\n}`);
    expect(nrb(escape)).toEqual([]);
  });

  it('does not record non-candidates', () => {
    const raw = script(`let m = $state.raw(new Map());\nfunction f() {\n  m.set("k", 1);\n}`);
    expect(nrb(raw)).toEqual([]);
    const plain = script(`const m = new Map();\nfunction f() {\n  m.set("k", 1);\n}`);
    expect(nrb(plain)).toEqual([]);
    const nested = script(`function g() {\n  let m = $state(new Map());\n  m.set("k", 1);\n}`);
    expect(nrb(nested)).toEqual([]);
    const literal = script(`let o = $state({});\nfunction f() {\n  o.x = 1;\n}`);
    expect(nrb(literal)).toEqual([]);
  });

  it('respects shadowing and type-specific method sets', () => {
    const shadowed = script(`let m = $state(new Map());\nfunction f(m) {\n  m.set("k", 1);\n}`);
    expect(nrb(shadowed)).toEqual([]);
    const wrongMethod = script(`let d = $state(new Date());\nfunction f() {\n  d.getHours();\n}`);
    expect(nrb(wrongMethod)).toEqual([]);
    const deepOnNonUrl = script(`let m = $state(new Map());\nfunction f() {\n  m.get("k").sort();\n}`);
    expect(nrb(deepOnNonUrl)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run nonreactive-builtin-state-parse`
Expected: FAIL — `nonreactiveBuiltinStates` undefined.

- [ ] **Step 4: Implement tables, scanner, candidate pass**

Add to `packages/core/src/component-parse.ts`, near `isPlainStateCall`:

```ts
/** Built-in classes with reactive drop-ins in svelte/reactivity — plain instances in $state are NOT deep-proxied, so their mutations are untracked (correctness/nonreactive-builtin-state). */
const BUILTIN_STATE_TYPES = new Set(['Map', 'Set', 'Date', 'URL', 'URLSearchParams']);

/** Type-specific mutating methods. URL mutates via property writes and deep searchParams calls only. */
const BUILTIN_MUTATIONS: Record<string, Set<string>> = {
  Map: new Set(['set', 'delete', 'clear']),
  Set: new Set(['add', 'delete', 'clear']),
  Date: new Set([
    'setTime',
    'setFullYear',
    'setMonth',
    'setDate',
    'setHours',
    'setMinutes',
    'setSeconds',
    'setMilliseconds',
    'setYear',
    'setUTCFullYear',
    'setUTCMonth',
    'setUTCDate',
    'setUTCHours',
    'setUTCMinutes',
    'setUTCSeconds',
    'setUTCMilliseconds'
  ]),
  URL: new Set<string>(),
  URLSearchParams: new Set(['append', 'set', 'delete', 'sort'])
};

/**
 * Signals for correctness/nonreactive-builtin-state, per candidate binding
 * (name → constructor type): `mutated` collects type-specific mutations that
 * happen INSIDE a function body (a top-level init mutation runs before first
 * render and can never leave the UI stale); `reassigned` collects whole-binding
 * reassignments ANYWHERE (a fresh reassignment after mutation makes the code
 * work) — except the bare self-assignment `b = b`, a no-op under $state's
 * referential equality in Svelte 5, which must not exempt. Deep member calls
 * count as mutation only for URL bindings (final method in the URLSearchParams
 * set: `u.searchParams.set(...)`); deep reads (`get`, `has`, …) never count.
 * Shadow-aware; class bodies count as function depth.
 */
function collectBuiltinStateSignals(
  node: Node,
  candidates: Map<string, string>,
  mutated: Set<string>,
  reassigned: Set<string>,
  shadowed: Set<string> = new Set(),
  inFunction = false
): void {
  if (Array.isArray(node)) {
    for (const child of node) collectBuiltinStateSignals(child, candidates, mutated, reassigned, shadowed, inFunction);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  const boundary = isDeferredBody(node) || node.type === 'ClassDeclaration' || node.type === 'ClassExpression';
  const nextInFunction = inFunction || boundary;
  const hit = (name: unknown): string | undefined =>
    typeof name === 'string' && candidates.has(name) && !scope.has(name) ? name : undefined;

  if (node.type === 'AssignmentExpression') {
    if (node.left?.type === 'Identifier') {
      const n = hit(node.left.name);
      const isBareSelfAssign = node.right?.type === 'Identifier' && node.right.name === n;
      if (n && !isBareSelfAssign) reassigned.add(n);
    } else if (node.left?.type === 'ObjectPattern' || node.left?.type === 'ArrayPattern') {
      const bound = new Set<string>();
      addBoundNames(node.left, bound);
      for (const name of bound) {
        const n = hit(name);
        if (n) reassigned.add(n);
      }
    } else if (node.left?.type === 'MemberExpression' && inFunction) {
      const n = hit(rootObjectName(node.left));
      if (n) mutated.add(n);
    }
  } else if (node.type === 'UpdateExpression' && node.argument?.type === 'MemberExpression' && inFunction) {
    const n = hit(rootObjectName(node.argument));
    if (n) mutated.add(n);
  } else if (node.type === 'UnaryExpression' && node.operator === 'delete' && inFunction) {
    const n = hit(rootObjectName(node.argument));
    if (n) mutated.add(n);
  } else if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    inFunction
  ) {
    const method = node.callee.property?.name;
    if (typeof method === 'string') {
      if (node.callee.object?.type === 'Identifier') {
        const n = hit(node.callee.object.name);
        if (n && BUILTIN_MUTATIONS[candidates.get(n)!]?.has(method)) mutated.add(n);
      } else if (node.callee.object?.type === 'MemberExpression') {
        const n = hit(rootObjectName(node.callee));
        if (n && candidates.get(n) === 'URL' && BUILTIN_MUTATIONS.URLSearchParams.has(method)) mutated.add(n);
      }
    }
  }

  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    collectBuiltinStateSignals(node[key], candidates, mutated, reassigned, scope, nextInFunction);
  }
}
```

- [ ] **Step 5: Wire into `parseComponentFacts`**

Declare `const nonreactiveBuiltinStates: { name: string; type: string; line: number }[] = [];` next to `rawableStates` (~line 1724). Inside the `if (program)` block, directly after the `rawableStates` computation block (~line 1784–1810), add:

```ts
const builtinCandidates = new Map<string, { type: string; line: number }>();
for (const stmt of program.body ?? []) {
  if (stmt?.type !== 'VariableDeclaration') continue;
  for (const d of stmt.declarations ?? []) {
    if (d?.id?.type !== 'Identifier' || !d.init || !isPlainStateCall(d.init)) continue;
    const arg = unwrapTs(d.init.arguments?.[0]);
    if (
      arg?.type === 'NewExpression' &&
      arg.callee?.type === 'Identifier' &&
      BUILTIN_STATE_TYPES.has(arg.callee.name)
    ) {
      builtinCandidates.set(d.id.name, { type: arg.callee.name, line: lineOf(source, d.start) });
    }
  }
}
if (builtinCandidates.size > 0) {
  const types = new Map([...builtinCandidates].map(([n, meta]) => [n, meta.type]));
  const mutatedBuiltins = new Set<string>();
  const reassignedBuiltins = new Set<string>();
  collectBuiltinStateSignals(program, types, mutatedBuiltins, reassignedBuiltins);
  if (ast.fragment) collectBuiltinStateSignals(ast.fragment, types, mutatedBuiltins, reassignedBuiltins);
  for (const [name, meta] of builtinCandidates) {
    if (mutatedBuiltins.has(name) && !reassignedBuiltins.has(name)) {
      nonreactiveBuiltinStates.push({ name, type: meta.type, line: meta.line });
    }
  }
}
```

Add `nonreactiveBuiltinStates` to the returned facts object next to `rawableStates` (~line 1851).

- [ ] **Step 6: Run tests, then the full core suite**

Run: `cd packages/core && ../../node_modules/.bin/vitest run nonreactive-builtin-state-parse` → PASS (9 tests).
Run: `cd packages/core && ../../node_modules/.bin/vitest run` → all pass. The non-optional fact field ripples into hand-built `ComponentFacts` fixtures (core AND cli tests, as with `rawableStates`): add `nonreactiveBuiltinStates: [],` mechanically, change no expectations, list every touched fixture in your report. For cli: build core first (`cd packages/core && ../../node_modules/.bin/tsup`), then `cd packages/cli && ../../node_modules/.bin/vitest run`.
Run: `cd packages/core && ../../node_modules/.bin/tsc --noEmit` → clean.

- [ ] **Step 7: Commit**

```bash
node_modules/.bin/oxfmt packages/core/src/component.ts packages/core/src/component-collect.ts packages/core/src/component-parse.ts packages/core/test/nonreactive-builtin-state-parse.test.ts
git add -A packages/core packages/cli/test
git commit -m "feat(core): collect non-reactive built-in $state mutations in component facts"
```

---

### Task 2: Rule + registration

**Files:**

- Create: `packages/core/src/rules/correctness/nonreactive-builtin-state.ts`
- Modify: `packages/core/src/rules/index.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/nonreactive-builtin-state-rule.test.ts` (new)

**Interfaces:**

- Consumes: `ComponentFacts.nonreactiveBuiltinStates`; `componentRule` factory (has `fix` support).
- Produces: exported rule `correctnessNonreactiveBuiltinState`.

- [ ] **Step 1: Write the failing rule tests**

Create `packages/core/test/nonreactive-builtin-state-rule.test.ts` (mirror the harness of `packages/core/test/state-raw-rule.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { correctnessNonreactiveBuiltinState } from '../src/rules/correctness/nonreactive-builtin-state.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, nonreactiveBuiltinStates: ComponentFacts['nonreactiveBuiltinStates']): ComponentFacts {
  return { ...emptyComponentFacts(file), nonreactiveBuiltinStates };
}

describe('correctness/nonreactive-builtin-state', () => {
  it('flags each binding with the type-interpolated message at warning severity', async () => {
    const results = await correctnessNonreactiveBuiltinState.check(
      ctx([comp('src/lib/Tags.svelte', [{ name: 'tags', type: 'Set', line: 3 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/lib/Tags.svelte');
    expect(penalized[0]!.line).toBe(3);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toBe(
      '"tags" is a plain Set in $state — its mutations are not tracked, so the UI silently stops updating when it changes. Use SvelteSet from \'svelte/reactivity\'.'
    );
    expect(penalized[0]!.fix?.description).toContain('svelte/reactivity');
    expect(penalized[0]!.fix?.snippet).toBeUndefined();
  });

  it('emits nothing without the fact', async () => {
    expect(await correctnessNonreactiveBuiltinState.check(ctx([comp('src/lib/Ok.svelte', [])]))).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/nonreactive-builtin-state')).toBe(true);
    expect(explainRule('correctness/nonreactive-builtin-state')?.severity).toBe('warning');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run nonreactive-builtin-state-rule` → FAIL (module not found).

- [ ] **Step 3: Implement the rule**

Create `packages/core/src/rules/correctness/nonreactive-builtin-state.ts`:

```ts
import { componentRule } from '../component-rule.js';

/**
 * correctness/nonreactive-builtin-state — $state's deep proxy covers plain
 * objects and arrays only. A plain Map/Set/Date/URL/URLSearchParams in $state
 * keeps working as data, but its mutations never reach effects, deriveds, or
 * the template: the UI silently stops updating. svelte/reactivity ships
 * drop-in reactive equivalents for exactly this.
 */
export const correctnessNonreactiveBuiltinState = componentRule({
  id: 'correctness/nonreactive-builtin-state',
  title: 'Non-reactive built-in in $state',
  category: 'correctness',
  severity: 'warning',
  label: 'Reactive collections in $state',
  recommendation:
    "Import the reactive equivalent from 'svelte/reactivity' (SvelteMap, SvelteSet, SvelteDate, SvelteURL, SvelteURLSearchParams) and construct that instead.",
  rationale:
    "$state deep-proxies plain objects and arrays only; built-in collection, date, and URL instances stay untracked, so property-level changes never reach effects, deriveds, or the template. Svelte's own answer is the drop-in classes in svelte/reactivity.",
  fix: {
    description:
      "Import Svelte<Type> from 'svelte/reactivity' and replace new <Type>(...) with new Svelte<Type>(...) — the API is identical."
  },
  applies: (c) => c.nonreactiveBuiltinStates.length > 0,
  bad: (c) =>
    c.nonreactiveBuiltinStates.map((s) => ({
      line: s.line,
      message: `"${s.name}" is a plain ${s.type} in $state — its mutations are not tracked, so the UI silently stops updating when it changes. Use Svelte${s.type} from 'svelte/reactivity'.`
    }))
});
```

- [ ] **Step 4: Register in all four places**

1. `packages/core/src/rules/index.ts` — import + `allRules` + `export { … }` block, each placed after `correctnessStalePropDerivation` (follow the file's ordering).
2. `packages/core/src/index.ts` — re-export after `correctnessStalePropDerivation`. **Untypechecked fourth place — do not skip.**

- [ ] **Step 5: Verify and run the suite**

Run: `grep -rn "correctnessNonreactiveBuiltinState" packages/core/src | wc -l` → `5`.
Run: `cd packages/core && ../../node_modules/.bin/vitest run` → all pass.

- [ ] **Step 6: Commit**

```bash
node_modules/.bin/oxfmt packages/core/src/rules/correctness/nonreactive-builtin-state.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/nonreactive-builtin-state-rule.test.ts
git add packages/core/src/rules/correctness/nonreactive-builtin-state.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/nonreactive-builtin-state-rule.test.ts
git commit -m "feat(core): add correctness/nonreactive-builtin-state rule"
```

---

### Task 3: Docs (en/ja), changeset, builds, verify

**Files:**

- Create: `docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md`, `docs/src/content/docs/ja/rules/correctness/nonreactive-builtin-state.md`, `.changeset/nonreactive-builtin-state.md`
- Modify: `packages/action/dist/*` (rebuild)

- [ ] **Step 1: English rule page**

Mirror the frontmatter/heading structure of `docs/src/content/docs/rules/correctness/stale-prop-derivation.md` (read it first). Create `docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md`:

````markdown
---
title: correctness/nonreactive-builtin-state · Non-reactive built-in in $state
description: 'A plain Map, Set, Date, or URL in $state is not proxied — its mutations are invisible to reactivity, and the UI silently stops updating.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags a top-level `$state` binding constructed from a plain built-in — `Map`, `Set`, `Date`, `URL`, or `URLSearchParams` — when a mutation of that instance is observed inside a function or template handler:

```svelte
<script>
  let tags = $state(new Set());

  function toggle(tag) {
    tags.add(tag); // flagged — this mutation is not tracked
  }
</script>

{#each [...tags] as tag}<span>{tag}</span>{/each}
```

Detection is deliberately conservative: only type-specific mutating operations count (`map.set`, `set.add`, `date.setHours`, `params.append`, `url.href = …`, `url.searchParams.set(…)`, …); read methods never do. A binding that is reassigned after mutation (`tags = new Set(tags)`) works correctly and is not flagged — but the bare self-assignment `tags = tags` is a no-op in Svelte 5 and does not exempt. Mutations at script top level run once before the first render and are not flagged either.

## Why it matters

`$state`'s deep proxy covers plain objects and arrays only. A plain built-in instance keeps working as data — every `set`/`add`/`append` call succeeds — but reactivity never hears about it: effects don't rerun, deriveds don't recompute, and the template keeps showing the old contents. The component renders correctly once and silently stops updating in production, with no compiler or svelte-check warning. Svelte ships `svelte/reactivity` precisely for this.

## How to fix

```svelte
<script>
  import { SvelteSet } from 'svelte/reactivity';

  let tags = $state(new SvelteSet());
</script>
```

`SvelteMap`, `SvelteSet`, `SvelteDate`, `SvelteURL`, and `SvelteURLSearchParams` are drop-in replacements with identical APIs. Alternatively, keep the plain built-in and reassign a fresh instance after each change (`tags = new Set(tags)`) — the rule recognizes that pattern and stays quiet.

## Limitations

Mutations that happen outside the component — an instance passed to a helper, store, or child that mutates it — are beyond static reach (the rule only counts mutations it can see, so escape-only usage is never flagged). A local class that shadows a built-in name (`class Map { … }`) would be misattributed; shadowing global built-in names is its own problem. Runes-module (`.svelte.ts`) and class-field `$state` are out of scope in this version.

## Disabling

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/nonreactive-builtin-state': 'off'
  }
};
```
````

- [ ] **Step 2: Japanese rule page**

Create `docs/src/content/docs/ja/rules/correctness/nonreactive-builtin-state.md` — natural Japanese per the docs/ja conventions (full-width parentheses in prose, 「なぜ重要か」 heading, quoted frontmatter description, active voice):

````markdown
---
title: correctness/nonreactive-builtin-state · Non-reactive built-in in $state
description: '$state に入れた素の Map・Set・Date・URL はプロキシされず、変更がリアクティビティに届きません。UI は静かに更新を止めます。'
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

素の組み込みクラス（`Map`・`Set`・`Date`・`URL`・`URLSearchParams`）で初期化されたトップレベルの `$state` 束縛のうち、そのインスタンスへの変更が関数内またはテンプレートのハンドラー内で観測されたものを検出します:

```svelte
<script>
  let tags = $state(new Set());

  function toggle(tag) {
    tags.add(tag); // 検出対象 — この変更は追跡されない
  }
</script>

{#each [...tags] as tag}<span>{tag}</span>{/each}
```

検出は意図的に保守的です。型ごとの変更操作だけを数え（`map.set`、`set.add`、`date.setHours`、`params.append`、`url.href = …`、`url.searchParams.set(…)` など）、読み取りメソッドは数えません。変更のあとに再代入している運用（`tags = new Set(tags)`）は正しく動くため検出しませんが、素の自己代入 `tags = tags` は Svelte 5 では no-op なので免除になりません。スクリプトのトップレベルでの変更は初回描画前に一度実行されるだけなので、これも検出しません。

## なぜ重要か

`$state` の深いプロキシが対象にするのは素のオブジェクトと配列だけです。素の組み込みインスタンスはデータとしては動き続けます（`set` も `add` も成功します）が、リアクティビティには何も届きません。effect は再実行されず、derived は再計算されず、テンプレートは古い内容を表示し続けます。コンポーネントは初回だけ正しく描画され、本番で静かに更新を止めます。コンパイラも svelte-check も警告しません。Svelte が `svelte/reactivity` を提供しているのは、まさにこのためです。

## 修正方法

```svelte
<script>
  import { SvelteSet } from 'svelte/reactivity';

  let tags = $state(new SvelteSet());
</script>
```

`SvelteMap`・`SvelteSet`・`SvelteDate`・`SvelteURL`・`SvelteURLSearchParams` は API 互換のドロップイン置換です。素の組み込みのまま、変更のたびに新しいインスタンスを再代入する運用（`tags = new Set(tags)`）でも動きます。このルールはそのパターンを認識して検出しません。

## 制限事項

コンポーネントの外で起きる変更（ヘルパーやストア、子コンポーネントに渡した先での変更）は静的解析の射程外です。このルールは観測できた変更だけを数えるため、渡すだけの使い方は検出されません。組み込みクラス名をシャドーするローカルクラス（`class Map { … }`）があると誤帰属しますが、グローバルの組み込み名のシャドーはそれ自体が問題です。runes モジュール（`.svelte.ts`）とクラスフィールドの `$state` はこのバージョンでは対象外です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/nonreactive-builtin-state': 'off'
  }
};
```
````

- [ ] **Step 3: docs-links gate + changeset**

Run: `cd packages/core && ../../node_modules/.bin/tsup && cd ../cli && ../../node_modules/.bin/vitest run docs-links` → PASS.

Create `.changeset/nonreactive-builtin-state.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add `correctness/nonreactive-builtin-state`: flags plain `Map`/`Set`/`Date`/`URL`/`URLSearchParams` in `$state` whose mutations are observed — `$state`'s deep proxy covers plain objects and arrays only, so such mutations are untracked and the UI silently stops updating. Precision-first: only type-specific mutating operations count, and mutate-then-reassign usage (which works) is not flagged.
```

- [ ] **Step 4: Builds and verify — direct binaries**

```bash
cd packages/core && ../../node_modules/.bin/tsup && cd ../..
cd packages/cli && ../../node_modules/.bin/tsup && ../../node_modules/.bin/vitest run && cd ../..
cd packages/vite && ../../node_modules/.bin/tsup && ../../node_modules/.bin/vitest run && cd ../..
cd packages/mcp && ../../node_modules/.bin/tsup && cd ../..
cd packages/action && ../../node_modules/.bin/tsup && cd ../..
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
cd docs && node_modules/.bin/astro build && cd ..
git status --short packages/action/dist
```

Expected: all green (check each package.json build script is plain `tsup` first; STOP and report if one needs pnpm); commit the regenerated action dist.

- [ ] **Step 5: Commit (two commits)**

```bash
git add docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md docs/src/content/docs/ja/rules/correctness/nonreactive-builtin-state.md .changeset/nonreactive-builtin-state.md
git commit -m "docs: add nonreactive-builtin-state rule pages (en/ja) and changeset"
git add packages/action/dist
git commit -m "chore(action): rebuild dist for nonreactive-builtin-state"
```
