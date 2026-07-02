# CORRECT003 — `$effect` used as `onMount` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CORRECT003 — a `warning` correctness rule that flags an `$effect`/`$effect.pre` whose non-empty body reads no reactive value (so it never re-runs and should be `onMount`).

**Architecture:** Add a computed `EffectFact.mountOnly` boolean (mirroring `assignsOnlyState`), set by the CLI parser from a conservative body scan against a `reactiveNames` set ($state ∪ $derived ∪ $props). The `componentRule` factory builds the rule; it no-ops in rendered mode.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces (`@svelte-vitals/core`, `@svelte-vitals/cli`), Astro Starlight docs, Changesets. Svelte compiler AST via `svelte/compiler`.

## Global Constraints

- Conservative "reads reactive" (→ NOT flagged) = body references a reactive name ($state/$state.raw/$derived/$derived.by/$props binding), OR reads a `$`-prefixed non-rune identifier (store), OR contains a bare-identifier `CallExpression` (`foo()`). Member calls (`el.focus()`, `console.log('x')`) are not suppressive by themselves.
- `mountOnly` = the effect callback is an inline arrow/function AND its body is NON-EMPTY AND it reads no reactive value. Empty bodies (`() => {}`) are never flagged.
- Both `$effect` and `$effect.pre` covered (existing `isEffectCall`).
- `EffectFact.mountOnly` is a required field — existing `EffectFact` literals and `toEqual` assertions must add it or TS/tests break.
- `assignsOnlyState` and `stateNames` (CORRECT002) are unchanged; `reactiveNames` is a separate superset.
- Rule: `id 'CORRECT003'`, `category 'correctness'`, `severity 'warning'`, `scope 'component'`.
- Verified: `walkEstree(node, visit)` visits the passed node itself then all children. Effect/rune collection runs only over the instance program (`ast.instance.content`).
- Spec: `docs/superpowers/specs/2026-07-02-correct003-effect-as-onmount-design.md`.
- Branch: `feat/correct003-effect-onmount` (created; spec committed).
- Run commands from the repo root.

---

## File Structure

- Modify: `packages/core/src/component.ts` — add `mountOnly` to `EffectFact`.
- Modify: `packages/cli/src/providers/source/parse.ts` — reactiveNames + body helpers + populate `mountOnly`.
- Modify: `packages/cli/test/parse-component-facts.test.ts` — fix 3 `toEqual` effect assertions; add capture tests.
- Modify: `packages/core/test/correctness-rules.test.ts` — fix 2 `EffectFact` literals; add CORRECT003 rule tests (Task 2).
- Modify: `packages/core/src/rules/correctness/correct001-002.ts` — add CORRECT003 (Task 2).
- Modify: `packages/core/src/rules/index.ts`, `packages/core/src/index.ts` — register/export (Task 2).
- Create: `docs/src/content/docs/rules/correct003.md`, `docs/src/content/docs/ja/rules/correct003.md` (Task 3).
- Create: `.changeset/correct003-effect-onmount.md` (Task 3).

---

### Task 1: Capture `EffectFact.mountOnly`

**Files:**

- Modify: `packages/core/src/component.ts` (add field after `assignsOnlyState`, line 20)
- Modify: `packages/cli/src/providers/source/parse.ts` (helpers after `bodyOnlyAssignsState` ~line 420; instance block ~lines 543-557)
- Modify: `packages/cli/test/parse-component-facts.test.ts` (3 `toEqual` fixups at the effect describe block; add capture tests)
- Modify: `packages/core/test/correctness-rules.test.ts` (2 EffectFact literals at lines 48, 53)

**Interfaces:**

- Produces: `EffectFact.mountOnly: boolean`; `parseComponentFacts` sets it.
- Consumes: existing `walkEstree`, `lineOf`, `isEffectCall`, `isStateDeclaration`.

- [ ] **Step 1: Add the field to `EffectFact`**

In `packages/core/src/component.ts`, inside `EffectFact`, after the `assignsOnlyState: boolean;` line (line 20), add:

```ts
/** True when this $effect has a NON-EMPTY body that reads no reactive value and makes no bare call — it never re-runs, so it should be onMount (CORRECT003). */
mountOnly: boolean;
```

- [ ] **Step 2: Write the failing capture tests**

In `packages/cli/test/parse-component-facts.test.ts`, append a new describe block at the end of the file:

```ts
describe('parseComponentFacts — mount-only $effect (CORRECT003)', () => {
  const facts = (script: string) => parseComponentFacts(`<script>${script}</script>`, 'C.svelte').effects;

  it('marks an effect with only member-call side effects as mountOnly', () => {
    expect(facts('$effect(() => { document.title = "Home"; });')[0]!.mountOnly).toBe(true);
    expect(facts('$effect(() => { el.focus(); });')[0]!.mountOnly).toBe(true);
    expect(facts('$effect(() => analytics.pageView());')[0]!.mountOnly).toBe(true);
  });
  it('is not mountOnly when the body reads reactive state/derived/props', () => {
    expect(facts('let count = $state(0); $effect(() => { console.log(count); });')[0]!.mountOnly).toBe(false);
    expect(facts('let d = $derived(1); $effect(() => { console.log(d); });')[0]!.mountOnly).toBe(false);
    expect(facts('let { title } = $props(); $effect(() => { document.title = title; });')[0]!.mountOnly).toBe(false);
  });
  it('is not mountOnly for a store subscription or a bare call', () => {
    expect(facts('$effect(() => { console.log($page); });')[0]!.mountOnly).toBe(false);
    expect(facts('$effect(() => helper());')[0]!.mountOnly).toBe(false);
  });
  it('is not mountOnly for an empty body', () => {
    expect(facts('$effect(() => {});')[0]!.mountOnly).toBe(false);
  });
  it('covers $effect.pre', () => {
    expect(facts('$effect.pre(() => { el.focus(); });')[0]!.mountOnly).toBe(true);
  });
});
```

- [ ] **Step 3: Run the capture tests to verify they fail**

Run: `pnpm --filter svelte-vitals test parse-component-facts`
Expected: FAIL — `mountOnly` is `undefined` (not computed yet). (Existing effect `toEqual` tests also fail now because the object gained no field yet — they are fixed in Step 6.)

- [ ] **Step 4: Add the parser helpers**

In `packages/cli/src/providers/source/parse.ts`, immediately after `bodyOnlyAssignsState` (after its closing brace, ~line 420), add:

```ts
/** `$derived(...)` or `$derived.by(...)` declaration form. */
function isDerivedDeclaration(node: Node): boolean {
  const c = node?.callee;
  if (c?.type === 'Identifier') return c.name === '$derived';
  if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === '$derived') {
    return c.property?.type === 'Identifier' && c.property.name === 'by';
  }
  return false;
}

/** A `$props()` call (the props rune). */
function isPropsCall(node: Node): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === '$props';
}

/** Add the names a declarator binds (Identifier or destructuring ObjectPattern) to `acc`. */
function addBoundNames(id: Node, acc: Set<string>): void {
  if (!id) return;
  if (id.type === 'Identifier') acc.add(id.name);
  else if (id.type === 'ObjectPattern') {
    for (const p of id.properties ?? []) {
      if (p?.type === 'Property' && p.value?.type === 'Identifier') acc.add(p.value.name);
      else if (p?.type === 'RestElement' && p.argument?.type === 'Identifier') acc.add(p.argument.name);
    }
  }
}

const RUNE_NAMES = new Set(['$state', '$derived', '$effect', '$props', '$bindable', '$inspect', '$host']);

/**
 * Whether an $effect callback body reads a reactive value (CORRECT003, conservative):
 * a reactive name, a `$`-prefixed store subscription, or any bare-identifier call.
 */
function bodyReadsReactive(fn: Node, reactiveNames: Set<string>): boolean {
  let reads = false;
  walkEstree(fn.body, (n: Node) => {
    if (reads) return;
    if (n?.type === 'Identifier') {
      if (reactiveNames.has(n.name)) reads = true;
      else if (n.name.startsWith('$') && !RUNE_NAMES.has(n.name)) reads = true;
    } else if (n?.type === 'CallExpression' && n.callee?.type === 'Identifier') {
      reads = true;
    }
  });
  return reads;
}

/** Empty effect callback body (`() => {}` or no body). */
function bodyIsEmpty(fn: Node): boolean {
  const body = fn?.body;
  if (!body) return true;
  if (body.type === 'BlockStatement') return (body.body ?? []).length === 0;
  return false;
}
```

- [ ] **Step 5: Collect `reactiveNames` and populate `mountOnly`**

In `parseComponentFacts`, the instance block currently reads:

```ts
const stateNames = new Set<string>();
walkEstree(program, (n) => {
  if (n.type === 'VariableDeclarator' && n.init && isStateDeclaration(n.init) && n.id?.type === 'Identifier') {
    stateNames.add(n.id.name);
  }
});
walkEstree(program, (n) => {
  if (n.type !== 'CallExpression' || !isEffectCall(n)) return;
  const fn = n.arguments?.[0];
  const isFn = fn?.type === 'ArrowFunctionExpression' || fn?.type === 'FunctionExpression';
  effects.push({
    line: lineOf(source, n.start),
    assignsOnlyState: isFn ? bodyOnlyAssignsState(fn, stateNames) : false
  });
});
```

Replace it with (adds a `reactiveNames` superset and the `mountOnly` field; `stateNames` unchanged):

```ts
const stateNames = new Set<string>();
const reactiveNames = new Set<string>();
walkEstree(program, (n) => {
  if (n.type !== 'VariableDeclarator' || !n.init) return;
  if (isStateDeclaration(n.init) && n.id?.type === 'Identifier') stateNames.add(n.id.name);
  if (isStateDeclaration(n.init) || isDerivedDeclaration(n.init) || isPropsCall(n.init))
    addBoundNames(n.id, reactiveNames);
});
walkEstree(program, (n) => {
  if (n.type !== 'CallExpression' || !isEffectCall(n)) return;
  const fn = n.arguments?.[0];
  const isFn = fn?.type === 'ArrowFunctionExpression' || fn?.type === 'FunctionExpression';
  effects.push({
    line: lineOf(source, n.start),
    assignsOnlyState: isFn ? bodyOnlyAssignsState(fn, stateNames) : false,
    mountOnly: isFn ? !bodyIsEmpty(fn) && !bodyReadsReactive(fn, reactiveNames) : false
  });
});
```

- [ ] **Step 6: Fix the existing effect `toEqual` assertions**

In `packages/cli/test/parse-component-facts.test.ts`, the three full-object effect assertions must include `mountOnly: false` (all three effects read reactive state, so they are not mount-only):

- `expect(e).toEqual([{ line: 1, assignsOnlyState: true }]);` (the "only assigns $state" test) → `expect(e).toEqual([{ line: 1, assignsOnlyState: true, mountOnly: false }]);`
- `expect(e).toEqual([{ line: 1, assignsOnlyState: false }]);` (the "console.log(count)" test) → add `, mountOnly: false`
- `expect(e).toEqual([{ line: 1, assignsOnlyState: true }]);` (the `$effect.pre` test) → add `, mountOnly: false`

(The `expect(facts(...)).toEqual([])` no-effects assertion is unchanged.)

- [ ] **Step 7: Fix the EffectFact literals in the core correctness tests**

In `packages/core/test/correctness-rules.test.ts`, the two CORRECT002 test literals gain `mountOnly: false`:

- `effects: [{ line: 5, assignsOnlyState: true }]` → `effects: [{ line: 5, assignsOnlyState: true, mountOnly: false }]`
- `effects: [{ line: 5, assignsOnlyState: false }]` → `effects: [{ line: 5, assignsOnlyState: false, mountOnly: false }]`

- [ ] **Step 8: Run capture tests + typecheck**

Run: `pnpm --filter svelte-vitals test parse-component-facts`
Expected: PASS (existing + new).
Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter @svelte-vitals/core typecheck && pnpm --filter svelte-vitals typecheck`
Expected: no errors. (Core is rebuilt first because `EffectFact` changed and cli consumes core's dist.)

- [ ] **Step 9: Run the core correctness suite to confirm the literal fixups**

Run: `pnpm --filter @svelte-vitals/core test correctness-rules`
Expected: PASS (existing CORRECT001/002 tests still green).

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/component.ts packages/cli/src/providers/source/parse.ts packages/cli/test/parse-component-facts.test.ts packages/core/test/correctness-rules.test.ts
git commit -m "feat(cli): capture EffectFact.mountOnly for CORRECT003"
```

---

### Task 2: CORRECT003 rule + registration

**Files:**

- Modify: `packages/core/src/rules/correctness/correct001-002.ts` (add rule)
- Modify: `packages/core/src/rules/index.ts` (import ~line 40; `allRules` ~line 86; re-export ~line 135)
- Modify: `packages/core/src/index.ts` (re-export ~line 72)
- Test: `packages/core/test/correctness-rules.test.ts` (add CORRECT003 describe block)

**Interfaces:**

- Consumes: `componentRule`; `EffectFact.mountOnly` (Task 1).
- Produces: `export const correct003EffectAsOnMount: Rule`.

- [ ] **Step 1: Write the failing rule tests**

In `packages/core/test/correctness-rules.test.ts`, add `correct003EffectAsOnMount` to the import from `../src/index.js`, then append at the end of the file:

```ts
describe('CORRECT003 effect used as onMount', () => {
  it('flags a mount-only $effect', async () => {
    const rs = await correct003EffectAsOnMount.check(
      ctx([comp({ effects: [{ line: 4, assignsOnlyState: false, mountOnly: true }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.message).toContain('onMount');
  });
  it('passes an $effect that reads reactive state', async () => {
    const rs = await correct003EffectAsOnMount.check(
      ctx([comp({ effects: [{ line: 4, assignsOnlyState: false, mountOnly: false }] })])
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // a passing seed (applies=true, no findings)
  });
  it('is no-signal when there are no effects', async () => {
    const rs = await correct003EffectAsOnMount.check(ctx([comp({ effects: [] })]));
    expect(rs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test correctness-rules`
Expected: FAIL — `correct003EffectAsOnMount` is not exported.

- [ ] **Step 3: Add the rule**

In `packages/core/src/rules/correctness/correct001-002.ts`, append:

```ts
export const correct003EffectAsOnMount = componentRule({
  id: 'CORRECT003',
  title: 'Effect used as onMount',
  category: 'correctness',
  label: '$effect usage',
  recommendation:
    "Move mount-time side effects to onMount (import { onMount } from 'svelte'); reserve $effect for logic that reacts to $state/$derived/$props.",
  rationale:
    'An $effect that reads no reactive value runs once after mount and never re-runs — it is an onMount in disguise, which obscures intent and misuses the reactivity system.',
  applies: (c) => c.effects.length > 0,
  bad: (c) =>
    c.effects
      .filter((e) => e.mountOnly)
      .map((e) => ({ line: e.line, message: '$effect reads no reactive value — use onMount instead' }))
});
```

- [ ] **Step 4: Register the rule**

In `packages/core/src/rules/index.ts`:

- Update the import (line 40) to include the new rule:
  `import { correct001EachKey, correct002EffectDerived, correct003EffectAsOnMount } from './correctness/correct001-002.js';`
- In `allRules`, replace the `  correct002EffectDerived,` line with:
  ```ts
    correct002EffectDerived,
    correct003EffectAsOnMount,
  ```
- In the re-export `export { … }` block, replace the `  correct002EffectDerived,` line with the same two lines.

In `packages/core/src/index.ts`, replace the `  correct002EffectDerived,` line (line 72) with:

```ts
  correct002EffectDerived,
  correct003EffectAsOnMount,
```

- [ ] **Step 5: Run rule tests + typecheck**

Run: `pnpm --filter @svelte-vitals/core test correctness-rules`
Expected: PASS (CORRECT001/002 + 3 new CORRECT003).
Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/correctness/correct001-002.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/correctness-rules.test.ts
git commit -m "feat(core): add CORRECT003 effect-used-as-onMount rule"
```

---

### Task 3: Docs + changeset

**Files:**

- Create: `docs/src/content/docs/rules/correct003.md`, `docs/src/content/docs/ja/rules/correct003.md`
- Create: `.changeset/correct003-effect-onmount.md`

- [ ] **Step 1: Write the English doc**

Create `docs/src/content/docs/rules/correct003.md`:

````md
---
title: CORRECT003 · Effect used as onMount
description: Use onMount for an $effect that reads no reactive value.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `$effect` / `$effect.pre` whose non-empty body reads no reactive value — no `$state`, `$derived`, or `$props`, no store subscription, and no local function call. Such an effect runs once after mount and never re-runs. Checked by static (CLI) analysis of component instance scripts.

## Why it matters

An `$effect` that never reacts to anything is an `onMount` in disguise. Using `$effect` obscures that intent and misuses the reactivity system; `onMount` says "run this once when the component mounts" directly.

## How to fix

```svelte
<script>
  import { onMount } from 'svelte';
  // Instead of: $effect(() => { element.focus(); });
  onMount(() => {
    element.focus();
  });
</script>
```
````

````

- [ ] **Step 2: Write the Japanese doc**

Create `docs/src/content/docs/ja/rules/correct003.md`:

```md
---
title: CORRECT003 · onMount 代わりの $effect
description: reactive 値を読まない $effect には onMount を使います。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

空でない本体が reactive 値を一切読まない `$effect` / `$effect.pre` を検出します — `$state`・`$derived`・`$props` の参照、store 購読、ローカル関数呼び出しのいずれも無いものです。そのような effect はマウント後に一度だけ実行され、再実行されません。コンポーネントの instance スクリプトを静的(CLI)解析します。

## なぜ重要か

何にも反応しない `$effect` は実質 `onMount` です。`$effect` を使うとその意図が曖昧になり、リアクティビティの仕組みを誤用します。`onMount` なら「マウント時に一度だけ実行する」ことを直接表現できます。

## 修正方法

```svelte
<script>
  import { onMount } from 'svelte';
  // $effect(() => { element.focus(); }); の代わりに
  onMount(() => {
    element.focus();
  });
</script>
````

````

- [ ] **Step 3: Write the changeset**

Create `.changeset/correct003-effect-onmount.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add **CORRECT003 (effect used as onMount)** — the Correctness/reactivity slice of
#69. Flags an `$effect`/`$effect.pre` whose non-empty body reads no reactive value
(no `$state`/`$derived`/`$props`, no store subscription, no bare function call), so
it never re-runs and should be `onMount`. Reported under `correctness` (warning).
`EffectFact` gains `mountOnly`.
````

- [ ] **Step 4: Verify docs build**

Run: `pnpm --filter docs build`
Expected: build succeeds; page count rises by 2 (both correct003 pages present).

- [ ] **Step 5: Commit**

```bash
git add docs/src/content/docs/rules/correct003.md docs/src/content/docs/ja/rules/correct003.md .changeset/correct003-effect-onmount.md
git commit -m "docs: CORRECT003 reference pages (en+ja) + changeset"
```

---

### Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Build core, then run the whole suite / typecheck / lint / docs build**

Run:

```bash
pnpm -r build && pnpm -r test && pnpm -r typecheck && pnpm lint && pnpm --filter docs build
```

Expected: all green. Core test count rises by 3 (CORRECT003 rule tests); cli by ~5 (mountOnly capture tests).

- [ ] **Step 2: If lint reports formatting, fix and re-run**

Run: `pnpm exec prettier --write . && pnpm lint`
Expected: "All matched files use Prettier code style!" and eslint clean.

- [ ] **Step 3: Final commit (only if Step 2 changed files)**

```bash
git add -A
git commit -m "chore: format CORRECT003 changes"
```

---

## Self-Review

**Spec coverage:**

- `EffectFact.mountOnly` field → Task 1 Step 1. ✓
- Conservative reactive-read scan (reactive names + `$store` + bare call), empty-body exclusion, `$effect.pre`, reactiveNames = $state ∪ $derived ∪ $props → Task 1 Steps 4-5. ✓
- Existing EffectFact `toEqual`/literal fixups → Task 1 Steps 6-7. ✓
- CORRECT003 rule (warning/correctness/component, filters `mountOnly`) → Task 2 Step 3. ✓
- Registration in allRules + both re-exports; MCP via allRules → Task 2 Step 4. ✓
- Docs 2 pages + changeset (core/svelte-vitals/mcp minor) → Task 3. ✓
- Testing: capture (member-call / reactive / $store / bare / empty / $effect.pre) + rule (flag / pass / no-signal) → Tasks 1-2. ✓
- Out of scope (transitive local-fn analysis, other reactive sources, CORRECT002 merge) → not planned. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `mountOnly: boolean` identical in `component.ts` and every `EffectFact` literal/assertion. Rule name `correct003EffectAsOnMount` consistent across Task 2 and tests. Helper names (`isDerivedDeclaration`, `isPropsCall`, `addBoundNames`, `bodyReadsReactive`, `bodyIsEmpty`, `RUNE_NAMES`) defined once in Task 1 and used there. ✓
