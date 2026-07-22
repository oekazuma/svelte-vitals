# correctness/stale-prop-derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `correctness/stale-prop-derivation`, a component rule flagging top-level values computed from `$props()` props without `$derived` (frozen at init) that are rendered in the template.

**Architecture:** Detection lives in `parseComponentFacts`'s instance-program section: a prop-name collector variant (including `$bindable` names), an eager-position prop-reference walker over call-free initializers, disqualification via the existing `collectStateWrites`/`collectTemplateEscapes` machinery, and a new shadow-aware fragment reference walker (with `scopeIntroducedNames` extended for `EachBlock.index`, `SnippetBlock.parameters`, `AwaitBlock.value/error`). A `componentRule` consumes the new `ComponentFacts.stalePropDerivations` list.

**Tech Stack:** TypeScript, svelte/compiler modern AST, vitest.

**Spec:** `docs/superpowers/specs/2026-07-22-stale-prop-derivation-design.md` (approved after adversarial design review).

## Global Constraints

- Rule metadata exactly: id `correctness/stale-prop-derivation`, title `Stale prop derivation`, category `correctness`, severity `warning`, label `Props derived reactively`.
- Message template (exact): `"<name>" is computed from a prop once, at initialization — it will not update when the prop changes. Wrap it in $derived.`
- Recommendation (exact): `Wrap the computation in $derived(...), or $derived.by(() => ...) when it needs a function body.`
- Flag ONLY when all four hold: (1) top-level instance-script const/let/var Identifier declarator whose initializer references a prop name in an EAGER position (references inside nested function/arrow/getter bodies do not count); (2) the initializer subtree contains NO CallExpression/NewExpression/AwaitExpression anywhere; (3) the binding is never written or escaped (`collectStateWrites` over program+fragment, `collectTemplateEscapes` over fragment); (4) the binding is referenced in the template in an eager position (inline-handler function bodies do not count; `{#snippet}` bodies do), shadow-aware.
- Prop names: variant of `collectNonBindableProps` that ALSO includes `$bindable(...)` names; `...rest` and the whole-object binding included; nested patterns / multiple `$props()` → empty set (rule inert).
- `scopeIntroducedNames` gains `EachBlock.index` (a string), `SnippetBlock.parameters`, `AwaitBlock.value`/`AwaitBlock.error` — additive; existing consumers only become more conservative. No existing test may need modification EXCEPT the `unmutated-state` recommendation pin (Task 2 changes that string deliberately).
- Registration in four places; `grep -rn "correctnessStalePropDerivation" packages/core/src | wc -l` must be exactly 5.
- Core purity: no `node:` imports, no I/O.
- Environment: EVERY pnpm command prefixed `npm_config_verify_deps_before_run=false pnpm ...`; NEVER run `pnpm install`. CLI filter name `svelte-vitals`. `docs-links` fails for the new rule until Task 3 — expected.
- `pnpm exec prettier --write` on every touched file before each commit.

---

### Task 1: Parser — fact, collectors, wiring

**Files:**

- Modify: `packages/core/src/component.ts` (ComponentFacts field)
- Modify: `packages/core/src/component-collect.ts` (`emptyComponentFacts`)
- Modify: `packages/core/src/component-parse.ts` (prop-name variant, `scopeIntroducedNames` extension, new walkers, wiring in `parseComponentFacts` AND the module-file path)
- Test: `packages/core/test/stale-prop-derivation-parse.test.ts` (new)

**Interfaces:**

- Consumes: `collectNonBindableProps` (generalized), `collectStateWrites`, `collectTemplateEscapes`, `scopeIntroducedNames`, `addBoundNames`, `walkEstree`, `lineOf`, `isFunctionNode`-equivalent checks (component-parse has the function-type checks inline; use `n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression'` or an existing local helper if one exists — grep for `isFunctionNode` in this file first).
- Produces: `ComponentFacts.stalePropDerivations: { name: string; line: number }[]` — consumed by Task 2.

- [ ] **Step 1: Add the fact field**

`packages/core/src/component.ts`, after `mutatedProps`:

```ts
/** Top-level const/let bindings computed from a $props() prop without $derived, never reassigned or escaped, and referenced (eagerly) in the template — frozen at init (correctness/stale-prop-derivation). */
stalePropDerivations: {
  name: string;
  line: number;
}
[];
```

`packages/core/src/component-collect.ts`, in `emptyComponentFacts`, after `mutatedProps: [],`:

```ts
    stalePropDerivations: [],
```

Also add `stalePropDerivations: []` to the object returned by `parseModuleFacts` in component-parse.ts (module files have no props) — find where it builds its facts object and mirror the other empty lists.

- [ ] **Step 2: Write the failing parse tests**

Create `packages/core/test/stale-prop-derivation-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const spd = (src: string) => parseComponentFacts(src, 'A.svelte').stalePropDerivations;

const script = (body: string, template = '{color}') => `<script>\n${body}\n</script>\n${template}`;

describe('stalePropDerivations — flags', () => {
  it("flags the official don't example", () => {
    const src = script(
      `let { type } = $props();\nlet color = type === 'danger' ? 'red' : 'green';`,
      '<p class={color}>x</p>'
    );
    expect(spd(src)).toEqual([{ name: 'color', line: 3 }]);
  });

  it('flags a bare alias and a renamed prop', () => {
    const alias = script(`let { type } = $props();\nconst color = type;`);
    expect(spd(alias)).toEqual([{ name: 'color', line: 3 }]);
    const renamed = script(`let { type: kind } = $props();\nconst color = kind + '-x';`);
    expect(spd(renamed)).toEqual([{ name: 'color', line: 3 }]);
  });

  it('flags derivation from a $bindable prop and from rest props', () => {
    const bindable = script(`let { value = $bindable(0) } = $props();\nconst color = value * 2;`);
    expect(spd(bindable)).toEqual([{ name: 'color', line: 3 }]);
    const rest = script(`let { a, ...rest } = $props();\nconst color = rest.tone;`);
    expect(spd(rest)).toEqual([{ name: 'color', line: 3 }]);
  });

  it('flags an eager object literal but not getters or closures', () => {
    const eager = script(`let { type } = $props();\nconst color = { c: type };`, '{color.c}');
    expect(spd(eager)).toEqual([{ name: 'color', line: 3 }]);
    const getter = script(`let { type } = $props();\nconst color = { get c() { return type; } };`, '{color.c}');
    expect(spd(getter)).toEqual([]);
    const closure = script(`let { type } = $props();\nconst color = () => type;`, '{color()}');
    expect(spd(closure)).toEqual([]);
  });

  it('counts template usage via block expressions and snippet bodies', () => {
    const block = script(`let { n } = $props();\nconst items = [n, n];`, '{#each items as it (it)}<b>{it}</b>{/each}');
    expect(spd(block)).toEqual([{ name: 'items', line: 3 }]);
    const snippet = script(
      `let { type } = $props();\nconst color = type;`,
      '{#snippet s()}<i>{color}</i>{/snippet}{@render s()}'
    );
    expect(spd(snippet)).toEqual([{ name: 'color', line: 3 }]);
  });
});

describe('stalePropDerivations — exclusions', () => {
  it('does not flag $derived, $state capture, calls, new, or await', () => {
    for (const init of [
      `$derived(type + 'x')`,
      `$state(type)`,
      `buildConfig(type)`,
      `new Thing(type)`,
      `type.toUpperCase()`
    ]) {
      const src = script(`let { type } = $props();\nconst color = ${init};`);
      expect(spd(src), init).toEqual([]);
    }
  });

  it('does not flag reassigned or escaped bindings', () => {
    const reassigned = script(`let { type } = $props();\nlet color = type;\ncolor = 'x';`);
    expect(spd(reassigned)).toEqual([]);
    const escaped = script(`let { type } = $props();\nconst color = type;\nregister(color);`);
    expect(spd(escaped)).toEqual([]);
    const bound = script(`let { type } = $props();\nlet color = type;`, '<input bind:value={color} />');
    expect(spd(bound)).toEqual([]);
  });

  it('does not count handler-only or shadowed template usage', () => {
    const handlerOnly = script(
      `let { type } = $props();\nconst color = type;`,
      '<button onclick={() => alert(color)}>x</button>'
    );
    expect(spd(handlerOnly)).toEqual([]);
    const eachShadow = script(
      `let { type } = $props();\nconst color = type;`,
      '{#each list as color (color.id)}<i>{color}</i>{/each}'
    );
    expect(spd(eachShadow)).toEqual([]);
    const snippetShadow = script(
      `let { type } = $props();\nconst color = type;`,
      '{#snippet s(color)}<i>{color}</i>{/snippet}{@render s(1)}'
    );
    expect(spd(snippetShadow)).toEqual([]);
  });

  it('does not flag when props are unknowable, in module scripts, or without props', () => {
    const nested = script(`let { a: { b } } = $props();\nconst color = b;`);
    expect(spd(nested)).toEqual([]);
    const moduleScript = `<script module>\nconst color = 'x';\n</script>\n<script>\nlet { type } = $props();\n</script>\n{color}`;
    expect(spd(moduleScript)).toEqual([]);
    const noProps = script(`const color = 'red';`);
    expect(spd(noProps)).toEqual([]);
    expect(parseComponentFacts('export const x = 1;', 'a.svelte.ts').stalePropDerivations).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test -- stale-prop-derivation-parse`
Expected: FAIL — `stalePropDerivations` is undefined (field not yet returned).

- [ ] **Step 4: Generalize the prop-name collector**

In `packages/core/src/component-parse.ts`, rename `collectNonBindableProps(program)` to:

```ts
function collectPropNames(program: Node, includeBindable: boolean): Set<string> {
```

Inside, change the `$bindable` branch to respect the flag:

```ts
        if (p.value?.type === 'AssignmentPattern') {
          if ((includeBindable || !isBindableCall(p.value.right)) && p.value.left?.type === 'Identifier')
            names.add(p.value.left.name);
        } else if (p.value?.type === 'Identifier') {
```

Update the doc comment (both behaviors described) and the existing call site: `collectNonBindableProps(program)` → `collectPropNames(program, false)`.

- [ ] **Step 5: Extend `scopeIntroducedNames`**

In `scopeIntroducedNames` (component-parse.ts), extend the `EachBlock` branch and add two more:

```ts
  } else if (node.type === 'EachBlock' && node.context) {
    addBoundNames(node.context, introduced);
    if (typeof node.index === 'string') introduced.add(node.index);
  } else if (node.type === 'SnippetBlock') {
    for (const p of node.parameters ?? []) addBoundNames(p, introduced);
  } else if (node.type === 'AwaitBlock') {
    if (node.value) addBoundNames(node.value, introduced);
    if (node.error) addBoundNames(node.error, introduced);
  }
```

Also update its doc comment (it currently says snippet/then/catch are NOT tracked — they now are; keep the issue #140 context).

- [ ] **Step 6: Implement the two walkers and the collector**

Add to component-parse.ts (near `collectStateWrites`):

```ts
/** Function-shaped nodes whose bodies defer evaluation — prop reads inside them stay reactive (compiled to call-time reads). */
function isDeferredBody(n: Node): boolean {
  return n?.type === 'FunctionDeclaration' || n?.type === 'FunctionExpression' || n?.type === 'ArrowFunctionExpression';
}

/**
 * Whether `node` references any of `names` in an EAGER position: nested
 * function/arrow bodies (incl. object getters/methods, whose values are
 * FunctionExpressions) are skipped — the compiler defers those reads to call
 * time, so they stay reactive. Non-computed member properties and object keys
 * are not references. Shadow-aware via `scopeIntroducedNames`.
 */
function refsNamesEagerly(node: Node, names: Set<string>, shadowed: Set<string> = new Set()): boolean {
  if (Array.isArray(node)) return node.some((c) => refsNamesEagerly(c, names, shadowed));
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return false;
  if (isDeferredBody(node)) return false;
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  if (node.type === 'Identifier' && names.has(node.name) && !scope.has(node.name)) return true;
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    if (node.type === 'MemberExpression' && key === 'property' && !node.computed) continue;
    if (node.type === 'Property' && key === 'key' && !node.computed) continue;
    if (refsNamesEagerly(node[key], names, scope)) return true;
  }
  return false;
}

/** Whether the subtree contains any call, construction, or await — used to keep stale-prop candidates to plain expressions (rune wrappers and helper/service calls are all excluded structurally). */
function containsCallLike(node: Node): boolean {
  let found = false;
  walkEstree(node, (n: Node) => {
    if (n?.type === 'CallExpression' || n?.type === 'NewExpression' || n?.type === 'AwaitExpression') found = true;
  });
  return found;
}

/**
 * Names from `names` referenced in the template fragment in an eager position:
 * expression tags, attribute/directive expressions, and block expressions count;
 * inline-handler function bodies do NOT (deferred reads never render), while
 * `{#snippet}` bodies DO (render content). Shadow-aware for template scopes
 * (each contexts + index, snippet parameters, await value/error).
 */
function collectFragmentRefs(
  node: Node,
  names: Set<string>,
  acc: Set<string>,
  shadowed: Set<string> = new Set()
): void {
  if (Array.isArray(node)) {
    for (const c of node) collectFragmentRefs(c, names, acc, shadowed);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (isDeferredBody(node)) return;
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  if (node.type === 'Identifier' && names.has(node.name) && !scope.has(node.name)) acc.add(node.name);
  if (Array.isArray(node.attributes)) collectFragmentRefs(node.attributes, names, acc, scope);
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key) || key === 'attributes') continue;
    if (node.type === 'MemberExpression' && key === 'property' && !node.computed) continue;
    if (node.type === 'Property' && key === 'key' && !node.computed) continue;
    collectFragmentRefs(node[key], names, acc, scope);
  }
}

/**
 * Stale prop derivations (correctness/stale-prop-derivation): top-level
 * const/let/var Identifier declarators whose CALL-FREE initializer references a
 * prop eagerly. Reassignment/escape and template-reference filtering happen at
 * the call site, where the fragment is available.
 */
function collectStalePropCandidates(
  program: Node,
  propNames: Set<string>,
  source: string
): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'VariableDeclaration') continue;
    for (const d of stmt.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || !d.init) continue;
      if (containsCallLike(d.init)) continue;
      if (!refsNamesEagerly(d.init, propNames)) continue;
      out.push({ name: d.id.name, line: lineOf(source, d.start) });
    }
  }
  return out;
}
```

(Check first whether component-parse.ts already has a function-type helper to reuse instead of `isDeferredBody`; if an equivalent exists, use it and skip the new one.)

- [ ] **Step 7: Wire into `parseComponentFacts`**

Inside the `if (program)` block (after the `mutatedProps` collection, where `nonBindableProps` is computed), add:

```ts
const allPropNames = collectPropNames(program, true);
if (allPropNames.size > 0) {
  const candidates = collectStalePropCandidates(program, allPropNames, source);
  if (candidates.length > 0) {
    const candidateNames = new Set(candidates.map((c) => c.name));
    const disqualified = new Set<string>();
    collectStateWrites(program, candidateNames, disqualified);
    if (ast.fragment) {
      collectStateWrites(ast.fragment, candidateNames, disqualified);
      collectTemplateEscapes(ast.fragment, candidateNames, disqualified);
    }
    const referenced = new Set<string>();
    if (ast.fragment) collectFragmentRefs(ast.fragment, candidateNames, referenced);
    for (const c of candidates) {
      if (!disqualified.has(c.name) && referenced.has(c.name)) stalePropDerivations.push(c);
    }
  }
}
```

with `const stalePropDerivations: { name: string; line: number }[] = [];` declared next to `mutatedProps`, and `stalePropDerivations` added to the returned facts object (grep the return to find where `mutatedProps` is listed and add alongside). Note: `collectNonBindableProps(program)` at the existing call site is now `collectPropNames(program, false)` (Step 4).

- [ ] **Step 8: Run tests to verify they pass, then the full core suite**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test -- stale-prop-derivation-parse`
Expected: PASS (10 tests).
Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test`
Expected: all pass — the `scopeIntroducedNames` extension only widens shadowing (existing consumers get more conservative; if any existing test pinned a finding that a newly-shadowed name previously produced, investigate carefully: the new shadowing must only REMOVE findings in snippet/await/each-index scopes, which is the intended correction — update such a pin only if the old expectation was itself a shadowing bug, and note it in your report).

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/component.ts packages/core/src/component-collect.ts packages/core/src/component-parse.ts packages/core/test/stale-prop-derivation-parse.test.ts
git commit -m "feat(core): collect stale prop derivations in component facts"
```

---

### Task 2: Rule, registration, unmutated-state recommendation tweak

**Files:**

- Create: `packages/core/src/rules/correctness/stale-prop-derivation.ts`
- Modify: `packages/core/src/rules/index.ts`, `packages/core/src/index.ts` (registration)
- Modify: `packages/core/src/rules/correctness/unmutated-state.ts` (recommendation string)
- Test: `packages/core/test/stale-prop-derivation.test.ts` (new); update the unmutated-state pin if its recommendation is asserted anywhere.

**Interfaces:**

- Consumes: `ComponentFacts.stalePropDerivations` (Task 1); `componentRule` factory.
- Produces: exported rule `correctnessStalePropDerivation`.

- [ ] **Step 1: Write the failing rule tests**

Create `packages/core/test/stale-prop-derivation.test.ts` (mirror the harness used by `packages/core/test/each-index-key.test.ts` — same `ctx`/`comp` helper shapes built on `emptyComponentFacts` and `defineConfig({})`):

```ts
import { describe, it, expect } from 'vitest';
import { correctnessStalePropDerivation } from '../src/rules/correctness/stale-prop-derivation.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, stalePropDerivations: ComponentFacts['stalePropDerivations']): ComponentFacts {
  return { ...emptyComponentFacts(file), stalePropDerivations };
}

describe('correctness/stale-prop-derivation', () => {
  it('flags each stale binding with the interpolated message', async () => {
    const results = await correctnessStalePropDerivation.check(
      ctx([comp('src/lib/Badge.svelte', [{ name: 'color', line: 3 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/lib/Badge.svelte');
    expect(penalized[0]!.line).toBe(3);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toBe(
      '"color" is computed from a prop once, at initialization — it will not update when the prop changes. Wrap it in $derived.'
    );
    expect(penalized[0]!.fix?.description).toBeTruthy();
  });

  it('emits nothing without the fact', async () => {
    expect(await correctnessStalePropDerivation.check(ctx([comp('src/lib/Ok.svelte', [])]))).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/stale-prop-derivation')).toBe(true);
    expect(explainRule('correctness/stale-prop-derivation')?.severity).toBe('warning');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test -- stale-prop-derivation.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the rule**

Create `packages/core/src/rules/correctness/stale-prop-derivation.ts`:

```ts
import { componentRule } from '../component-rule.js';

/**
 * correctness/stale-prop-derivation — a value computed from a prop without
 * $derived is evaluated once, at init, and silently stops tracking the parent.
 * Svelte's own guidance: treat props as though they will change.
 */
export const correctnessStalePropDerivation = componentRule({
  id: 'correctness/stale-prop-derivation',
  title: 'Stale prop derivation',
  category: 'correctness',
  severity: 'warning',
  label: 'Props derived reactively',
  recommendation: 'Wrap the computation in $derived(...), or $derived.by(() => ...) when it needs a function body.',
  rationale:
    "Svelte's guidance is to treat props as though they will change: a plain `let color = type === 'danger' ? 'red' : 'green'` freezes the first render's value, so the UI silently stops tracking the parent when the prop changes. $derived keeps the computation live at no cost.",
  fix: {
    description: 'Wrap the prop-derived computation in $derived.',
    snippet: "let color = $derived(type === 'danger' ? 'red' : 'green');",
    lang: 'js'
  },
  applies: (c) => c.stalePropDerivations.length > 0,
  bad: (c) =>
    c.stalePropDerivations.map((s) => ({
      line: s.line,
      message: `"${s.name}" is computed from a prop once, at initialization — it will not update when the prop changes. Wrap it in $derived.`
    }))
});
```

(Check `componentRule`'s options: if it has no `fix` option — grep `fix` in `packages/core/src/rules/component-rule.ts` — extend it exactly the way `kit-module-rule.ts` was extended: optional `fix?: Fix` attached to the rule object and spread into each penalized result. `each-index-key` and the others pass no fix, so the conditional spread changes nothing for them.)

- [ ] **Step 4: Register in all four places, tweak unmutated-state**

1. `packages/core/src/rules/index.ts` — import + `allRules` entry + re-export (place after `correctnessPropMutation` or alphabetically with the other correctness rules; follow the file's ordering).
2. `packages/core/src/index.ts` — re-export (untypechecked fourth place — do not skip).
3. `packages/core/src/rules/correctness/unmutated-state.ts` — change the recommendation string from `If a value never changes, use const; if you only ever reassign it wholesale (never mutate its properties), use $state.raw to skip deep proxying.` to `If a value never changes, use const — or $derived if it is computed from props or state; if you only ever reassign it wholesale (never mutate its properties), use $state.raw to skip deep proxying.` If any test pins the old string, update the pin and note it.

- [ ] **Step 5: Verify registration and run the core suite**

Run: `grep -rn "correctnessStalePropDerivation" packages/core/src | wc -l` → Expected `5`.
Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test`
Expected: all pass (with the unmutated-state pin updated if applicable).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/correctness/stale-prop-derivation.ts packages/core/src/rules/correctness/unmutated-state.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/stale-prop-derivation.test.ts
git commit -m "feat(core): add correctness/stale-prop-derivation rule"
```

(If `component-rule.ts` needed the `fix` extension, include it in the `git add`.)

---

### Task 3: Docs (en/ja), changeset, action dist, full verify

**Files:**

- Create: `docs/src/content/docs/rules/correctness/stale-prop-derivation.md`
- Create: `docs/src/content/docs/ja/rules/correctness/stale-prop-derivation.md`
- Create: `.changeset/stale-prop-derivation.md`
- Modify: `packages/action/dist/*` (rebuild)

- [ ] **Step 1: English rule page**

Create `docs/src/content/docs/rules/correctness/stale-prop-derivation.md` (mirror the frontmatter/heading structure of `docs/src/content/docs/rules/correctness/each-index-key.md`):

````markdown
---
title: correctness/stale-prop-derivation · Stale prop derivation
description: 'A value computed from a prop without $derived is evaluated once — the UI silently stops tracking the parent.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags a top-level `const`/`let` whose initializer is computed from a `$props()` prop without `$derived`, when that binding is rendered in the template:

```svelte
<script>
  let { type } = $props();

  // flagged — freezes the first render's value
  let color = type === 'danger' ? 'red' : 'green';
</script>

<p class={color}>...</p>
```

Detection is deliberately conservative — all of these must hold: the initializer references a prop in an eager position (references inside functions/arrow bodies/getters stay reactive and don't count), contains no function calls, `new`, or `await` (so `$state(initial)` capture, `$derived`, and service construction are structurally exempt), the binding is never reassigned or passed around, and it is actually rendered (bindings used only inside event handlers don't count).

## Why it matters

Svelte's guidance is to treat props as though they will change. The plain form evaluates once, at initialization: the component renders correctly on first mount and silently stops tracking the parent afterwards — a stale-UI bug that survives review and surfaces in production, because nothing in the compiler or svelte-check warns about it.

## How to fix

```svelte
<script>
  let { type } = $props();

  let color = $derived(type === 'danger' ? 'red' : 'green');
</script>
```

Use `$derived.by(() => ...)` when the computation needs a function body. If you genuinely want a one-time snapshot (an uncontrolled component's initial value), `let value = $state(initialValue)` is the documented pattern — and it is not flagged.

## Limitations

The call-free restriction means method derivations (`type.toUpperCase()`, `items.filter(...)`) are not detected in v1 — a deliberate precision-first trade-off; a future version may allow-list pure built-ins. The rule cannot know whether the parent ever changes the prop; even when it doesn't, `$derived` costs nothing and keeps the code correct under change. Note the interplay with `correctness/unmutated-state`: for never-written `$state` computed from a prop, the right fix is `$derived`, not `const`.

## Disabling

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/stale-prop-derivation': 'off'
  }
};
```
````

- [ ] **Step 2: Japanese rule page**

Create `docs/src/content/docs/ja/rules/correctness/stale-prop-derivation.md` (same structure; full-width parentheses in prose; QUOTE the frontmatter description — it contains no leading `{` here but quote anyway for safety):

````markdown
---
title: correctness/stale-prop-derivation · Stale prop derivation
description: '$derived を使わずに prop から計算した値は一度しか評価されず、UI は親の変更を静かに追跡しなくなります。'
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

`$props()` の prop から `$derived` なしで計算され、テンプレートで描画されるトップレベルの `const`/`let` を検出します:

```svelte
<script>
  let { type } = $props();

  // 検出対象 — 初回レンダリングの値で固定される
  let color = type === 'danger' ? 'red' : 'green';
</script>

<p class={color}>...</p>
```

検出は意図的に保守的で、次のすべてを満たすときだけ flag します。初期化子が prop を eager な位置で参照している（関数・アロー・getter の中の参照はリアクティブなままなので数えません）、関数呼び出し・`new`・`await` を含まない（`$state(initial)` キャプチャ、`$derived`、サービス構築は構造的に対象外）、束縛が再代入も受け渡しもされない、そして実際にテンプレートで描画される（イベントハンドラー内でしか使われない束縛は数えません）。

## 重要な理由

Svelte のガイダンスは「props は変わるものとして扱え」です。素の形は初期化時に一度だけ評価されるため、初回マウントでは正しく描画され、その後は親の変更を静かに追跡しなくなります。コンパイラも svelte-check も警告しないため、レビューをすり抜けて本番で発覚しがちな stale-UI バグです。

## 修正方法

```svelte
<script>
  let { type } = $props();

  let color = $derived(type === 'danger' ? 'red' : 'green');
</script>
```

関数本体が必要な計算には `$derived.by(() => ...)` を使ってください。一度きりのスナップショットが本当に欲しい場合（非制御コンポーネントの初期値）は、`let value = $state(initialValue)` が公式パターンで、これは検出対象になりません。

## 制限事項

call-free 制限により、メソッドによる派生（`type.toUpperCase()`、`items.filter(...)`）は v1 では検出されません。精度優先の意図的なトレードオフで、将来のバージョンで純粋な組み込みメソッドの allow-list を検討します。また、親がその prop を実際に変えるかどうかは静的には分かりませんが、変えない場合でも `$derived` はコストゼロで、変更に対して正しいコードになります。`correctness/unmutated-state` との関係にも注意してください。prop から計算された書き込みのない `$state` の正しい修正は `const` ではなく `$derived` です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/stale-prop-derivation': 'off'
  }
};
```
````

- [ ] **Step 3: docs-links gate + changeset**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core build && npm_config_verify_deps_before_run=false pnpm --filter svelte-vitals test -- docs-links`
Expected: PASS.

Create `.changeset/stale-prop-derivation.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add `correctness/stale-prop-derivation`: flags top-level values computed from `$props()` props without `$derived` and rendered in the template — they evaluate once at init and silently stop tracking the parent. Conservative by design: eager references only, call-free initializers, never-reassigned bindings, template-rendered. Also tweaks `correctness/unmutated-state`'s recommendation to point at `$derived` for prop-computed state.
```

- [ ] **Step 4: Full verify and action dist**

```bash
npm_config_verify_deps_before_run=false pnpm build
npm_config_verify_deps_before_run=false pnpm typecheck
npm_config_verify_deps_before_run=false pnpm test
npm_config_verify_deps_before_run=false pnpm lint
git status --short packages/action/dist
```

Expected: all pass (lint: only the 2 pre-existing `meta-object.test.ts` warnings). Run the FULL `pnpm build` so the action bundle picks up every rebuilt dependency; commit the dist diff.

- [ ] **Step 5: Commit (two commits)**

```bash
git add docs/src/content/docs/rules/correctness/stale-prop-derivation.md docs/src/content/docs/ja/rules/correctness/stale-prop-derivation.md .changeset/stale-prop-derivation.md
git commit -m "docs: add stale-prop-derivation rule pages (en/ja) and changeset"
git add packages/action/dist
git commit -m "chore(action): rebuild dist for stale-prop-derivation"
```
