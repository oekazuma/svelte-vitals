# Inline Suppression Directive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `// svelte-vitals-disable-next-line CORRECT002` (or `<!-- svelte-vitals-disable-next-line -->` in markup) comment suppress a specific component-scoped rule's finding on the following line, fixing the CORRECT002 false positive in [issue #92](https://github.com/oekazuma/svelte-vitals/issues/92).

**Architecture:** A pure text scan (`collectSuppressions`) finds directive comments in a `.svelte` file's source and records `{ line, ruleIds? }` entries on `ComponentFacts.suppressions`. A single filter added to the shared `componentRule()` factory drops any `bad()` occurrence whose line matches a directive for that rule id (or a blanket directive) — this one change covers every rule built on `componentRule()` (CORRECT001–004, SEC001–002, ARCH001–002, PERF009–010) with no per-rule code.

**Tech Stack:** TypeScript, vitest, pnpm workspaces (`@svelte-vitals/core`, `svelte-vitals` CLI package).

**Branch:** `correct002-suppression-directive` (already checked out; work happens here).

## Global Constraints

- Directive must be the **entire content of its line** (leading whitespace only before it) — no same-line trailing-comment form in this iteration.
- The suppressed line is the directive's line **+ 1**; an intervening blank line means no match.
- Rule ids match `/^[A-Za-z]+\d+$/`, case-insensitive, stored uppercased; a blank id list means "suppress every rule on that line."
- An unmatched/misspelled rule id is not an error — it simply suppresses nothing.
- No `--show-suppressions` reporting, no "unused directive" warning, no route/project-scope (SEO) suppression — all out of scope per the approved design (`docs/superpowers/specs/2026-07-04-inline-suppression-directive-design.md`).

---

## Task 1: Add `SuppressionDirective` to `ComponentFacts` (plumbing only, no new behavior)

**Files:**

- Modify: `packages/core/src/component.ts`
- Modify: `packages/core/src/index.ts:23`
- Modify: `packages/cli/src/providers/source/components.ts`
- Modify: `packages/core/test/correctness-rules.test.ts:17-29` (`comp()` fixture)
- Modify: `packages/core/test/security-rules.test.ts:12-24` (`comp()` fixture)
- Modify: `packages/core/test/architecture-rules.test.ts:12-24` (`comp()` fixture)
- Modify: `packages/core/test/bundle-rules.test.ts:12-23` (`comp()` fixture)

**Interfaces:**

- Produces: `SuppressionDirective { line: number; ruleIds?: string[] }`, exported from `@svelte-vitals/core`. `ComponentFacts.suppressions: SuppressionDirective[]` (new required field — every literal that builds a full `ComponentFacts` must supply it).

This task only adds the field and keeps every existing fixture/literal compiling. No new tests are needed (no new behavior yet) — the check is that the existing suite still passes.

- [ ] **Step 1: Add the type and field in `packages/core/src/component.ts`**

Add this interface right before `ComponentFacts` (after the `SourceSpan` interface, i.e. after line 29):

```ts
/** An inline `svelte-vitals-disable-next-line` directive found in the component's source (issue #92). */
export interface SuppressionDirective {
  /** 1-based line the directive suppresses (the line immediately after the comment). */
  line: number;
  /** Rule ids suppressed on that line; undefined = suppress every rule on that line. */
  ruleIds?: string[];
}
```

Then add this field to `ComponentFacts` (after `constableStates`, i.e. after the current last field at line 50):

```ts
  /** Inline `svelte-vitals-disable-next-line` directives found in this file's source — component-rule escape hatch (issue #92). */
  suppressions: SuppressionDirective[];
```

- [ ] **Step 2: Export the new type from `packages/core/src/index.ts`**

Change line 23 from:

```ts
export type { EachBlockFact, EffectFact, SourceSpan, ComponentFacts } from './component.js';
```

to:

```ts
export type { EachBlockFact, EffectFact, SourceSpan, ComponentFacts, SuppressionDirective } from './component.js';
```

- [ ] **Step 3: Add the fallback field in `packages/cli/src/providers/source/components.ts`**

In the `catch` branch's fallback object (currently ends with `constableStates: []`), add `suppressions: []`:

```ts
      } catch {
        return {
          file: rel,
          eachBlocks: [],
          effects: [],
          htmlTags: [],
          javascriptUrls: [],
          loc: 0,
          propCount: 0,
          imports: [],
          namespaceImports: [],
          constableStates: [],
          suppressions: []
        };
      }
```

- [ ] **Step 4: Add `suppressions: []` to the four test fixtures**

In each of these files, the `comp()` helper builds a full `ComponentFacts` literal ending with `constableStates: [],` (and in `bundle-rules.test.ts`, `constableStates: []` with no trailing comma before `...over`/close). Add `suppressions: [],` right after `constableStates: [],` in:

- `packages/core/test/correctness-rules.test.ts`
- `packages/core/test/security-rules.test.ts`
- `packages/core/test/architecture-rules.test.ts`

For `packages/core/test/bundle-rules.test.ts`, the literal has no `...over` spread (it takes `imports: string[]` directly) and currently ends:

```ts
  namespaceImports: [],
  constableStates: []
});
```

Change to:

```ts
  namespaceImports: [],
  constableStates: [],
  suppressions: []
});
```

- [ ] **Step 5: Run the full test suite and typecheck to confirm nothing broke**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck && pnpm --filter svelte-vitals test && pnpm --filter svelte-vitals typecheck`
Expected: all PASS, zero TypeScript errors (this step only adds a field with fixtures updated everywhere it's constructed — no behavior changed, so no test assertions should change).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/component.ts packages/core/src/index.ts packages/cli/src/providers/source/components.ts packages/core/test/correctness-rules.test.ts packages/core/test/security-rules.test.ts packages/core/test/architecture-rules.test.ts packages/core/test/bundle-rules.test.ts
git commit -m "feat(core): add SuppressionDirective type to ComponentFacts (issue #92)"
```

---

## Task 2: Implement `collectSuppressions` and wire it into `parseComponentFacts`

**Files:**

- Modify: `packages/cli/src/providers/source/parse.ts`
- Test: `packages/cli/test/parse-component-facts.test.ts`

**Interfaces:**

- Consumes: `SuppressionDirective` from `@svelte-vitals/core` (Task 1).
- Produces: `parseComponentFacts(source, filename).suppressions: SuppressionDirective[]` — the CLI-side capture, used by `collectComponentFacts()` (already wired since `parseComponentFacts`'s return is spread directly into the `ComponentFacts` object in `components.ts`; no further change needed there beyond Task 1's fallback).

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block to `packages/cli/test/parse-component-facts.test.ts` (e.g. after the `constable $state (CORRECT004)` block, at the end of the file):

```ts
describe('parseComponentFacts — suppression directives (issue #92)', () => {
  it('captures a script-side disable-next-line with a rule id', () => {
    const src = '<script>\n// svelte-vitals-disable-next-line CORRECT002\n$effect(() => { x = 1; });\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([{ line: 3, ruleIds: ['CORRECT002'] }]);
  });
  it('captures multiple comma-separated rule ids', () => {
    const src = '<script>\n// svelte-vitals-disable-next-line CORRECT002, SEC001\nx = 1;\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([{ line: 3, ruleIds: ['CORRECT002', 'SEC001'] }]);
  });
  it('captures a blanket disable-next-line with no rule id', () => {
    const src = '<script>\n// svelte-vitals-disable-next-line\nx = 1;\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([{ line: 3, ruleIds: undefined }]);
  });
  it('captures a template-side HTML comment directive', () => {
    const src = '<!-- svelte-vitals-disable-next-line SEC001 -->\n<div>{@html body}</div>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([{ line: 2, ruleIds: ['SEC001'] }]);
  });
  it('does not match a same-line trailing comment', () => {
    const src = '<script>\nx = 1; // svelte-vitals-disable-next-line CORRECT002\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([]);
  });
  it('reports no suppressions for a component without any directive', () => {
    expect(parseComponentFacts('<p>hi</p>', 'C.svelte').suppressions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `pnpm --filter svelte-vitals test -- parse-component-facts`
Expected: FAIL — `suppressions` does not exist on the object returned by `parseComponentFacts` (TypeScript error / undefined property), since `collectSuppressions` doesn't exist yet.

- [ ] **Step 3: Implement `collectSuppressions` in `packages/cli/src/providers/source/parse.ts`**

Update the type-only import on line 3 from:

```ts
import type { Value, EachBlockFact, EffectFact, SourceSpan } from '@svelte-vitals/core';
```

to:

```ts
import type { Value, EachBlockFact, EffectFact, SourceSpan, SuppressionDirective } from '@svelte-vitals/core';
```

Add this just before the `/** Parse a component's reactivity/correctness + security + architecture facts (CLI/static only). */` comment (i.e. right before `export function parseComponentFacts` at line 683):

```ts
const JS_DIRECTIVE = /^\s*\/\/\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*$/;
const HTML_DIRECTIVE =
  /^\s*<!--\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*-->\s*$/;

/**
 * Inline `svelte-vitals-disable-next-line` directives (issue #92). A plain text scan, not an
 * AST walk, so `<script>` (`//`) and template (`<!-- -->`) comments are covered uniformly. The
 * directive must be the entire content of its line; the suppressed line is directive-line + 1.
 */
function collectSuppressions(source: string): SuppressionDirective[] {
  const out: SuppressionDirective[] = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    const m = JS_DIRECTIVE.exec(line) ?? HTML_DIRECTIVE.exec(line);
    if (!m) return;
    const ruleIds = m[1]?.split(',').map((s) => s.trim().toUpperCase());
    out.push({ line: i + 2, ruleIds });
  });
  return out;
}
```

Now wire it into `parseComponentFacts`. Update the return-type declaration (currently lines 686–696) to add the field:

```ts
export function parseComponentFacts(
  source: string,
  filename: string
): {
  eachBlocks: EachBlockFact[];
  effects: EffectFact[];
  htmlTags: SourceSpan[];
  javascriptUrls: SourceSpan[];
  loc: number;
  propCount: number;
  imports: string[];
  namespaceImports: { source: string; line: number }[];
  constableStates: { name: string; line: number }[];
  suppressions: SuppressionDirective[];
} {
```

Inside the function body, add the call right after `const loc = countLines(source);` (currently line 703):

```ts
const loc = countLines(source);
const suppressions = collectSuppressions(source);
```

And add `suppressions` to the final return statement (currently line 753):

```ts
return {
  eachBlocks,
  effects,
  htmlTags,
  javascriptUrls,
  loc,
  propCount,
  imports,
  namespaceImports,
  constableStates,
  suppressions
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter svelte-vitals test -- parse-component-facts`
Expected: PASS — all 6 new cases green, and every pre-existing test in the file still green (unaffected).

- [ ] **Step 5: Run the full CLI package test suite and typecheck**

Run: `pnpm --filter svelte-vitals test && pnpm --filter svelte-vitals typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/providers/source/parse.ts packages/cli/test/parse-component-facts.test.ts
git commit -m "feat(cli): capture svelte-vitals-disable-next-line directives (issue #92)"
```

---

## Task 3: Enforce suppression in `componentRule()`

**Files:**

- Modify: `packages/core/src/rules/component-rule.ts`
- Test: `packages/core/test/component-rule.test.ts` (new)

**Interfaces:**

- Consumes: `ComponentFacts.suppressions` (Task 1), `ComponentIssue { line: number; message: string }` (existing, `component-rule.ts:9-12`).
- Produces: `componentRule()`'s `check()` now drops any `bad()` item matching a suppression before deciding pass/fail — no signature change, so every existing caller (`correct001EachKey`, `correct002EffectDerived`, etc.) is unaffected except in behavior when a matching directive is present.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/component-rule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { componentRule } from '../src/rules/component-rule.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: { detection: { presence: string; value: string } }[]) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (components: ComponentFacts[]): RuleContext => ({ components, ...base });
const comp = (over: Partial<ComponentFacts>): ComponentFacts => ({
  file: 'src/lib/C.svelte',
  eachBlocks: [],
  effects: [],
  htmlTags: [],
  javascriptUrls: [],
  loc: 10,
  propCount: 0,
  imports: [],
  namespaceImports: [],
  constableStates: [],
  suppressions: [],
  ...over
});

// A minimal fake rule with one hard-coded bad occurrence at line 5, so each test
// controls suppression purely through comp({ suppressions: [...] }).
const fakeRule = componentRule({
  id: 'FAKE001',
  title: 'Fake rule',
  category: 'correctness',
  label: 'Fake check',
  recommendation: 'n/a',
  rationale: 'n/a',
  applies: () => true,
  bad: () => [{ line: 5, message: 'fake violation' }]
});

describe('componentRule — inline suppression directives (issue #92)', () => {
  it('flags the violation when there is no suppression', async () => {
    const rs = await fakeRule.check(ctx([comp({})]));
    expect(fails(rs)).toHaveLength(1);
  });
  it('suppresses the violation when a directive matches its line and rule id', async () => {
    const rs = await fakeRule.check(ctx([comp({ suppressions: [{ line: 5, ruleIds: ['FAKE001'] }] })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // falls back to the normal PASS result
  });
  it('does not suppress when the directive targets a different rule id', async () => {
    const rs = await fakeRule.check(ctx([comp({ suppressions: [{ line: 5, ruleIds: ['OTHER999'] }] })]));
    expect(fails(rs)).toHaveLength(1);
  });
  it('suppresses regardless of rule id when the directive is blanket (no ruleIds)', async () => {
    const rs = await fakeRule.check(ctx([comp({ suppressions: [{ line: 5 }] })]));
    expect(fails(rs)).toHaveLength(0);
  });
  it('does not suppress when the directive is on a different line', async () => {
    const rs = await fakeRule.check(ctx([comp({ suppressions: [{ line: 6, ruleIds: ['FAKE001'] }] })]));
    expect(fails(rs)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- component-rule`
Expected: FAIL on the suppression-related cases (2nd, 4th) — `componentRule()` doesn't filter on `suppressions` yet, so the violation is still reported.

- [ ] **Step 3: Implement the filter in `packages/core/src/rules/component-rule.ts`**

Add this function after the `ComponentRuleOptions` interface (i.e. after line 32, before the `componentRule` doc comment):

```ts
/** Whether `ruleId`'s finding on `line` is silenced by an inline directive on this component. */
function isSuppressed(c: ComponentFacts, ruleId: string, line: number): boolean {
  return (c.suppressions ?? []).some((s) => s.line === line && (!s.ruleIds || s.ruleIds.includes(ruleId)));
}
```

Then, inside `check()`, replace:

```ts
const bad = opts.bad(c);
```

with:

```ts
const bad = opts.bad(c).filter((b) => !(b.line > 0 && isSuppressed(c, opts.id, b.line)));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- component-rule`
Expected: PASS — all 5 cases green.

- [ ] **Step 5: Run the full core package test suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: all PASS (including `correctness-rules.test.ts`, `security-rules.test.ts`, `architecture-rules.test.ts`, `bundle-rules.test.ts` from Task 1 — none of their fixtures set a non-empty `suppressions`, so none of their existing assertions change).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/component-rule.ts packages/core/test/component-rule.test.ts
git commit -m "feat(core): suppress component-rule findings via inline directive (issue #92)"
```

---

## Task 4: Regression tests for the issue's exact scenarios

**Files:**

- Modify: `packages/core/test/correctness-rules.test.ts`
- Modify: `packages/core/test/security-rules.test.ts`

**Interfaces:**

- Consumes: `correct002EffectDerived`, `sec001Html` (existing exports), the `comp()`/`ctx()`/`fails()` helpers already present in each file (updated in Task 1).

These document, at the specific-rule level, that the issue's reported false positive (and the analogous template-side SEC001 case) are now suppressible — on top of the generic mechanism test in Task 3.

- [ ] **Step 1: Write the failing test in `correctness-rules.test.ts`**

Add to the `'CORRECT002 effect used to derive state'` describe block (after the existing `'emits nothing for a component with no $effect'` case):

```ts
it('passes the mount-signal pattern when suppressed via inline directive (issue #92)', async () => {
  const rs = await correct002EffectDerived.check(
    ctx([
      comp({
        effects: [{ line: 5, assignsOnlyState: true, mountOnly: false }],
        suppressions: [{ line: 5, ruleIds: ['CORRECT002'] }]
      })
    ])
  );
  expect(fails(rs)).toHaveLength(0);
});
```

- [ ] **Step 2: Write the failing test in `security-rules.test.ts`**

Add to the `'SEC001 raw HTML render'` describe block (after the existing `'emits nothing for a component without {@html}'` case):

```ts
it('passes when the {@html} finding is suppressed via a template-side directive (issue #92)', async () => {
  const rs = await sec001Html.check(
    ctx([comp({ htmlTags: [{ line: 4 }], suppressions: [{ line: 4, ruleIds: ['SEC001'] }] })])
  );
  expect(fails(rs)).toHaveLength(0);
});
```

- [ ] **Step 3: Verify the tests would fail without Task 3's filter**

Task 3 already implemented the filter, so these new tests will pass immediately —
that's expected, but it means running them now doesn't prove they'd catch a
regression. Confirm that directly: in `packages/core/src/rules/component-rule.ts`,
temporarily change

```ts
const bad = opts.bad(c).filter((b) => !(b.line > 0 && isSuppressed(c, opts.id, b.line)));
```

back to

```ts
const bad = opts.bad(c);
```

Run: `pnpm --filter @svelte-vitals/core test -- correctness-rules security-rules`
Expected: FAIL — both new cases from Steps 1–2 fail (the suppression is no longer applied).

- [ ] **Step 4: Restore the filter and verify the tests pass**

Revert the temporary change from Step 3 back to:

```ts
const bad = opts.bad(c).filter((b) => !(b.line > 0 && isSuppressed(c, opts.id, b.line)));
```

Run: `pnpm --filter @svelte-vitals/core test -- correctness-rules security-rules`
Expected: PASS — both new cases green, all pre-existing cases in both files still green.

- [ ] **Step 5: Run the full core suite**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/test/correctness-rules.test.ts packages/core/test/security-rules.test.ts
git commit -m "test(core): add issue #92 regression tests for CORRECT002/SEC001 suppression"
```

---

## Task 5: Document the directive in the CLI guide (en + ja)

**Files:**

- Modify: `docs/src/content/docs/guides/cli.md`
- Modify: `docs/src/content/docs/ja/guides/cli.md`

**Interfaces:** None (docs only).

- [ ] **Step 1: Add the English section**

In `docs/src/content/docs/guides/cli.md`, insert a new section right after the `### --ignore <ids>` section (after its closing code fence, before `### --meta-components <names>` — currently between lines 116 and 118):

````md
### Suppressing a single finding inline

For one intentional occurrence that `--ignore` would silence project-wide, add a
`svelte-vitals-disable-next-line` comment on the line directly above it. Works for
any component-scoped rule (Correctness, Security, Architecture): CORRECT001–004,
SEC001–002, ARCH001–002, PERF009–010.

```svelte
<script>
  // The prerendered HTML always renders this hidden; canVibrate() must run only
  // after mount, or hydration mismatches. $derived would re-run during hydration.
  // svelte-vitals-disable-next-line CORRECT002
  $effect(() => {
    mounted = true;
  });
</script>
```
````

In markup, use an HTML comment instead:

```html
<!-- svelte-vitals-disable-next-line SEC001 -->
<div>{@html trustedMarkup}</div>
```

Omit the rule id to suppress every rule on the next line, or list several
comma-separated (`CORRECT002, SEC001`).

Two constraints: the comment must be the only thing on its line (a trailing
same-line comment is not recognized), and it must be the line **immediately**
above the target — a blank line in between breaks the match.

````

- [ ] **Step 2: Add the Japanese section**

In `docs/src/content/docs/ja/guides/cli.md`, insert the equivalent section right after `### --ignore <ids>` (after its closing code fence, before `### --meta-components <names>` — currently between lines 97 and 99):

```md
### 特定の指摘だけをインラインで抑制する

`--ignore` はプロジェクト全体でルールを無効にしますが、意図的な1箇所だけを黙らせたい場合は、対象行の直前に `svelte-vitals-disable-next-line` コメントを書きます。component スコープの全ルール（Correctness、Security、Architecture）に対応: CORRECT001–004、SEC001–002、ARCH001–002、PERF009–010。

```svelte
<script>
  // プリレンダリングされたHTMLは常に非表示。canVibrate() はマウント後にのみ評価する必要があり、
  // そうしないとハイドレーション不一致が発生する。$derived だとハイドレーション中にも評価される。
  // svelte-vitals-disable-next-line CORRECT002
  $effect(() => {
    mounted = true;
  });
</script>
````

マークアップ内では HTML コメントを使います。

```html
<!-- svelte-vitals-disable-next-line SEC001 -->
<div>{@html trustedMarkup}</div>
```

ルール ID を省略すると次の行のすべてのルールを抑制します。複数指定する場合はカンマ区切りで書けます（`CORRECT002, SEC001`）。

2つの制約があります。コメントはその行に単独で書かれている必要があり（同一行の末尾コメントは認識されません）、対象行の**直前**の行になければなりません（間に空行があると一致しません）。

````

- [ ] **Step 3: Build the docs site to verify no errors**

Run: `pnpm --filter docs build`
Expected: build succeeds with no MDX/markdown errors.

- [ ] **Step 4: Commit**

```bash
git add docs/src/content/docs/guides/cli.md docs/src/content/docs/ja/guides/cli.md
git commit -m "docs: document svelte-vitals-disable-next-line in the CLI guide"
````

---

## Task 6: Changeset

**Files:**

- Create: `.changeset/inline-suppression-directive.md`

- [ ] **Step 1: Write the changeset**

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add an inline `svelte-vitals-disable-next-line` comment to suppress a specific component-scoped rule's finding on the following line (`// ...` in `<script>`, `<!-- ... -->` in markup) — a targeted escape hatch for intentional patterns a rule can't infer statically, such as a mount-only `$effect` used to avoid a hydration mismatch. Covers CORRECT001–004, SEC001–002, ARCH001–002, and PERF009–010. Fixes #92.
```

- [ ] **Step 2: Commit**

```bash
git add .changeset/inline-suppression-directive.md
git commit -m "chore: add changeset for inline suppression directive"
```

---

## Final verification (run once, after all tasks)

- [ ] Run: `pnpm typecheck && pnpm test && pnpm lint`
      Expected: all green across every package.
- [ ] Run: `pnpm --filter docs build`
      Expected: docs build succeeds.
- [ ] Manually re-read the issue's original code sample and confirm the plan's Task 4 regression test in `correctness-rules.test.ts` mirrors it (mount-signal `$effect` + `$derived`, suppressed via `CORRECT002` directive).
