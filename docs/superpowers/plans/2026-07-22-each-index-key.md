# correctness/each-index-key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `correctness/each-index-key`, a component rule that flags `{#each}` blocks keyed by their own index binding.

**Architecture:** `collectEachBlocks` (component-parse) gains an `isIndexKey` check that sets an optional `indexKey: true` on `EachBlockFact` when the key expression is exactly the block's index binding. A `componentRule`-factory rule consumes the flag. No producer changes — the component channel already flows end to end.

**Tech Stack:** TypeScript, svelte/compiler modern AST (verified: `EachBlock.index` is the index NAME as a string, `EachBlock.key` is an expression node), vitest.

**Spec:** `docs/superpowers/specs/2026-07-22-each-index-key-design.md` (approved).

## Global Constraints

- Rule metadata exactly: id `correctness/each-index-key`, title `Index used as each key`, category `correctness`, severity = factory default (do not pass `severity`), label `Item-keyed {#each}`.
- Message (exact): `{#each} is keyed by its index — identity follows position, exactly like an unkeyed block, but the key makes it look safe.`
- Recommendation (exact): `Key by a value that uniquely identifies the item, e.g. (item.id).`
- Detected: key expression (after unwrapping `satisfies`/`as`) is an `Identifier` whose name equals the block's index name. NOT detected: wrapped forms (`String(i)`, template literals), composite keys containing the index, blocks without an index, unkeyed blocks, constant-list/itemless blocks (already skipped by the collector).
- `indexKey` is set ONLY when true, via conditional spread — existing full-object `toEqual` pins on `EachBlockFact` must keep passing unmodified.
- Registration in four places; `grep -rn "correctnessEachIndexKey" packages/core/src | wc -l` must be exactly 5.
- Core purity: no `node:` imports, no I/O in `packages/core/src`.
- Environment: EVERY pnpm command prefixed `npm_config_verify_deps_before_run=false pnpm ...`; NEVER run `pnpm install`. CLI package filter name is `svelte-vitals`. `docs-links` fails for the new rule until Task 3 adds the pages — expected until then.
- Run `pnpm exec prettier --write` on every touched file before each commit.

---

### Task 1: Fact + parse detection

**Files:**

- Modify: `packages/core/src/component.ts` (EachBlockFact)
- Modify: `packages/core/src/component-parse.ts` (`collectEachBlocks` + new `isIndexKey`)
- Test: `packages/core/test/component-parse.test.ts` (append to the each-blocks tests)

**Interfaces:**

- Consumes: existing `lineOf`, `isConstantListEach`; the modern AST shape `EachBlock { index?: string; key?: Node }`.
- Produces: `EachBlockFact.indexKey?: boolean` — consumed by Task 2's rule.

- [ ] **Step 1: Add the fact field**

In `packages/core/src/component.ts`, inside `EachBlockFact` after `hasKey`:

```ts
  /** Set when the block's key expression is exactly its index binding (`{#each items as item, i (i)}`) — correctness/each-index-key. */
  indexKey?: boolean;
```

- [ ] **Step 2: Write the failing parse tests**

In `packages/core/test/component-parse.test.ts`, find the describe block containing the existing `eachBlocks` assertions (`expect(keyed.eachBlocks).toEqual([{ hasKey: true, line: 1 }])`) and append, mirroring how those tests parse a component source (reuse the file's existing parse helper; the assertions below are the contract):

```ts
it('flags an each block keyed by its index', () => {
  const c = facts('{#each items as item, i (i)}<li>{item}</li>{/each}');
  expect(c.eachBlocks).toEqual([{ hasKey: true, line: 1, indexKey: true }]);
});

it('flags a renamed index key', () => {
  const c = facts('{#each items as item, idx (idx)}<li>{item}</li>{/each}');
  expect(c.eachBlocks).toEqual([{ hasKey: true, line: 1, indexKey: true }]);
});

it('does not set indexKey for item-based keys, other identifiers, or missing index', () => {
  const byId = facts('{#each items as item, i (item.id)}<li>{item}</li>{/each}');
  expect(byId.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
  const otherIdent = facts('{#each items as item, i (globalKey)}<li>{item}</li>{/each}');
  expect(otherIdent.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
  const noIndex = facts('{#each items as item (item)}<li>{item}</li>{/each}');
  expect(noIndex.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
});

it('does not set indexKey on composite keys containing the index', () => {
  const c = facts('{#each items as item, i (item.id + "-" + i)}<li>{item}</li>{/each}');
  expect(c.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
});
```

(`facts` here stands for the file's existing component-parse helper — use whatever name that file already uses; if it parses with a filename argument, pass a `.svelte` name.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: the two new "flags" tests FAIL (`indexKey` missing); the two negative tests already pass.

- [ ] **Step 4: Implement the detection**

In `packages/core/src/component-parse.ts`, add directly above `collectEachBlocks`:

```ts
/**
 * Whether the block's key expression is exactly its index binding
 * (`{#each items as item, i (i)}`) — position-based identity, the anti-pattern
 * Svelte's docs call out ("do not use the index as a key"). Exact-identifier
 * match only: composite keys that merely CONTAIN the index add uniqueness and
 * are legitimate (correctness/each-index-key).
 */
function isIndexKey(each: Node): boolean {
  if (typeof each.index !== 'string' || each.key == null) return false;
  let key = each.key;
  while (key?.type === 'TSSatisfiesExpression' || key?.type === 'TSAsExpression') key = key.expression;
  return key?.type === 'Identifier' && key.name === each.index;
}
```

and change the push inside `collectEachBlocks` to:

```ts
acc.push({
  hasKey: node.key != null,
  line: lineOf(source, node.start),
  ...(isIndexKey(node) ? { indexKey: true } : {})
});
```

- [ ] **Step 5: Run tests to verify they pass, then the full core suite**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: PASS (all, including the 4 new tests).
Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test`
Expected: all pass with NO existing test modified (the conditional spread keeps old `toEqual` pins intact).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/component.ts packages/core/src/component-parse.ts packages/core/test/component-parse.test.ts
git commit -m "feat(core): record index-keyed each blocks in component facts"
```

---

### Task 2: Rule + registration

**Files:**

- Create: `packages/core/src/rules/correctness/each-index-key.ts`
- Modify: `packages/core/src/rules/index.ts` (import + `allRules` + re-export)
- Modify: `packages/core/src/index.ts` (named re-export — untypechecked fourth place)
- Test: `packages/core/test/each-index-key.test.ts` (new)

**Interfaces:**

- Consumes: `EachBlockFact.indexKey` (Task 1); `componentRule` factory.
- Produces: exported rule `correctnessEachIndexKey`.

- [ ] **Step 1: Write the failing rule tests**

Create `packages/core/test/each-index-key.test.ts` (check how the existing test for `correctnessEachKey` builds its `RuleContext`/facts — grep for it — and mirror that harness; the assertions below are the contract):

```ts
import { describe, it, expect } from 'vitest';
import { correctnessEachIndexKey } from '../src/rules/correctness/each-index-key.js';
import { correctnessEachKey } from '../src/rules/correctness/each-key.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { defaultProject, defaultConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config: defaultConfig, components } as RuleContext;
}

function comp(file: string, eachBlocks: ComponentFacts['eachBlocks']): ComponentFacts {
  return { ...emptyComponentFacts(file), eachBlocks };
}

describe('correctness/each-index-key', () => {
  it('flags each index-keyed block at its line', async () => {
    const results = await correctnessEachIndexKey.check(
      ctx([
        comp('src/lib/List.svelte', [
          { hasKey: true, line: 3, indexKey: true },
          { hasKey: true, line: 9 }
        ])
      ])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/lib/List.svelte');
    expect(penalized[0]!.line).toBe(3);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toBe(
      '{#each} is keyed by its index — identity follows position, exactly like an unkeyed block, but the key makes it look safe.'
    );
  });

  it('emits nothing for components without the flag', async () => {
    const results = await correctnessEachIndexKey.check(ctx([comp('src/lib/Ok.svelte', [{ hasKey: true, line: 1 }])]));
    expect(results).toEqual([]);
  });

  it('does not overlap with each-key on a mixed component', async () => {
    const facts = comp('src/lib/Mixed.svelte', [
      { hasKey: false, line: 2 },
      { hasKey: true, line: 5, indexKey: true }
    ]);
    const unkeyed = (await correctnessEachKey.check(ctx([facts]))).filter((r) => r.detection.presence === 'none');
    const indexKeyed = (await correctnessEachIndexKey.check(ctx([facts]))).filter(
      (r) => r.detection.presence === 'none'
    );
    expect(unkeyed.map((r) => r.line)).toEqual([2]);
    expect(indexKeyed.map((r) => r.line)).toEqual([5]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/each-index-key')).toBe(true);
    expect(explainRule('correctness/each-index-key')?.title).toBe('Index used as each key');
  });
});
```

(If `emptyComponentFacts`'s signature differs — e.g. it takes extra arguments — adapt the `comp` helper to it; if the component-rule result shape lacks `location` for penalized results, mirror whatever field the `each-key` tests assert. The message/line/severity assertions are the contract.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test -- each-index-key`
Expected: FAIL — rule module not found.

- [ ] **Step 3: Implement the rule**

Create `packages/core/src/rules/correctness/each-index-key.ts`:

```ts
import { componentRule } from '../component-rule.js';

export const correctnessEachIndexKey = componentRule({
  id: 'correctness/each-index-key',
  title: 'Index used as each key',
  category: 'correctness',
  label: 'Item-keyed {#each}',
  recommendation: 'Key by a value that uniquely identifies the item, e.g. (item.id).',
  rationale:
    "Svelte's guidance is explicit: the key must uniquely identify the object — do not use the index. An index key gives items position-based identity, so element state (focus, inputs, transitions) sticks to positions when the list reorders or items are inserted or removed, exactly like an unkeyed block — but the visible key masks the problem.",
  applies: (c) => c.eachBlocks.some((e) => e.indexKey),
  bad: (c) =>
    c.eachBlocks
      .filter((e) => e.indexKey)
      .map((e) => ({
        line: e.line,
        message:
          '{#each} is keyed by its index — identity follows position, exactly like an unkeyed block, but the key makes it look safe.'
      }))
});
```

- [ ] **Step 4: Register in all four places**

1. `packages/core/src/rules/index.ts` — next to the `correctnessEachKey` import: `import { correctnessEachIndexKey } from './correctness/each-index-key.js';`
2. Same file — add `correctnessEachIndexKey` to `allRules` directly after `correctnessEachKey`.
3. Same file — add it to the `export { … }` block directly after `correctnessEachKey`.
4. `packages/core/src/index.ts` — add it to the rule re-export block after `correctnessEachKey`. **Untypechecked — do not skip.**

- [ ] **Step 5: Verify registration and run the core suite**

Run: `grep -rn "correctnessEachIndexKey" packages/core/src | wc -l` → Expected `5`.
Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core test`
Expected: all pass. If a test pins the rule list/count, update the pin minimally and note it.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/correctness/each-index-key.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/each-index-key.test.ts
git commit -m "feat(core): add correctness/each-index-key rule"
```

---

### Task 3: Docs (en/ja), changeset, action dist, full verify

**Files:**

- Create: `docs/src/content/docs/rules/correctness/each-index-key.md`
- Create: `docs/src/content/docs/ja/rules/correctness/each-index-key.md`
- Create: `.changeset/each-index-key.md`
- Modify: `packages/action/dist/*` (rebuild)

- [ ] **Step 1: Write the English rule page**

Create `docs/src/content/docs/rules/correctness/each-index-key.md` (check `docs/src/content/docs/rules/correctness/each-key.md`'s frontmatter/structure first and mirror it exactly — same heading set, same severity line format):

````markdown
---
title: correctness/each-index-key · Index used as each key
description: Keying an {#each} block by its index gives items position-based identity — the same bug as no key, masked.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `{#each}` block whose key is exactly its index binding, e.g. `{#each items as item, i (i)}`. Checked by static (CLI) analysis of every `.svelte` component under `src/`.

Not flagged: composite keys that merely contain the index (`(item.id + '-' + i)` adds uniqueness — legitimate), wrapped forms (`(String(i))`), blocks keyed by anything item-derived, and itemless/constant-list blocks (which the keyed-each rule already exempts).

## Why it matters

Svelte's own guidance is explicit: the key must uniquely identify the object — do not use the index as a key. An index key makes item identity follow list position, so when the list reorders or items are inserted or removed, element state (focus, input values, transitions) sticks to positions instead of items — exactly the failure mode of an unkeyed block. Worse, the visible key makes the block look safe, so the bug tends to surface in production instead of review.

## How to fix

Key by a value that uniquely identifies the item:

```svelte
{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}
```

## Disabling

If a list provably never reorders and never has mid-list insertions or removals, you can silence a single block with `<!-- svelte-vitals-disable-next-line correctness/each-index-key -->`, or turn the rule off:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/each-index-key': 'off'
  }
};
```
````

Adapt the suppression-comment sentence to the actual component-channel suppression syntax if it differs (check how `each-key.md` words it and mirror).

- [ ] **Step 2: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/correctness/each-index-key.md` (mirror the ja `each-key` page's heading set; full-width parentheses in prose, half-width in code):

````markdown
---
title: correctness/each-index-key · Index used as each key
description: {#each} ブロックのキーに index を使うと、アイテムの同一性が位置ベースになります。キーなしと同じバグが、隠れた形で起こります。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

キーが index 束縛そのものになっている `{#each}` ブロック（例: `{#each items as item, i (i)}`）を検出します。CLI の静的解析が `src/` 配下のすべての `.svelte` コンポーネントを対象にチェックします。

検出しないもの: index を含むだけの複合キー（`(item.id + '-' + i)` は一意性を足す正当な用途）、ラッパー形式（`(String(i))`）、アイテム由来の値によるキー、アイテムなし・定数リストのブロック（keyed-each ルールが既に除外している形）。

## 重要な理由

Svelte 公式ガイダンスは明確です。キーはオブジェクトを一意に識別しなければならず、index をキーに使ってはいけません。index キーではアイテムの同一性がリスト内の位置に従うため、並べ替えや途中への挿入・削除が起きると、要素の状態（フォーカス、入力値、トランジション）がアイテムではなく位置に張り付きます。これはキーなしブロックとまったく同じ故障モードです。しかもキーが見えている分だけ安全そうに見え、バグはレビューではなく本番で発覚しがちです。

## 修正方法

アイテムを一意に識別する値でキーを付けます:

```svelte
{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}
```

## 無効化

リストが並べ替えも途中挿入・削除も起こさないと確実に言える場合は、`<!-- svelte-vitals-disable-next-line correctness/each-index-key -->` で個別に抑制するか、ルールを無効化してください:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/each-index-key': 'off'
  }
};
```
````

- [ ] **Step 3: Verify docs-links, add the changeset**

Run: `npm_config_verify_deps_before_run=false pnpm --filter @svelte-vitals/core build && npm_config_verify_deps_before_run=false pnpm --filter svelte-vitals test -- docs-links`
Expected: PASS.

Create `.changeset/each-index-key.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add `correctness/each-index-key`: flags `{#each}` blocks keyed by their own index (`{#each items as item, i (i)}`) — position-based identity, the same failure mode as an unkeyed block, masked by the visible key.
```

- [ ] **Step 4: Full verify and action dist**

```bash
npm_config_verify_deps_before_run=false pnpm build
npm_config_verify_deps_before_run=false pnpm typecheck
npm_config_verify_deps_before_run=false pnpm test
npm_config_verify_deps_before_run=false pnpm lint
git status --short packages/action/dist
```

Expected: all pass (lint: only the 2 pre-existing `meta-object.test.ts` warnings); commit the regenerated action dist. Run the FULL `pnpm build` (not per-package) so the action bundle picks up every rebuilt workspace dependency.

- [ ] **Step 5: Commit (two commits)**

```bash
git add docs/src/content/docs/rules/correctness/each-index-key.md docs/src/content/docs/ja/rules/correctness/each-index-key.md .changeset/each-index-key.md
git commit -m "docs: add each-index-key rule pages (en/ja) and changeset"
git add packages/action/dist
git commit -m "chore(action): rebuild dist for each-index-key"
```
