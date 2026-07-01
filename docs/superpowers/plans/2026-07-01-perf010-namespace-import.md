# PERF010 — Namespace (whole-library) import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PERF010 — an `info` performance rule that flags a value `import * as X from '<bare package>'` (a whole-library / namespace import that defeats tree-shaking), completing the Bundle slice of #69.

**Architecture:** Capture value namespace imports of bare packages onto a new `ComponentFacts.namespaceImports` field (CLI/static parse; type-only and relative/alias imports excluded), then evaluate with the existing `componentRule` factory. `ComponentFacts.imports` (PERF009) is untouched.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces (`@svelte-vitals/core`, `@svelte-vitals/cli`), Astro Starlight docs, Changesets. Svelte compiler AST (`svelte/compiler` `parse`).

## Global Constraints

- CLI/static only: the rule uses `ctx.components`, unset in rendered mode, so it no-ops there (same as PERF009). Component parsing must never throw (dev tooling).
- Flag a **value** namespace import (`import * as X`) whose specifier is **bare**. Exclude: type-only (`import type * as T`, declaration `importKind === 'type'`), and non-bare specifiers (start with `.`, `/`, `$`, or `#`). No allowlist.
- Severity `info`, category `performance`, scope `component`.
- `ComponentFacts.namespaceImports` is a required field (all ComponentFacts fields are required); every existing ComponentFacts constructor/helper must add it or TS won't compile.
- Verified parser behavior: `import type * as T from 'x'` → `ImportDeclaration.importKind === 'type'`; `import * as U from 'y'` → `importKind === 'value'` + a specifier of type `ImportNamespaceSpecifier`.
- Spec: `docs/superpowers/specs/2026-07-01-perf010-namespace-import-design.md`.
- Branch: `feat/perf010-namespace-import` (created; spec committed).
- Run commands from the repo root.

---

## File Structure

- Modify: `packages/core/src/component.ts` — add `namespaceImports` to `ComponentFacts`.
- Modify: `packages/cli/src/providers/source/parse.ts` — collect namespace imports; add to `parseComponentFacts` return.
- Modify: `packages/cli/src/providers/source/components.ts` — add `namespaceImports: []` to the catch fallback.
- Modify (compile fixups): `packages/core/test/security-rules.test.ts`, `architecture-rules.test.ts`, `correctness-rules.test.ts`, `bundle-rules.test.ts` — add `namespaceImports: []` to each ComponentFacts helper.
- Modify: `packages/cli/test/parse-component-facts.test.ts` — capture tests.
- Create: `packages/core/src/rules/performance/perf010-namespace-import.ts` — the rule.
- Modify: `packages/core/src/rules/index.ts`, `packages/core/src/index.ts` — register/export.
- Modify: `packages/core/test/bundle-rules.test.ts` — PERF010 rule tests.
- Create: `docs/src/content/docs/rules/perf010.md`, `docs/src/content/docs/ja/rules/perf010.md`.
- Create: `.changeset/perf010-namespace-import.md`.

---

### Task 1: Capture `namespaceImports` on ComponentFacts

**Files:**

- Modify: `packages/core/src/component.ts` (add field after `imports`, line 44)
- Modify: `packages/cli/src/providers/source/parse.ts` (add collector near `collectImportSources` line 482-487; extend `parseComponentFacts` return type line 493-501 and body line 502-536)
- Modify: `packages/cli/src/providers/source/components.ts` (catch fallback, add `namespaceImports: []`)
- Modify: `packages/core/test/security-rules.test.ts`, `architecture-rules.test.ts`, `correctness-rules.test.ts` (each has `imports: []` at line 20 in its ComponentFacts helper), `packages/core/test/bundle-rules.test.ts` (the `comp()` helper)
- Test: `packages/cli/test/parse-component-facts.test.ts` (add capture tests)

**Interfaces:**

- Produces: `ComponentFacts.namespaceImports: { source: string; line: number }[]`; `parseComponentFacts(...)` returns it.
- Consumes: existing `walkEstree`, `lineOf` in `parse.ts`.

- [ ] **Step 1: Add the field to the interface**

In `packages/core/src/component.ts`, after the `imports: string[];` line (line 44), inside `ComponentFacts`, add:

```ts
/** Value `import * as X from '<bare pkg>'` namespace imports (type-only excluded) — Bundle PERF010. */
namespaceImports: {
  source: string;
  line: number;
}
[];
```

- [ ] **Step 2: Write the failing capture tests**

In `packages/cli/test/parse-component-facts.test.ts`, append a new describe block at the end of the file:

```ts
describe('parseComponentFacts — namespace imports (PERF010)', () => {
  const ns = (script: string) => parseComponentFacts(`<script>${script}</script>`, 'C.svelte').namespaceImports;

  it('captures a bare value namespace import with its source', () => {
    expect(ns("import * as _ from 'lodash';").map((n) => n.source)).toEqual(['lodash']);
  });
  it('captures namespace imports from a module script too', () => {
    const c = parseComponentFacts(
      `<script module>import * as a from 'apkg';</script><script>import * as b from 'bpkg';</script>`,
      'C.svelte'
    );
    expect(c.namespaceImports.map((n) => n.source).sort()).toEqual(['apkg', 'bpkg']);
  });
  it('excludes type-only, named/default, and non-bare namespace imports', () => {
    expect(ns("import type * as T from 'tpkg';")).toEqual([]);
    expect(ns("import { debounce } from 'lodash';")).toEqual([]);
    expect(ns("import x from 'xpkg';")).toEqual([]);
    expect(ns("import * as u from './utils';")).toEqual([]);
    expect(ns("import * as e from '$lib/env';")).toEqual([]);
  });
  it('records a 1-based line', () => {
    const [only] = parseComponentFacts(
      `<script>\nimport * as _ from 'lodash';\n</script>`,
      'C.svelte'
    ).namespaceImports;
    expect(only!.line).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run the capture tests to verify they fail**

Run: `pnpm --filter svelte-vitals test parse-component-facts`
Expected: FAIL — `namespaceImports` is `undefined` (collector not wired).

- [ ] **Step 4: Add the collector in `parse.ts`**

In `packages/cli/src/providers/source/parse.ts`, immediately after `collectImportSources` (after line 487), add:

```ts
/** A specifier is "bare" (a node_modules package) when it is not relative/absolute/alias-local. */
function isBareSpecifier(s: string): boolean {
  return !/^[./$#]/.test(s);
}

/** Value `import * as X from '<bare pkg>'` namespace imports (type-only excluded) — Bundle PERF010. */
function collectNamespaceImports(program: Node, source: string, acc: { source: string; line: number }[]): void {
  walkEstree(program, (n) => {
    if (n.type !== 'ImportDeclaration' || n.importKind === 'type') return;
    const spec = n.source?.value;
    if (typeof spec !== 'string' || !isBareSpecifier(spec)) return;
    if (Array.isArray(n.specifiers) && n.specifiers.some((s: Node) => s?.type === 'ImportNamespaceSpecifier')) {
      acc.push({ source: spec, line: lineOf(source, n.start) });
    }
  });
}
```

- [ ] **Step 5: Wire it into `parseComponentFacts`**

In the `parseComponentFacts` return-type annotation (lines 493-501), add after `imports: string[];`:

```ts
namespaceImports: {
  source: string;
  line: number;
}
[];
```

In the body, replace the imports-collection block (lines 510-512):

```ts
// Imports live in either the instance (<script>) or module (<script module>) program.
const imports: string[] = [];
if (ast.module?.content) collectImportSources(ast.module.content, imports);
```

with:

```ts
// Imports live in either the instance (<script>) or module (<script module>) program.
const imports: string[] = [];
const namespaceImports: { source: string; line: number }[] = [];
if (ast.module?.content) {
  collectImportSources(ast.module.content, imports);
  collectNamespaceImports(ast.module.content, source, namespaceImports);
}
```

Then, inside the `if (program) {` block, right after the existing `collectImportSources(program, imports);` (line 518), add:

```ts
collectNamespaceImports(program, source, namespaceImports);
```

Finally, update the return statement (line 536) from:

```ts
return { eachBlocks, effects, htmlTags, javascriptUrls, loc, propCount, imports };
```

to:

```ts
return { eachBlocks, effects, htmlTags, javascriptUrls, loc, propCount, imports, namespaceImports };
```

- [ ] **Step 6: Update the provider catch fallback**

In `packages/cli/src/providers/source/components.ts`, in the `catch` block's returned literal (the one with `imports: []`), add after `imports: []`:

```ts
          imports: [],
          namespaceImports: []
```

(Ensure the object remains valid — `imports: []` gains a trailing comma and `namespaceImports: []` follows.)

- [ ] **Step 7: Update existing ComponentFacts test helpers so the suite compiles**

Each of these files builds a `ComponentFacts` object and now needs `namespaceImports: []`:

- `packages/core/test/security-rules.test.ts` — after `imports: [],` (line 20) add `  namespaceImports: [],`
- `packages/core/test/architecture-rules.test.ts` — after `imports: [],` (line 20) add `  namespaceImports: [],`
- `packages/core/test/correctness-rules.test.ts` — after `imports: [],` (line 20) add `  namespaceImports: [],`
- `packages/core/test/bundle-rules.test.ts` — in the `comp()` helper, after the `imports` line, add `namespaceImports: []` (the helper currently takes `imports` as a param and lists it last; add `namespaceImports: []` as an additional property).

- [ ] **Step 8: Run capture tests + typecheck to verify green**

Run: `pnpm --filter svelte-vitals test parse-component-facts`
Expected: PASS (existing + 4 new).
Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter @svelte-vitals/core typecheck && pnpm --filter svelte-vitals typecheck`
Expected: no errors. (Core must be rebuilt first — cli consumes core's dist, which is gitignored, and the `ComponentFacts` type changed.)

- [ ] **Step 9: Run the affected core suites to confirm the helper edits are correct**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS (the helper edits keep security/architecture/correctness/bundle rule tests green).

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/component.ts packages/cli/src/providers/source/parse.ts packages/cli/src/providers/source/components.ts packages/cli/test/parse-component-facts.test.ts packages/core/test/security-rules.test.ts packages/core/test/architecture-rules.test.ts packages/core/test/correctness-rules.test.ts packages/core/test/bundle-rules.test.ts
git commit -m "feat(cli): capture namespace imports onto ComponentFacts.namespaceImports"
```

---

### Task 2: PERF010 rule + registration

**Files:**

- Create: `packages/core/src/rules/performance/perf010-namespace-import.ts`
- Modify: `packages/core/src/rules/index.ts` (import line ~43; `allRules` ~90; re-export ~138)
- Modify: `packages/core/src/index.ts` (re-export ~77)
- Test: `packages/core/test/bundle-rules.test.ts` (add PERF010 describe block)

**Interfaces:**

- Consumes: `componentRule` from `../component-rule.js`; `ComponentFacts.namespaceImports` (Task 1).
- Produces: `export const perf010NamespaceImport: Rule`.

- [ ] **Step 1: Write the failing rule tests**

In `packages/core/test/bundle-rules.test.ts`, add to the top import line: change
`import { perf009HeavyImport } from '../src/index.js';`
to
`import { perf009HeavyImport, perf010NamespaceImport } from '../src/index.js';`

Then append a new describe block at the end of the file (the `comp()` helper now includes `namespaceImports: []` from Task 1; construct facts with namespace imports inline):

```ts
describe('PERF010 namespace import', () => {
  const withNs = (namespaceImports: { source: string; line: number }[]): ComponentFacts => ({
    ...comp([]),
    namespaceImports
  });

  it('flags a bare namespace import', async () => {
    const rs = await perf010NamespaceImport.check(ctx([withNs([{ source: 'lodash', line: 2 }])]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('performance');
    expect(rs[0]!.message).toContain('lodash');
  });
  it('dedupes the same package imported twice (one finding)', async () => {
    const rs = await perf010NamespaceImport.check(
      ctx([
        withNs([
          { source: 'lodash', line: 2 },
          { source: 'lodash', line: 3 }
        ])
      ])
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('reports one finding per distinct package', async () => {
    const rs = await perf010NamespaceImport.check(
      ctx([
        withNs([
          { source: 'lodash', line: 2 },
          { source: 'three', line: 3 }
        ])
      ])
    );
    expect(fails(rs)).toHaveLength(2);
  });
  it('passes a component with no namespace imports', async () => {
    const rs = await perf010NamespaceImport.check(ctx([withNs([])]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(0); // applies() is false → no signal
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test bundle-rules`
Expected: FAIL — `perf010NamespaceImport` is not exported.

- [ ] **Step 3: Write the rule**

Create `packages/core/src/rules/performance/perf010-namespace-import.ts`:

```ts
import { componentRule } from '../component-rule.js';

export const perf010NamespaceImport = componentRule({
  id: 'PERF010',
  title: 'Namespace import',
  category: 'performance',
  severity: 'info',
  label: 'No namespace imports',
  recommendation:
    "Use named imports (import { x } from 'pkg') instead of import * as — a namespace import keeps the whole module in the bundle.",
  rationale:
    'A namespace import (import * as X) forces the bundler to retain the entire module, so unused exports cannot be tree-shaken out.',
  applies: (c) => c.namespaceImports.length > 0,
  bad: (c) => {
    // Dedupe by source so a package imported as a namespace twice isn't double-penalized.
    const seen = new Set<string>();
    const out: { line: number; message: string }[] = [];
    for (const ns of c.namespaceImports) {
      if (seen.has(ns.source)) continue;
      seen.add(ns.source);
      out.push({
        line: ns.line,
        message: `Namespace import "* as … from '${ns.source}'" — prefer named imports so the bundler can tree-shake`
      });
    }
    return out;
  }
});
```

- [ ] **Step 4: Register the rule**

In `packages/core/src/rules/index.ts`:

Add the import after the PERF009 import (line 43):

```ts
import { perf010NamespaceImport } from './performance/perf010-namespace-import.js';
```

In `allRules`, replace the closing `  perf009HeavyImport\n];` with:

```ts
  perf009HeavyImport,
  perf010NamespaceImport
];
```

In the re-export `export { … }` block, replace the closing `  perf009HeavyImport\n};` with:

```ts
  perf009HeavyImport,
  perf010NamespaceImport
};
```

In `packages/core/src/index.ts`, in the `export { … } from './rules/index.js'` block, replace the `  perf009HeavyImport` line (line 77) with:

```ts
(perf009HeavyImport, perf010NamespaceImport);
```

(Preserve whatever follows the block — only add the new line after `perf009HeavyImport`.)

- [ ] **Step 5: Run rule tests + typecheck**

Run: `pnpm --filter @svelte-vitals/core test bundle-rules`
Expected: PASS (PERF009 + 4 new PERF010).
Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/performance/perf010-namespace-import.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/bundle-rules.test.ts
git commit -m "feat(core): add PERF010 namespace import rule"
```

---

### Task 3: Docs + changeset

**Files:**

- Create: `docs/src/content/docs/rules/perf010.md`, `docs/src/content/docs/ja/rules/perf010.md`
- Create: `.changeset/perf010-namespace-import.md`

- [ ] **Step 1: Write the English doc**

Create `docs/src/content/docs/rules/perf010.md`:

````md
---
title: PERF010 · Namespace import
description: Prefer named imports over import * as for tree-shaking.
---

**Severity:** info · **Category:** performance

## What it checks

Flags a value `import * as X from '<package>'` from a bare (node_modules) package. Type-only imports (`import type * as T`) and non-bare specifiers (relative, `$lib`, `$app`, `$env`, `#…`) are not flagged. Static (CLI) analysis of `src/**/*.svelte` scripts.

## Why it matters

A namespace import forces the bundler to retain the entire module, so unused exports cannot be tree-shaken out — even packages like `three` or `d3` ship less when imported by name.

## How to fix

```svelte
<script>
  // Instead of:  import * as _ from 'lodash';
  import debounce from 'lodash/debounce';

  // Instead of:  import * as THREE from 'three';
  import { Scene, WebGLRenderer } from 'three';
</script>
```
````

````

- [ ] **Step 2: Write the Japanese doc**

Create `docs/src/content/docs/ja/rules/perf010.md`:

```md
---
title: PERF010 · namespace import
description: ツリーシェイクのため import * as より named import を推奨します。
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

bare(node_modules)パッケージからの値の `import * as X from '<package>'` を検出します。型のみの import(`import type * as T`)や、bare でない specifier(相対・`$lib`・`$app`・`$env`・`#…`)は対象外です。`src/**/*.svelte` のスクリプトを静的(CLI)解析します。

## なぜ重要か

namespace import はモジュール全体をバンドルに残すため、未使用のエクスポートをツリーシェイクで除去できません。`three` や `d3` のようなパッケージでも、名前付き import の方が出力は小さくなります。

## 修正方法

```svelte
<script>
  // import * as _ from 'lodash'; の代わりに
  import debounce from 'lodash/debounce';

  // import * as THREE from 'three'; の代わりに
  import { Scene, WebGLRenderer } from 'three';
</script>
````

````

- [ ] **Step 3: Write the changeset**

Create `.changeset/perf010-namespace-import.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add **PERF010 (namespace import)** — the remaining Bundle slice of #69. Flags a
value `import * as X from '<bare package>'`, which keeps the whole module in the
bundle and defeats tree-shaking; named imports are preferred. Type-only and
non-bare (relative / `$lib` / `$app` / `#…`) namespace imports are not flagged.
Reported under `performance` (info). `ComponentFacts` gains `namespaceImports`.
````

- [ ] **Step 4: Verify docs build**

Run: `pnpm --filter docs build`
Expected: build succeeds; the two new pages are included (page count rises by 2).

- [ ] **Step 5: Commit**

```bash
git add docs/src/content/docs/rules/perf010.md docs/src/content/docs/ja/rules/perf010.md .changeset/perf010-namespace-import.md
git commit -m "docs: PERF010 reference pages (en+ja) + changeset"
```

---

### Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Build core, then run the whole suite / typecheck / lint / docs build**

Run:

```bash
pnpm -r build && pnpm -r test && pnpm -r typecheck && pnpm lint && pnpm --filter docs build
```

Expected: all green. Core test count rises by 4 (PERF010 rule tests); cli by 4 (capture tests).

- [ ] **Step 2: If lint reports formatting, fix and re-run**

Run: `pnpm exec prettier --write . && pnpm lint`
Expected: "All matched files use Prettier code style!" and eslint clean.

- [ ] **Step 3: Final commit (only if Step 2 changed files)**

```bash
git add -A
git commit -m "chore: format PERF010 changes"
```

---

## Self-Review

**Spec coverage:**

- `ComponentFacts.namespaceImports` field → Task 1 Step 1. ✓
- Collector: bare-only, type-only excluded, module + instance scripts, line → Task 1 Steps 4-5. ✓
- Provider catch fallback + existing helper compile fixups → Task 1 Steps 6-7. ✓
- `perf010NamespaceImport` rule (info/performance/component, dedupe by source, line) → Task 2 Step 3. ✓
- Registration in allRules + both re-exports; MCP via allRules → Task 2 Step 4. ✓
- Docs 2 pages + changeset (core/svelte-vitals/mcp minor) → Task 3. ✓
- Testing: capture (bare/type-only/named/default/relative/$lib, module script, line) + rule (flag/dedupe/multi/pass-no-signal) → Tasks 1-2. ✓
- Out of scope (barrel, general import-kind model, allowlist) → not planned. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `namespaceImports: { source: string; line: number }[]` identical in `component.ts`, `parse.ts` return type, collector `acc`, and rule consumption. Rule name `perf010NamespaceImport` consistent across Tasks 2-3 and tests. `isBareSpecifier`/`collectNamespaceImports` defined once in Task 1 and used there. ✓
