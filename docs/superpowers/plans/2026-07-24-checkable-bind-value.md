# correctness/checkable-bind-value Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new correctness rule, `correctness/checkable-bind-value`, that flags `<input type="checkbox" bind:value={x}>` and `<input type="radio" bind:value={x}>` — `bind:value` binds the DOM `value` property, which checkbox/radio interaction never changes, so the bound state silently never updates.

**Architecture:** Template-only static detection, following the exact pattern already used for `security/javascript-url` (walk the parsed Svelte AST fragment, look at element attributes) and `correctness/nonreactive-builtin-state` (a new `ComponentFacts` list consumed by a `componentRule()` factory). No script-side analysis, no producer/provider changes — rides the existing `ctx.components` channel.

**Tech Stack:** TypeScript, `svelte/compiler`'s `parse()` (already a dependency of `packages/core`), Vitest.

Design doc: [docs/superpowers/specs/2026-07-24-checkable-bind-value-design.md](../specs/2026-07-24-checkable-bind-value-design.md)
Issue: https://github.com/oekazuma/svelte-vitals/issues/299

## Global Constraints

- **Core purity**: no `node:` imports, no I/O, no runtime-specific globals in `packages/core/src/` (all changes here are pure AST/type code — no I/O is introduced).
- **Rule id**: `correctness/checkable-bind-value`. **Severity**: `warning`. **Category**: `correctness`.
- **Four registration places** for the new rule (`packages/core/src/rules/index.ts` import + `allRules` array + re-export block, and `packages/core/src/index.ts`'s own re-export list) — grep for `correctnessNonreactiveBuiltinState` if unsure which lines to mirror.
- **Doc pages required** at `docs/src/content/docs/rules/correctness/checkable-bind-value.md` (en) and `docs/src/content/docs/ja/rules/correctness/checkable-bind-value.md` (ja) — `packages/cli/test/docs-links.test.ts` fails the build without both.
- **Changeset required** (new user-facing rule) — `minor` bump for `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`, `@svelte-vitals/mcp` (mirrors `.changeset` history for the sibling rule `nonreactive-builtin-state`, commit `40a6dc6`).
- **Never hard-code rule counts/ID ranges** in prose outside this rule's own doc pages.
- All shell commands below assume the repository root as the working directory.

---

### Task 1: `ComponentFacts` fact scaffolding

**Files:**

- Modify: `packages/core/src/component.ts`
- Modify: `packages/core/src/component-collect.ts`
- Modify: `packages/core/src/component-parse.ts` (import list + `parseModuleFacts`'s empty default only — the real collector is Task 2)

**Interfaces:**

- Produces: `CheckableBindValueFact` (`{ kind: 'checkbox' | 'radio'; line: number }`), and `ComponentFacts.checkableBindValues: CheckableBindValueFact[]`. Every later task reads/writes this exact field name and shape.

This task only adds the type and its empty defaults everywhere `ComponentFacts` is constructed, so the codebase keeps compiling. No detection logic yet — that's Task 2, done in a real TDD red/green cycle against a working type.

- [ ] **Step 1: Add the fact type and field to `ComponentFacts`**

In `packages/core/src/component.ts`, insert this new interface directly above the `ComponentFacts` interface (after the existing `SuppressionDirective` interface, i.e. right before line 73's `/** Reactivity/correctness + security + architecture facts... */` doc comment):

```ts
/** An `<input type="checkbox">` / `<input type="radio">` element carrying a `bind:value`
 *  directive — `bind:value` observes the DOM `value` property, which checkbox/radio
 *  interaction never changes, so the bound state silently never updates
 *  (correctness/checkable-bind-value). */
export interface CheckableBindValueFact {
  /** Which checkable input type was flagged — selects the message wording. */
  kind: 'checkbox' | 'radio';
  /** 1-based source line, or 0 if unknown. */
  line: number;
}
```

Then add the field to `ComponentFacts`, immediately after the `nonreactiveBuiltinStates` field (right after its closing `}[];` and before the `orphanEffects` field's doc comment):

```ts
  /** `<input type="checkbox">` / `<input type="radio">` elements bound with `bind:value`
   * instead of `bind:checked`/`bind:group` (correctness/checkable-bind-value). */
  checkableBindValues: CheckableBindValueFact[];
```

- [ ] **Step 2: Add the empty default in `emptyComponentFacts`**

In `packages/core/src/component-collect.ts`, in `emptyComponentFacts` (around line 27), add the new field right after `nonreactiveBuiltinStates: [],`:

```ts
    nonreactiveBuiltinStates: [],
    checkableBindValues: [],
```

- [ ] **Step 3: Add the empty default in `parseModuleFacts` and import the new type**

In `packages/core/src/component-parse.ts`, add `CheckableBindValueFact` to the type import block at the top of the file (the `import type { ... } from './component.js';` block, currently listing `BrowserGlobalRefFact, ComponentFacts, EachBlockFact, EffectFact, OrphanEffectFact, OrphanLifecycleCallFact, SourceSpan, SuppressionDirective`):

```ts
import type {
  BrowserGlobalRefFact,
  CheckableBindValueFact,
  ComponentFacts,
  EachBlockFact,
  EffectFact,
  OrphanEffectFact,
  OrphanLifecycleCallFact,
  SourceSpan,
  SuppressionDirective
} from './component.js';
```

Then in `parseModuleFacts` (around line 1823), add the empty default right after `nonreactiveBuiltinStates: [],`:

```ts
    nonreactiveBuiltinStates: [],
    checkableBindValues: [],
```

Runes-module files (`.svelte.ts`/`.svelte.js`) have no template, so this fact is always empty there — matches how `htmlTags`/`javascriptUrls` are handled in the same function.

- [ ] **Step 4: Typecheck to confirm every `ComponentFacts` construction site is updated**

Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: FAILS, pointing at the `parseComponentFacts` function's return object in `component-parse.ts` (around line 2039) — it constructs a `ParsedFacts` object missing the new `checkableBindValues` field. This is expected; Task 2 adds it together with the real detection logic. Confirm the _only_ error is this one missing-property error (no other file was missed).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/component.ts packages/core/src/component-collect.ts packages/core/src/component-parse.ts
git commit -m "feat(core): add checkableBindValues fact scaffolding (issue #299)"
```

(The repo will not fully typecheck until Task 2 lands — that is expected for this intermediate commit, matching the TDD-across-tasks flow used for the sibling `nonreactive-builtin-state` rule.)

---

### Task 2: Template detection in `component-parse.ts`

**Files:**

- Modify: `packages/core/src/component-parse.ts`
- Create: `packages/core/test/checkable-bind-value-parse.test.ts`

**Interfaces:**

- Consumes: `CheckableBindValueFact` from Task 1 (`{ kind: 'checkbox' | 'radio'; line: number }`); `CHILD_NODE_KEYS`, `lineOf`, `findAttr`, `attrTextOf` from `./svelte-ast.js` (already imported at the top of `component-parse.ts`).
- Produces: `parseComponentFacts(source, filename).checkableBindValues` — populated for `.svelte` files, always `[]` for `.svelte.ts`/`.svelte.js` (handled in Task 1).

- [ ] **Step 1: Write the failing parse test**

Create `packages/core/test/checkable-bind-value-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const cbv = (src: string) => parseComponentFacts(src, 'A.svelte').checkableBindValues;

describe('checkableBindValues — records', () => {
  it('records a checkbox with bind:value', () => {
    const src = ['<script>', '  let x = $state(false);', '</script>', '<input type="checkbox" bind:value={x} />'].join(
      '\n'
    );
    expect(cbv(src)).toEqual([{ kind: 'checkbox', line: 4 }]);
  });

  it('records a radio with bind:value', () => {
    const src = ['<script>', "  let x = $state('a');", '</script>', '<input type="radio" bind:value={x} />'].join('\n');
    expect(cbv(src)).toEqual([{ kind: 'radio', line: 4 }]);
  });

  it('records each of multiple checkable inputs with its own line', () => {
    const src = [
      '<script>',
      '  let x = $state(false);',
      "  let y = $state('a');",
      '</script>',
      '<input type="checkbox" bind:value={x} />',
      '<input type="radio" bind:value={y} />'
    ].join('\n');
    expect(cbv(src)).toEqual([
      { kind: 'checkbox', line: 5 },
      { kind: 'radio', line: 6 }
    ]);
  });
});

describe('checkableBindValues — exclusions', () => {
  it('does not record bind:checked on a checkbox', () => {
    expect(cbv('<input type="checkbox" bind:checked={x} />')).toEqual([]);
  });

  it('does not record bind:group on a radio (correct pattern)', () => {
    expect(cbv('<input type="radio" bind:group={x} value="a" />')).toEqual([]);
  });

  it('does not record a plain value attribute paired with bind:group', () => {
    expect(cbv('<input type="checkbox" value="a" bind:group={x} />')).toEqual([]);
  });

  it('does not record bind:value on a non-checkable input type', () => {
    expect(cbv('<input type="text" bind:value={x} />')).toEqual([]);
  });

  it('does not record bind:value with a dynamic type', () => {
    const src = [
      '<script>',
      "  let t = 'checkbox';",
      '  let x = $state(false);',
      '</script>',
      '<input type={t} bind:value={x} />'
    ].join('\n');
    expect(cbv(src)).toEqual([]);
  });

  it('does not record bind:value on a dynamic-tag svelte:element', () => {
    expect(cbv('<svelte:element this="input" type="checkbox" bind:value={x} />')).toEqual([]);
  });

  it('does not record bind:value on a select', () => {
    expect(cbv('<select bind:value={x}><option value="a">a</option></select>')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/checkable-bind-value-parse.test.ts`
Expected: FAILS — `parseComponentFacts(...).checkableBindValues` is `undefined` (the parser doesn't populate the field yet; Task 1 only added the type and empty defaults for the module-file branch, not the `.svelte` branch).

- [ ] **Step 3: Add the module constant and collector function**

In `packages/core/src/component-parse.ts`, add this constant right after the existing `URL_ATTRS` constant (around line 990):

```ts
/** Native checkable input types where bind:value binds the wrong DOM property (correctness/checkable-bind-value). */
const CHECKABLE_INPUT_TYPES = new Set(['checkbox', 'radio']);
```

Then add this function directly after `collectSecurityFacts` (right after its closing `}` around line 1016):

```ts
/**
 * `<input type="checkbox">` / `<input type="radio">` elements carrying a `bind:value`
 * directive (correctness/checkable-bind-value) — bind:value binds the DOM value property,
 * which checkbox/radio interaction never changes, so the bound state silently never updates.
 * Only `RegularElement` (a static `<input>`) is checked, so a dynamic tag via
 * `<svelte:element this="input" …>` is naturally skipped (it is a different node type). A
 * dynamic `type={expr}` makes `attrTextOf` return `undefined`, which is also skipped.
 */
function collectCheckableBindValues(node: Node, source: string, acc: CheckableBindValueFact[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectCheckableBindValues(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && node.name === 'input' && Array.isArray(node.attributes)) {
    const typeAttr = findAttr(node.attributes, 'type');
    const typeValue = typeAttr ? attrTextOf(typeAttr) : undefined;
    if (typeValue && CHECKABLE_INPUT_TYPES.has(typeValue)) {
      const bindValue = node.attributes.find((a: Node) => a?.type === 'BindDirective' && a.name === 'value');
      if (bindValue) {
        acc.push({
          kind: typeValue as 'checkbox' | 'radio',
          line: lineOf(source, bindValue.start ?? node.start)
        });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectCheckableBindValues(node[key], source, acc);
  }
}
```

- [ ] **Step 4: Wire the collector into `parseComponentFacts`**

In `packages/core/src/component-parse.ts`, inside `parseComponentFacts` (the `.svelte`-file branch, not `parseModuleFacts`), add the collection call right after the existing `collectSecurityFacts` call (around line 1845):

```ts
const htmlTags: SourceSpan[] = [];
const javascriptUrls: SourceSpan[] = [];
collectSecurityFacts(ast.fragment ?? ast, source, htmlTags, javascriptUrls);
const checkableBindValues: CheckableBindValueFact[] = [];
collectCheckableBindValues(ast.fragment ?? ast, source, checkableBindValues);
```

Then add `checkableBindValues,` to the function's final return object, right after `nonreactiveBuiltinStates,` (around line 2039):

```ts
    nonreactiveBuiltinStates,
    checkableBindValues,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/checkable-bind-value-parse.test.ts`
Expected: PASS (all 10 cases).

- [ ] **Step 6: Typecheck the whole package**

Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS — this also confirms Task 1's intermediate type error from Step 4 is now resolved.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/component-parse.ts packages/core/test/checkable-bind-value-parse.test.ts
git commit -m "feat(core): detect bind:value on checkable inputs (issue #299)"
```

---

### Task 3: The rule + registration

**Files:**

- Create: `packages/core/src/rules/correctness/checkable-bind-value.ts`
- Modify: `packages/core/src/rules/index.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/checkable-bind-value-rule.test.ts`

**Interfaces:**

- Consumes: `componentRule()` from `../component-rule.js`; `ComponentFacts.checkableBindValues` from Task 1/2.
- Produces: `correctnessCheckableBindValue` (a `Rule`, id `correctness/checkable-bind-value`) — exported from `packages/core/src/rules/index.ts` and re-exported from `packages/core/src/index.ts`, consumed by Task 4's docs-links test and any CLI/report consumer.

- [ ] **Step 1: Write the failing rule test**

Create `packages/core/test/checkable-bind-value-rule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { correctnessCheckableBindValue } from '../src/rules/correctness/checkable-bind-value.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, checkableBindValues: ComponentFacts['checkableBindValues']): ComponentFacts {
  return { ...emptyComponentFacts(file), checkableBindValues };
}

describe('correctness/checkable-bind-value', () => {
  it('flags a checkbox with the checkbox-specific message at warning severity', async () => {
    const results = await correctnessCheckableBindValue.check(
      ctx([comp('src/lib/Form.svelte', [{ kind: 'checkbox', line: 4 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/lib/Form.svelte');
    expect(penalized[0]!.line).toBe(4);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toBe(
      'bind:value on a checkbox does not track its checked state — the bound value silently never updates when the user toggles it. Use bind:checked (single checkbox) or bind:group (checkbox list) instead.'
    );
    expect(penalized[0]!.fix?.description).toContain('bind:checked');
  });

  it('flags a radio with the radio-specific message', async () => {
    const results = await correctnessCheckableBindValue.check(
      ctx([comp('src/lib/Form.svelte', [{ kind: 'radio', line: 6 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.line).toBe(6);
    expect(penalized[0]!.message).toBe(
      'bind:value on a radio input does not track which option is selected — the bound value silently never updates when the user picks one. Use bind:group with a shared group variable across the radio inputs instead.'
    );
  });

  it('flags each fact independently when a file has both', async () => {
    const results = await correctnessCheckableBindValue.check(
      ctx([
        comp('src/lib/Form.svelte', [
          { kind: 'checkbox', line: 4 },
          { kind: 'radio', line: 6 }
        ])
      ])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(2);
  });

  it('emits nothing without the fact', async () => {
    expect(await correctnessCheckableBindValue.check(ctx([comp('src/lib/Ok.svelte', [])]))).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/checkable-bind-value')).toBe(true);
    expect(explainRule('correctness/checkable-bind-value')?.severity).toBe('warning');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/checkable-bind-value-rule.test.ts`
Expected: FAILS with a module-not-found error for `../src/rules/correctness/checkable-bind-value.js` (the rule file doesn't exist yet).

- [ ] **Step 3: Create the rule file**

Create `packages/core/src/rules/correctness/checkable-bind-value.ts`:

```ts
import { componentRule } from '../component-rule.js';

/**
 * correctness/checkable-bind-value — bind:value binds the DOM value property. A
 * checkbox/radio's user interaction toggles checkedness, which bind:value never observes, so
 * the bound state is frozen at its initial value and silently never updates in production.
 * bind:checked (single checkbox) / bind:group (checkbox list, radio group) are the correct
 * bindings.
 */
export const correctnessCheckableBindValue = componentRule({
  id: 'correctness/checkable-bind-value',
  title: 'bind:value on a checkable input',
  category: 'correctness',
  severity: 'warning',
  label: 'bind:checked / bind:group on checkable inputs',
  recommendation: 'Replace bind:value with bind:checked (single checkbox) or bind:group (checkbox list / radio group).',
  rationale:
    "bind:value binds the DOM value property. A checkbox/radio's user interaction toggles checkedness, which bind:value never observes — the bound state is frozen at its initial value. Svelte's checked/grouped bindings (bind:checked, bind:group) are built for exactly this.",
  fix: {
    description:
      "For a single checkbox, replace bind:value={x} with bind:checked={x} (x becomes a boolean). For a checkbox list or radio group, replace bind:value={x} with bind:group={x} on every input sharing the group, keeping each input's static value attribute to identify the option."
  },
  applies: (c) => c.checkableBindValues.length > 0,
  bad: (c) =>
    c.checkableBindValues.map((v) => ({
      line: v.line,
      message:
        v.kind === 'checkbox'
          ? 'bind:value on a checkbox does not track its checked state — the bound value silently never updates when the user toggles it. Use bind:checked (single checkbox) or bind:group (checkbox list) instead.'
          : 'bind:value on a radio input does not track which option is selected — the bound value silently never updates when the user picks one. Use bind:group with a shared group variable across the radio inputs instead.'
    }))
});
```

- [ ] **Step 4: Register in `packages/core/src/rules/index.ts`**

Add the import, right after the existing `import { correctnessNonreactiveBuiltinState } from './correctness/nonreactive-builtin-state.js';` line:

```ts
import { correctnessCheckableBindValue } from './correctness/checkable-bind-value.js';
```

Add to the `allRules` array, right after `correctnessNonreactiveBuiltinState,`:

```ts
  correctnessNonreactiveBuiltinState,
  correctnessCheckableBindValue,
```

Add to the `export { ... }` re-export block at the bottom of the file, right after `correctnessNonreactiveBuiltinState,`:

```ts
  correctnessNonreactiveBuiltinState,
  correctnessCheckableBindValue,
```

- [ ] **Step 5: Register in `packages/core/src/index.ts`**

In the single `export { ... } from './rules/index.js';` re-export list, add it right after `correctnessNonreactiveBuiltinState,`:

```ts
  correctnessNonreactiveBuiltinState,
  correctnessCheckableBindValue,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/checkable-bind-value-rule.test.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 7: Run the full core test suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS. (`packages/cli/test/docs-links.test.ts` will still fail at this point — the rule is registered but its doc pages don't exist yet; that's Task 4, not a regression from this task.)

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/correctness/checkable-bind-value.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/checkable-bind-value-rule.test.ts
git commit -m "feat(core): add correctness/checkable-bind-value rule (issue #299)"
```

---

### Task 4: Documentation (en + ja)

**Files:**

- Create: `docs/src/content/docs/rules/correctness/checkable-bind-value.md`
- Create: `docs/src/content/docs/ja/rules/correctness/checkable-bind-value.md`

**Interfaces:**

- Consumes: rule id `correctness/checkable-bind-value`, severity `warning`, category `correctness` from Task 3 — `packages/cli/test/docs-links.test.ts` asserts both files exist at exactly these paths (`{category}/{rule-name}.md` under each locale's `rules/` dir).

- [ ] **Step 1: Create the English doc page**

Create `docs/src/content/docs/rules/correctness/checkable-bind-value.md`:

````markdown
---
title: correctness/checkable-bind-value · bind:value on a checkable input
description: 'bind:value on a checkbox or radio input binds the DOM value property, which checkbox/radio interaction never changes — the bound state silently never updates.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags a native `<input type="checkbox">` or `<input type="radio">` element that carries a `bind:value` directive:

```svelte
<input type="checkbox" bind:value={subscribed} />
```

`bind:value` binds the DOM `value` property. A checkbox/radio's user interaction toggles _checkedness_, not `value` — so `subscribed` is frozen at its initial value and never updates when the user clicks the checkbox.

Detection is template-only and static: the `type` attribute must be a literal `"checkbox"` or `"radio"` — a dynamic `type={expr}`, or a dynamic tag via `<svelte:element this="input" …>`, is out of static reach and is not flagged. A plain `value="…"` attribute (not the `bind:value` directive) is the correct pattern for `bind:group` and is never confused with the flagged case.

## Why it matters

Svelte's own compiler accepts `bind:value` on a checkbox or radio input without any warning or error — verified directly against Svelte 5 (`svelte.compile()` reports zero warnings for this pattern). The component renders correctly once (the bound variable's initial value shows), and then silently stops updating the moment the user interacts with the input. Nothing surfaces the bug in development; it shows up as "the form doesn't save changes" in production.

## How to fix

For a single checkbox, bind the checked state directly:

```svelte
<input type="checkbox" bind:checked={subscribed} />
```

For a checkbox list or radio group, bind the group instead — each input keeps its own static `value` to identify the option:

```svelte
<input type="radio" bind:group={selected} value="a" />
<input type="radio" bind:group={selected} value="b" />
```

## Limitations

Only native `<input>` elements with a statically-literal `type` are covered. A dynamic `type={expr}`, `<svelte:element this="input" …>`, `<select bind:value>`, and custom components that accept a `bind:value`-shaped prop (e.g. a hand-rolled `<Checkbox bind:value>`) are all out of static reach and are not flagged.

## Disabling

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/checkable-bind-value': 'off'
  }
};
```
````

- [ ] **Step 2: Create the Japanese doc page**

Create `docs/src/content/docs/ja/rules/correctness/checkable-bind-value.md`:

````markdown
---
title: correctness/checkable-bind-value · bind:value on a checkable input
description: 'checkbox や radio に対する bind:value は DOM の value プロパティを束縛するため、チェックの切り替えを検知できず、束縛した値が更新されなくなります。'
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

`bind:value` ディレクティブを持つネイティブの `<input type="checkbox">` または `<input type="radio">` 要素を検出します:

```svelte
<input type="checkbox" bind:value={subscribed} />
```

`bind:value` は DOM の `value` プロパティを束縛します。checkbox・radio のユーザー操作が切り替えるのは _チェック状態_ であって `value` ではないため、`subscribed` は初期値のまま固まってしまい、ユーザーがチェックボックスをクリックしても更新されません。

検出はテンプレートのみを対象にした静的解析です。`type` 属性がリテラルの `"checkbox"` または `"radio"` である場合のみ対象になります — 動的な `type={expr}` や、動的なタグ名を使う `<svelte:element this="input" …>` は静的解析の範囲外のため検出しません。素の `value="…"` 属性(`bind:value` ディレクティブではないもの)は `bind:group` の正しい使い方であり、検出対象と混同することはありません。

## なぜ重要か

Svelte のコンパイラ自身は、checkbox や radio に `bind:value` を使っても警告もエラーも一切出しません — Svelte 5 に対して直接検証済みです(`svelte.compile()` はこのパターンに対して警告ゼロを報告します)。コンポーネントは最初の描画では正しく見えます(束縛した変数の初期値が表示される)が、ユーザーが入力を操作した瞬間から静かに更新が止まります。開発中は何もそのバグを教えてくれず、本番環境で「フォームの変更が保存されない」という形で表面化します。

## 修正方法

単一のチェックボックスなら、チェック状態を直接束縛します:

```svelte
<input type="checkbox" bind:checked={subscribed} />
```

チェックボックスのリストや radio グループなら、代わりにグループを束縛します — 各 input には選択肢を識別するための静的な `value` をそのまま残します:

```svelte
<input type="radio" bind:group={selected} value="a" />
<input type="radio" bind:group={selected} value="b" />
```

## 制限事項

対象になるのは `type` が静的なリテラルであるネイティブの `<input>` 要素だけです。動的な `type={expr}`、`<svelte:element this="input" …>`、`<select bind:value>`、そして `bind:value` 風の prop を受け取る自作コンポーネント(例: 自前の `<Checkbox bind:value>`)は、いずれも静的解析の範囲外のため検出されません。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/checkable-bind-value': 'off'
  }
};
```
````

- [ ] **Step 3: Run the docs-links test**

Run: `pnpm --filter svelte-vitals exec vitest run test/docs-links.test.ts`
Expected: PASS (both the en-page and ja-page checks now find `correctness/checkable-bind-value.md`, and the "no stray pages" check still passes since both files match a registered rule id).

- [ ] **Step 4: Commit**

```bash
git add docs/src/content/docs/rules/correctness/checkable-bind-value.md docs/src/content/docs/ja/rules/correctness/checkable-bind-value.md
git commit -m "docs: add checkable-bind-value rule pages (en/ja)"
```

---

### Task 5: Changeset and full verification

**Files:**

- Create: `.changeset/checkable-bind-value-rule.md`

**Interfaces:**

- Consumes: nothing new — this task only adds the changeset and runs the repo's full verify suite (per `AGENTS.md`) as the final gate before calling the feature done.

- [ ] **Step 1: Create the changeset**

Create `.changeset/checkable-bind-value-rule.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add `correctness/checkable-bind-value`: flags `<input type="checkbox" bind:value={x}>` and `<input type="radio" bind:value={x}>` — `bind:value` binds the DOM `value` property, which checkbox/radio interaction never changes, so the bound state silently never updates. Verified against Svelte 5 directly: the compiler accepts this pattern with zero warnings. Use `bind:checked` (single checkbox) or `bind:group` (checkbox list / radio group) instead.
```

- [ ] **Step 2: Run the full verify suite**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm check:publish`
Expected: all five commands PASS. If `lint` reports formatting issues in the new files, run `pnpm format` and re-run `pnpm lint`.

- [ ] **Step 3: Commit**

```bash
git add .changeset/checkable-bind-value-rule.md
git commit -m "chore: add changeset for checkable-bind-value rule"
```

- [ ] **Step 4: Final review against the design doc**

Re-read `docs/superpowers/specs/2026-07-24-checkable-bind-value-design.md` against the actual diff (`git diff main...HEAD` or equivalent) and confirm every section (Rule, Scope, Fact, Detection, Registration/docs/changeset, Testing) has a corresponding change. This is the natural point to invoke `superpowers:requesting-code-review` if that skill is being used for this branch.
