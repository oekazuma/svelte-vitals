# CORRECT004 — unmutated `$state` → `const` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CORRECT004 — an `info` correctness rule that flags a `let x = $state(...)` never written or escaped anywhere in the component (reactivity unused → `const`).

**Architecture:** The CLI parser collects, per component, the `$state` declarations that are never written or escaped, onto a new `ComponentFacts.constableStates` field. "Written/escaped" is detected conservatively over both the instance script and the template expressions (handler mutations) plus a dedicated template walk for `bind:` and component-prop passing. The `componentRule` factory builds the rule; it no-ops in rendered mode.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces (`@svelte-vitals/core`, `@svelte-vitals/cli`), Astro Starlight docs, Changesets. Svelte compiler AST via `svelte/compiler`.

## Global Constraints

- Only `let x = $state(...)` with an `Identifier` binding is considered (destructured `$state` ignored).
- A `$state` name is SUPPRESSED (not flagged) if anywhere in the component it is: reassigned/compound/`++`/`--`; member/element assigned (`x.a=`, `x[i]=`); the object of a method call (`x.push()`); an argument to any call (`f(x)`); bound (`bind:value={x}`); or passed as a component prop (`<Child d={x}>`, `<Child {...x}>`).
- Writes (assign/update/method/call-arg) are detected over BOTH the instance program AND the template fragment (inline handlers like `onclick={() => x++}` live in the template). Missing them would be a false positive — the cardinal sin.
- Reads do NOT suppress: `{x}` interpolation, member reads `x.a`, DOM attribute expressions (`<input value={x}>`), `{#each x}`/`{#if x}`, a Component's slot children (`<Card>{x}</Card>`).
- `stateNames` / `assignsOnlyState` / `reactiveNames` (CORRECT002/003) are unchanged.
- `ComponentFacts.constableStates` is a required field — existing full-object ComponentFacts test helpers must add it or TS won't compile.
- Rule: `id 'CORRECT004'`, `category 'correctness'`, `severity 'info'`, `scope 'component'`.
- Verified AST: `bind:value={x}` → `BindDirective { expression }`; `<Child d={x}>` → `Component` node with prop expressions in `attributes`, slot children in `fragment`; `CHILD_NODE_KEYS` does NOT include `attributes`.
- Spec: `docs/superpowers/specs/2026-07-02-correct004-unmutated-state-design.md`.
- Branch: `feat/correct004-unmutated-state` (created; spec committed).
- Run commands from the repo root.

---

## File Structure

- Modify: `packages/core/src/component.ts` — add `constableStates` to `ComponentFacts`.
- Modify: `packages/cli/src/providers/source/parse.ts` — `rootObjectName`, `collectStateWrites`, `collectTemplateEscapes`, `stateDecls`, populate `constableStates`.
- Modify: `packages/cli/test/parse-component-facts.test.ts` — capture tests.
- Modify: `packages/core/test/{correctness,security,architecture,bundle}-rules.test.ts` — add `constableStates: []` to each full ComponentFacts helper.
- Modify: `packages/core/src/rules/correctness/correct004-unmutated-state.ts` (create) — the rule.
- Modify: `packages/core/src/rules/index.ts`, `packages/core/src/index.ts` — register/export.
- Modify: `packages/core/test/correctness-rules.test.ts` — CORRECT004 rule tests (Task 2).
- Create: `docs/src/content/docs/rules/correct004.md`, `docs/src/content/docs/ja/rules/correct004.md` (Task 3).
- Create: `.changeset/correct004-unmutated-state.md` (Task 3).

---

### Task 1: Capture `constableStates`

**Files:**
- Modify: `packages/core/src/component.ts` (add field after `namespaceImports`)
- Modify: `packages/cli/src/providers/source/parse.ts` (helpers near `addBoundNames`; return type; instance block; return object)
- Modify: `packages/cli/test/parse-component-facts.test.ts` (add capture tests)
- Modify: `packages/core/test/correctness-rules.test.ts`, `security-rules.test.ts`, `architecture-rules.test.ts`, `bundle-rules.test.ts` (add `constableStates: []` to each ComponentFacts helper)

**Interfaces:**
- Produces: `ComponentFacts.constableStates: { name: string; line: number }[]`; `parseComponentFacts` sets it.
- Consumes: existing `walkEstree`, `lineOf`, `isStateDeclaration`, `CHILD_NODE_KEYS`.

- [ ] **Step 1: Add the field to `ComponentFacts`**

In `packages/core/src/component.ts`, after the `namespaceImports: …` field, inside `ComponentFacts`, add:

```ts
  /** `$state` declarations never written or escaped anywhere in the component — candidates for const (CORRECT004). */
  constableStates: { name: string; line: number }[];
```

- [ ] **Step 2: Write the failing capture tests**

In `packages/cli/test/parse-component-facts.test.ts`, append at the end of the file:

```ts
describe('parseComponentFacts — constable $state (CORRECT004)', () => {
  const names = (src: string) => parseComponentFacts(src, 'C.svelte').constableStates.map((s) => s.name);

  it('flags a $state that is only read', () => {
    expect(names('<script>let title = $state("Hi");</script><h1>{title}</h1>')).toEqual(['title']);
    expect(names('<script>let cfg = $state({ a: 1 });</script><p>{cfg.a}</p>')).toEqual(['cfg']);
  });
  it('does not flag a $state written in the script', () => {
    expect(names('<script>let n = $state(0); function inc() { n++; }</script>')).toEqual([]);
    expect(names('<script>let o = $state({}); o.x = 1;</script>')).toEqual([]);
    expect(names('<script>let a = $state([]); a.push(1);</script>')).toEqual([]);
    expect(names('<script>let x = $state(0); use(x);</script>')).toEqual([]);
  });
  it('does not flag a $state mutated in an inline handler', () => {
    expect(names('<script>let n = $state(0);</script><button onclick={() => n++}>+</button>')).toEqual([]);
  });
  it('does not flag a bound $state', () => {
    expect(names('<script>let name = $state("");</script><input bind:value={name} />')).toEqual([]);
  });
  it('does not flag a $state passed as a component prop', () => {
    expect(names('<script>let data = $state({});</script><Child d={data} />')).toEqual([]);
  });
  it('still flags a $state only read in a slot child or DOM attribute', () => {
    expect(names('<script>let label = $state("x");</script><Card>{label}</Card>')).toEqual(['label']);
    expect(names('<script>let ph = $state("x");</script><input value={ph} />')).toEqual(['ph']);
  });
});
```

- [ ] **Step 3: Run the capture tests to verify they fail**

Run: `pnpm --filter svelte-vitals test parse-component-facts`
Expected: FAIL — `constableStates` is `undefined`.

- [ ] **Step 4: Add the parser helpers**

In `packages/cli/src/providers/source/parse.ts`, immediately after the `addBoundNames` function, add:

```ts
/** The base identifier name of a (possibly nested) member expression or identifier, else undefined. */
function rootObjectName(node: Node): string | undefined {
  let cur = node;
  while (cur?.type === 'MemberExpression') cur = cur.object;
  return cur?.type === 'Identifier' ? cur.name : undefined;
}

/**
 * Add state names that are WRITTEN or ESCAPED (CORRECT004 rules 1–4): reassignment,
 * update, member/element assignment, method call on the state, or the state passed
 * as a call argument. Run over the instance program AND the template fragment
 * (inline handlers mutate state in the template).
 */
function collectStateWrites(root: Node, stateNames: Set<string>, acc: Set<string>): void {
  walkEstree(root, (n: Node) => {
    if (n?.type === 'AssignmentExpression') {
      if (n.left?.type === 'Identifier' && stateNames.has(n.left.name)) acc.add(n.left.name);
      else if (n.left?.type === 'MemberExpression') {
        const r = rootObjectName(n.left);
        if (r && stateNames.has(r)) acc.add(r);
      }
    } else if (n?.type === 'UpdateExpression' && n.argument?.type === 'Identifier' && stateNames.has(n.argument.name)) {
      acc.add(n.argument.name);
    } else if (n?.type === 'CallExpression') {
      if (n.callee?.type === 'MemberExpression') {
        const r = rootObjectName(n.callee);
        if (r && stateNames.has(r)) acc.add(r); // x.push(), x.foo()
      }
      for (const a of n.arguments ?? []) {
        if (a?.type === 'Identifier' && stateNames.has(a.name)) acc.add(a.name); // f(x)
      }
    }
  });
}

/**
 * Add state names ESCAPED via the template (CORRECT004 rules 5–6): a `bind:` on any
 * element, or passed as a `Component` prop. Slot children / DOM-attribute reads do
 * not escape. `CHILD_NODE_KEYS` omits `attributes`, so inspect them explicitly.
 */
function collectTemplateEscapes(node: Node, stateNames: Set<string>, acc: Set<string>): void {
  if (Array.isArray(node)) {
    for (const c of node) collectTemplateEscapes(c, stateNames, acc);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (Array.isArray(node.attributes)) {
    for (const attr of node.attributes) {
      if (attr?.type === 'BindDirective') {
        const r = rootObjectName(attr.expression);
        if (r && stateNames.has(r)) acc.add(r);
      } else if (node.type === 'Component') {
        walkEstree(attr, (m: Node) => {
          if (m?.type === 'Identifier' && stateNames.has(m.name)) acc.add(m.name);
        });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectTemplateEscapes(node[key], stateNames, acc);
  }
}
```

- [ ] **Step 5: Declare `constableStates` and collect state declarations**

In `parseComponentFacts`, add `constableStates` to the return-type annotation, after `namespaceImports: { source: string; line: number }[];`:

```ts
  constableStates: { name: string; line: number }[];
```

Add a `let` binding next to `const effects` (before the `if (program)` block), so it defaults to empty when there is no instance script. Change:

```ts
  const effects: EffectFact[] = [];
  let propCount = 0;
```

to:

```ts
  const effects: EffectFact[] = [];
  const constableStates: { name: string; line: number }[] = [];
  let propCount = 0;
```

In the instance block, extend the existing `VariableDeclarator` walk to also record state declarations (name + line). Change:

```ts
    walkEstree(program, (n) => {
      if (n.type !== 'VariableDeclarator' || !n.init) return;
      if (isStateDeclaration(n.init) && n.id?.type === 'Identifier') stateNames.add(n.id.name);
      if (isStateDeclaration(n.init) || isDerivedDeclaration(n.init) || isPropsCall(n.init))
        addBoundNames(n.id, reactiveNames);
    });
```

to:

```ts
    const stateDecls: { name: string; line: number }[] = [];
    walkEstree(program, (n) => {
      if (n.type !== 'VariableDeclarator' || !n.init) return;
      if (isStateDeclaration(n.init) && n.id?.type === 'Identifier') {
        stateNames.add(n.id.name);
        stateDecls.push({ name: n.id.name, line: lineOf(source, n.start) });
      }
      if (isStateDeclaration(n.init) || isDerivedDeclaration(n.init) || isPropsCall(n.init))
        addBoundNames(n.id, reactiveNames);
    });
```

- [ ] **Step 6: Compute `constableStates`**

Still in the instance block, after the effects-collecting `walkEstree(...)` call (the one that pushes to `effects`), add:

```ts
    const writtenOrEscaped = new Set<string>();
    collectStateWrites(program, stateNames, writtenOrEscaped);
    if (ast.fragment) {
      collectStateWrites(ast.fragment, stateNames, writtenOrEscaped);
      collectTemplateEscapes(ast.fragment, stateNames, writtenOrEscaped);
    }
    for (const d of stateDecls) {
      if (!writtenOrEscaped.has(d.name)) constableStates.push(d);
    }
```

- [ ] **Step 7: Return `constableStates`**

Change the return statement:

```ts
  return { eachBlocks, effects, htmlTags, javascriptUrls, loc, propCount, imports, namespaceImports };
```

to:

```ts
  return { eachBlocks, effects, htmlTags, javascriptUrls, loc, propCount, imports, namespaceImports, constableStates };
```

- [ ] **Step 8: Update the provider catch fallback and core test helpers**

The fallback literal in `packages/cli/src/providers/source/components.ts` (the `catch` block) and the ComponentFacts helpers in the four core test files each need `constableStates: []`:

- `packages/cli/src/providers/source/components.ts` — in the catch block's returned object, after `namespaceImports: []`, add `constableStates: []`.
- `packages/core/test/correctness-rules.test.ts` — in the `comp(over)` base object, after `namespaceImports: [],` add `  constableStates: [],`.
- `packages/core/test/security-rules.test.ts` — same base helper: add `constableStates: []`.
- `packages/core/test/architecture-rules.test.ts` — same: add `constableStates: []`.
- `packages/core/test/bundle-rules.test.ts` — in the `comp()` helper: add `constableStates: []`.

- [ ] **Step 9: Run capture tests + typecheck + affected core suites**

Run: `pnpm --filter svelte-vitals test parse-component-facts`
Expected: PASS (existing + new).
Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter @svelte-vitals/core typecheck && pnpm --filter svelte-vitals typecheck`
Expected: no errors. (Core rebuilt first — `ComponentFacts` changed; cli consumes core's dist.)
Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS (the helper edits keep all core rule suites green).

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/component.ts packages/cli/src/providers/source/parse.ts packages/cli/src/providers/source/components.ts packages/cli/test/parse-component-facts.test.ts packages/core/test/correctness-rules.test.ts packages/core/test/security-rules.test.ts packages/core/test/architecture-rules.test.ts packages/core/test/bundle-rules.test.ts
git commit -m "feat(cli): capture constableStates for CORRECT004"
```

---

### Task 2: CORRECT004 rule + registration

**Files:**
- Create: `packages/core/src/rules/correctness/correct004-unmutated-state.ts`
- Modify: `packages/core/src/rules/index.ts` (import ~line 40; `allRules`; re-export)
- Modify: `packages/core/src/index.ts` (re-export after `correct003EffectAsOnMount`)
- Test: `packages/core/test/correctness-rules.test.ts` (add CORRECT004 describe block)

**Interfaces:**
- Consumes: `componentRule`; `ComponentFacts.constableStates` (Task 1).
- Produces: `export const correct004UnmutatedState: Rule`.

- [ ] **Step 1: Write the failing rule tests**

In `packages/core/test/correctness-rules.test.ts`, add `correct004UnmutatedState` to the `../src/index.js` import, then append:

```ts
describe('CORRECT004 unmutated $state', () => {
  it('flags a constable $state (one finding per state, with line)', async () => {
    const rs = await correct004UnmutatedState.check(
      ctx([comp({ constableStates: [{ name: 'title', line: 2 }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.line).toBe(2);
    expect(rs[0]!.message).toContain('title');
  });
  it('reports one finding per distinct constable state', async () => {
    const rs = await correct004UnmutatedState.check(
      ctx([comp({ constableStates: [{ name: 'a', line: 2 }, { name: 'b', line: 3 }] })])
    );
    expect(fails(rs)).toHaveLength(2);
  });
  it('is no-signal when there are no constable states', async () => {
    const rs = await correct004UnmutatedState.check(ctx([comp({ constableStates: [] })]));
    expect(rs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test correctness-rules`
Expected: FAIL — `correct004UnmutatedState` is not exported.

- [ ] **Step 3: Write the rule**

Create `packages/core/src/rules/correctness/correct004-unmutated-state.ts`:

```ts
import { componentRule } from '../component-rule.js';

export const correct004UnmutatedState = componentRule({
  id: 'CORRECT004',
  title: 'Unmutated $state',
  category: 'correctness',
  severity: 'info',
  label: '$state usage',
  recommendation:
    'If a value never changes, use const; if you only ever reassign it wholesale (never mutate its properties), use $state.raw to skip deep proxying.',
  rationale:
    'A $state that is never mutated pays for reactivity (deep proxying, tracking) it never uses; const (or $state.raw) is clearer and cheaper.',
  applies: (c) => c.constableStates.length > 0,
  bad: (c) =>
    c.constableStates.map((s) => ({
      line: s.line,
      message: `$state "${s.name}" is never mutated — use const (or $state.raw if you only reassign it)`
    }))
});
```

- [ ] **Step 4: Register the rule**

In `packages/core/src/rules/index.ts`:

- CORRECT004 lives in its own file, so add a SEPARATE import line immediately after the existing correctness import (the one importing `correct001EachKey`, `correct002EffectDerived`, `correct003EffectAsOnMount`):
  `import { correct004UnmutatedState } from './correctness/correct004-unmutated-state.js';`
- In `allRules`, replace the `  correct003EffectAsOnMount,` line with:
  ```ts
    correct003EffectAsOnMount,
    correct004UnmutatedState,
  ```
- In the re-export `export { … }` block, replace the `  correct003EffectAsOnMount,` line with the same two lines.

In `packages/core/src/index.ts`, replace the `  correct003EffectAsOnMount,` line with:

```ts
  correct003EffectAsOnMount,
  correct004UnmutatedState,
```

- [ ] **Step 5: Run rule tests + typecheck**

Run: `pnpm --filter @svelte-vitals/core test correctness-rules`
Expected: PASS (CORRECT001/002/003 + 3 new CORRECT004).
Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/correctness/correct004-unmutated-state.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/correctness-rules.test.ts
git commit -m "feat(core): add CORRECT004 unmutated-\$state rule"
```

---

### Task 3: Docs + changeset

**Files:**
- Create: `docs/src/content/docs/rules/correct004.md`, `docs/src/content/docs/ja/rules/correct004.md`
- Create: `.changeset/correct004-unmutated-state.md`

- [ ] **Step 1: Write the English doc**

Create `docs/src/content/docs/rules/correct004.md`:

```md
---
title: CORRECT004 · Unmutated $state
description: Use const (or $state.raw) for a $state that is never mutated.
---

**Severity:** info · **Category:** correctness

## What it checks

Flags a `let x = $state(...)` whose value is never written or escaped anywhere in the component — not reassigned, not mutated (`x.a = …`, `x.push()`), not bound (`bind:value={x}`), not passed to a function or component. Checked by static (CLI) analysis of the component script and template.

## Why it matters

A `$state` that is never mutated pays for reactivity — deep proxying and dependency tracking — that it never uses. `const` is clearer and cheaper; `$state.raw` fits when you only ever reassign the value wholesale (never mutate its properties).

## How to fix

```svelte
<script>
  // Instead of: let title = $state('Dashboard');
  const title = 'Dashboard';

  // Reassigned wholesale but never deeply mutated? Use $state.raw:
  let data = $state.raw(initial);
  data = nextValue;
</script>
```
```

- [ ] **Step 2: Write the Japanese doc**

Create `docs/src/content/docs/ja/rules/correct004.md`:

```md
---
title: CORRECT004 · 変更されない $state
description: 変更されない $state には const（または $state.raw）を使います。
---

**重大度:** info · **カテゴリ:** correctness

## チェック内容

コンポーネント内のどこでも書き込み・エスケープされない `let x = $state(...)` を検出します — 再代入なし、変更なし（`x.a = …`、`x.push()`）、バインドなし（`bind:value={x}`）、関数やコンポーネントへの受け渡しなしのものです。コンポーネントのスクリプトとテンプレートを静的(CLI)解析します。

## なぜ重要か

変更されない `$state` は、使わないリアクティビティ（deep proxy と依存追跡）のコストを払っています。`const` の方が明確で軽量です。値をまるごと差し替えるだけ（プロパティは変更しない）なら `$state.raw` が適します。

## 修正方法

```svelte
<script>
  // let title = $state('Dashboard'); の代わりに
  const title = 'Dashboard';

  // まるごと差し替えるが deep mutate しないなら $state.raw:
  let data = $state.raw(initial);
  data = nextValue;
</script>
```
```

- [ ] **Step 3: Write the changeset**

Create `.changeset/correct004-unmutated-state.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add **CORRECT004 (unmutated $state)** — a Correctness/reactivity rule from #69.
Flags a `let x = $state(...)` that is never written or escaped anywhere in the
component (no reassignment, member/method mutation, bind, call-arg, or
component-prop pass), so its reactivity is unused — use `const` (or `$state.raw`
if only reassigned wholesale). Reported under `correctness` (info). `ComponentFacts`
gains `constableStates`.
```

- [ ] **Step 4: Verify docs build**

Run: `pnpm --filter docs build`
Expected: build succeeds; page count rises by 2 (both correct004 pages present).

- [ ] **Step 5: Commit**

```bash
git add docs/src/content/docs/rules/correct004.md docs/src/content/docs/ja/rules/correct004.md .changeset/correct004-unmutated-state.md
git commit -m "docs: CORRECT004 reference pages (en+ja) + changeset"
```

---

### Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Build core, then run the whole suite / typecheck / lint / docs build**

Run:
```bash
pnpm -r build && pnpm -r test && pnpm -r typecheck && pnpm lint && pnpm --filter docs build
```
Expected: all green. Core test count rises by 3 (CORRECT004 rule tests); cli by ~6 (constable capture tests).

- [ ] **Step 2: If lint reports formatting, fix and re-run**

Run: `pnpm exec prettier --write . && pnpm lint`
Expected: "All matched files use Prettier code style!" and eslint clean.

- [ ] **Step 3: Final commit (only if Step 2 changed files)**

```bash
git add -A
git commit -m "chore: format CORRECT004 changes"
```

---

## Self-Review

**Spec coverage:**
- `ComponentFacts.constableStates` field → Task 1 Step 1. ✓
- Write detection (assign/update/member/method/call-arg) over script + template → `collectStateWrites` run on program AND fragment, Task 1 Steps 4, 6. ✓
- Template escapes (bind: + component prop; slot/DOM-attr reads excluded) → `collectTemplateEscapes`, Task 1 Step 4. ✓
- Handler-mutation false-positive guard → fragment walk in Step 6, tested in Step 2. ✓
- state declarations (Identifier only) + line → Task 1 Step 5. ✓
- Provider fallback + core helper compile fixups → Task 1 Step 8. ✓
- CORRECT004 rule (info/correctness/component, one finding per state) → Task 2 Step 3. ✓
- Registration in allRules + both re-exports; MCP via allRules → Task 2 Step 4. ✓
- Docs 2 pages + changeset (core/svelte-vitals/mcp minor) → Task 3. ✓
- Testing matrix (read-only / script-write / handler / bind / component-prop / slot-read / DOM-attr-read; rule flag / multi / no-signal) → Tasks 1-2. ✓
- Out of scope (Smell B, destructured $state, cross-function tracking) → not planned. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `constableStates: { name: string; line: number }[]` identical in `component.ts`, `parse.ts` return type, and rule consumption. `collectStateWrites`/`collectTemplateEscapes`/`rootObjectName` defined once (Task 1 Step 4) and used in Step 6. Rule name `correct004UnmutatedState` consistent across Task 2 and tests. Registration uses a separate import line for the new file (Task 2 Step 4). ✓
