# Deeper Performance: Resource-Hint Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PERF003 (a `<link rel="preload">` with no `as`) and PERF004 (a `<link rel="preload" as="font">` with no `crossorigin`) — two high-confidence, statically-analyzable resource-hint checks.

**Architecture:** Extend the runtime-agnostic `HeadTag` with `as`/`hasAs`/`hasCrossorigin` (presence + the `as` keyword), populate them from both providers (CLI svelte/compiler + vite node-html-parser), and add a small head-link rule helper plus the two rules to the core engine. Rules are pure functions over `ResolvedHead.tags`.

**Tech Stack:** TypeScript, ESM-only (tsup, `target: es2022`), vitest. No new dependencies.

## Global Constraints

- ESM-only; `@svelte-vitals/core` has **no `node:` imports**; rules are pure functions over resolved heads/images/project.
- **No false negatives:** decide only on attribute presence + the `as` keyword (a fixed vocabulary, like `rel`). A dynamically-bound `as={x}` / `crossorigin={c}` counts as **present** (never flagged).
- New checks decide purely on `as`/`hasAs`/`hasCrossorigin` — never on literal `href` values.
- Both PERF003 and PERF004 are `warning` severity, `scope: 'route'`, `category: 'performance'`.
- Scoring mirrors `imageRule`: a route with no `preload` link emits **nothing** (no Performance signal); a route whose relevant links all pass emits **one** passing result (seeds the route at 100); each failing link emits a finding with a `fix`.
- Static-mode `<svelte:head>` head composition collapses multiple `<link rel="preload">` to one representative (last-wins) — a **documented v1 limitation**; rendered/plugin mode evaluates every preload. The rules are unaffected (they scan whatever `ResolvedHead.tags` contains).
- Release: `@svelte-vitals/core` + `svelte-vitals` + `@svelte-vitals/vite` **minor**; `@svelte-vitals/mcp` cascades a patch.

### Reference: existing types & patterns (read-only — already in the codebase)

```ts
// packages/core/src/head.ts
interface HeadTag {
  kind: 'title' | 'meta' | 'link' | 'jsonld';
  name?: string;
  property?: string;
  rel?: string;
  presence: 'own' | 'inherited';
  value: 'static' | 'dynamic' | 'absent';
  file?: string;
}
interface ResolvedHead {
  route: string;
  source: 'static' | 'rendered';
  tags: HeadTag[];
  file: string;
}

// packages/core/src/rule.ts
interface RuleContext {
  heads: ResolvedHead[];
  images?: ResolvedImages[];
  project: Project;
  config: Config;
}
interface Rule {
  id;
  title;
  category;
  severity;
  scope;
  rationale;
  fix?;
  check(ctx): Promise<Result[]>;
}

// packages/core/src/rules/perf/image-rule.ts — the pattern to mirror:
//   pass result:  detection: { presence: 'own',  value: 'static' }
//   fail result:  detection: { presence: 'none', value: 'absent' }, + fix
//   no signal:    emit nothing (route with no relevant element)

// CLI parse helpers (packages/cli/src/providers/source/parse.ts):
//   findAttr(attributes, name): Node | undefined   — attribute presence
//   attrText(attributes, name): string | undefined — literal text, undefined for dynamic ExpressionTag
//   attrValue(attributes, name): Value             — 'static'|'dynamic'|'absent'
```

---

### Task 1: Extend HeadTag + both providers with `as` / `hasAs` / `hasCrossorigin`

Add the three optional fields to `HeadTag` and populate them from the CLI (source) and vite (rendered) link parsers. No rules yet — no behavior change, just richer head tags.

**Files:**

- Modify: `packages/core/src/head.ts` (HeadTag fields)
- Modify: `packages/cli/src/providers/source/parse.ts` (link branch in `tagsFromHead`)
- Modify: `packages/vite/src/providers/rendered/parse-html.ts` (link loop)
- Test: `packages/cli/test/parse.test.ts` (or the existing parse test file — see Step 1) and `packages/vite/test/parse-html.test.ts`

**Interfaces:**

- Produces: `HeadTag.as?: string`, `HeadTag.hasAs?: boolean`, `HeadTag.hasCrossorigin?: boolean` — set only for `kind: 'link'`. `as` is the literal keyword (undefined when absent OR dynamically bound); `hasAs` is true when an `as` attribute is present at all (literal or dynamic); `hasCrossorigin` is true when a `crossorigin` attribute is present (literal or dynamic).

- [ ] **Step 1: Write the failing provider tests**

First find the existing parse tests:
Run: `ls packages/cli/test | grep -i parse; ls packages/vite/test | grep -i parse`
Expected: `packages/vite/test/parse-html.test.ts` exists. For CLI, append to whichever test exercises `parseHeadTags`/`parseFile` (grep: `grep -rl "parseHeadTags\|parseFile" packages/cli/test`). If none, create `packages/cli/test/parse-link-attrs.test.ts`.

Append to the vite test `packages/vite/test/parse-html.test.ts`:

```ts
import { parseHtmlHead } from '../src/providers/rendered/parse-html.js';
// (describe/it/expect already imported at the top of the file)

describe('parse-html: link as/crossorigin', () => {
  it('captures as + crossorigin presence on a font preload', () => {
    const { tags } = parseHtmlHead(
      '<html><head><link rel="preload" href="/i.woff2" as="font" type="font/woff2" crossorigin></head><body></body></html>'
    );
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.as).toBe('font');
    expect(link.hasAs).toBe(true);
    expect(link.hasCrossorigin).toBe(true);
  });
  it('leaves as/crossorigin unset when absent', () => {
    const { tags } = parseHtmlHead('<html><head><link rel="preload" href="/a.js"></head><body></body></html>');
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.as).toBeUndefined();
    expect(link.hasAs).toBeUndefined();
    expect(link.hasCrossorigin).toBeUndefined();
  });
});
```

Create `packages/cli/test/parse-link-attrs.test.ts` (adjust the import if a parse test already exists):

```ts
import { describe, it, expect } from 'vitest';
import { parseHeadTags } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;

describe('parse: link as/crossorigin (static)', () => {
  it('captures a literal as keyword + crossorigin presence', () => {
    const tags = parseHeadTags(head('<link rel="preload" href="/i.woff2" as="font" crossorigin />'), 'x.svelte');
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.as).toBe('font');
    expect(link.hasAs).toBe(true);
    expect(link.hasCrossorigin).toBe(true);
  });
  it('treats a dynamic as={x} as present but with no literal keyword', () => {
    const tags = parseHeadTags(head('<link rel="preload" href="/a.js" as={kind} />'), 'x.svelte');
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.hasAs).toBe(true); // present → PERF003 won't fire
    expect(link.as).toBeUndefined(); // not a literal → PERF004 won't fire
  });
  it('leaves fields unset when the attributes are absent', () => {
    const tags = parseHeadTags(head('<link rel="preload" href="/a.js" />'), 'x.svelte');
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.hasAs).toBeUndefined();
    expect(link.as).toBeUndefined();
    expect(link.hasCrossorigin).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/vite && pnpm vitest run test/parse-html.test.ts -t "link as/crossorigin"` then `cd ../cli && pnpm vitest run test/parse-link-attrs.test.ts`
Expected: FAIL — `as`/`hasAs`/`hasCrossorigin` are not on the tags yet.

- [ ] **Step 3: Add the fields to `HeadTag`**

In `packages/core/src/head.ts`, inside `interface HeadTag`, after the `rel?: string;` line add:

```ts
  /** <link as="..."> keyword (e.g. 'font') when statically literal; undefined when absent or dynamically bound. */
  as?: string;
  /** True when a <link> has an `as` attribute at all (literal or dynamic). Distinguishes "no as" from "dynamic as". */
  hasAs?: boolean;
  /** True when a <link> has a `crossorigin` attribute (presence only; value is irrelevant to the checks). */
  hasCrossorigin?: boolean;
```

- [ ] **Step 4: Populate them in the CLI parser**

In `packages/cli/src/providers/source/parse.ts`, replace the `link` branch in `tagsFromHead` (currently):

```ts
    } else if (node.name === 'link') {
      const rel = attrText(node.attributes, 'rel');
      tags.push({ kind: 'link', ...(rel ? { rel } : {}), value: attrValue(node.attributes, 'href') });
```

with:

```ts
    } else if (node.name === 'link') {
      const rel = attrText(node.attributes, 'rel');
      const hasAs = findAttr(node.attributes, 'as') !== undefined;
      const asLiteral = attrText(node.attributes, 'as'); // literal keyword, or undefined for dynamic/absent
      const hasCrossorigin = findAttr(node.attributes, 'crossorigin') !== undefined;
      tags.push({
        kind: 'link',
        ...(rel ? { rel } : {}),
        value: attrValue(node.attributes, 'href'),
        ...(hasAs ? { hasAs: true } : {}),
        ...(asLiteral ? { as: asLiteral } : {}),
        ...(hasCrossorigin ? { hasCrossorigin: true } : {})
      });
```

(`findAttr` and `attrText` are already defined in this file.)

- [ ] **Step 5: Populate them in the vite parser**

In `packages/vite/src/providers/rendered/parse-html.ts`, replace the `link` loop body (currently):

```ts
for (const link of head.querySelectorAll('link')) {
  const rel = link.getAttribute('rel');
  if (!rel) continue;
  tags.push({ kind: 'link', rel, presence: 'own', value: attrValue(link.getAttribute('href')) });
}
```

with:

```ts
for (const link of head.querySelectorAll('link')) {
  const rel = link.getAttribute('rel');
  if (!rel) continue;
  const asAttr = link.getAttribute('as'); // rendered HTML: literal string or undefined
  const hasCrossorigin = link.hasAttribute('crossorigin');
  tags.push({
    kind: 'link',
    rel,
    presence: 'own',
    value: attrValue(link.getAttribute('href')),
    ...(asAttr != null ? { hasAs: true, as: asAttr } : {}),
    ...(hasCrossorigin ? { hasCrossorigin: true } : {})
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/vite && pnpm vitest run test/parse-html.test.ts` then `cd ../cli && pnpm vitest run test/parse-link-attrs.test.ts`
Expected: PASS. Also run the full core+cli+vite suites to confirm no regression: `cd /Users/oe.kazuma/localRepo/oss/svelte-vitals && CI=true pnpm --filter @svelte-vitals/core --filter svelte-vitals --filter @svelte-vitals/vite test`
Expected: PASS (adding optional fields changes no existing behavior).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/head.ts packages/cli/src/providers/source/parse.ts packages/vite/src/providers/rendered/parse-html.ts packages/cli/test/parse-link-attrs.test.ts packages/vite/test/parse-html.test.ts
git commit -m "feat(core,cli,vite): capture link as/crossorigin presence on head tags"
```

---

### Task 2: Head-link rule helper + PERF003/PERF004 + docs

Add a `linkRule` helper (mirroring `imageRule`), the two rules, register them, export them, and add their docs pages.

**Files:**

- Create: `packages/core/src/rules/perf/link-rule.ts`
- Create: `packages/core/src/rules/perf/resource-hints.ts`
- Modify: `packages/core/src/rules/index.ts` (register + export)
- Modify: `packages/core/src/index.ts` (export the two rules)
- Create: `docs/src/content/docs/rules/perf003.md`, `docs/src/content/docs/rules/perf004.md`, and `docs/src/content/docs/ja/rules/perf003.md`, `docs/src/content/docs/ja/rules/perf004.md`
- Test: `packages/core/test/perf-resource-hints.test.ts`

**Interfaces:**

- Consumes: `HeadTag.as/hasAs/hasCrossorigin` (Task 1); `Rule`, `RuleContext`, `docsUrlFor` from `../../rule.js`; `HeadTag` from `../../head.js`; `Fix`, `Result`, `Severity` from `../../types.js`.
- Produces: `linkRule(opts): Rule`; `perf003PreloadAs: Rule`; `perf004FontPreloadCrossorigin: Rule`.

- [ ] **Step 1: Write the failing rule test**

Create `packages/core/test/perf-resource-hints.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { perf003PreloadAs, perf004FontPreloadCrossorigin } from '../src/index.js';
import { defineConfig } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { RuleContext } from '../src/rule.js';

const headWith = (tags: Array<Partial<HeadTag>>): ResolvedHead => ({
  route: '/x',
  source: 'rendered',
  file: 'x',
  tags: tags.map((t) => ({ presence: 'own', value: 'static', ...t }) as HeadTag)
});
const ctx = (head: ResolvedHead): RuleContext => ({ heads: [head], project: {}, config: defineConfig({}) });
const ids = (rs: Awaited<ReturnType<typeof perf003PreloadAs.check>>) => rs.map((r) => r.id);
const failing = (rs: Awaited<ReturnType<typeof perf003PreloadAs.check>>) =>
  rs.filter((r) => r.detection.presence === 'none');

describe('PERF003 preload missing as', () => {
  it('flags a preload link with no as', async () => {
    const rs = await perf003PreloadAs.check(ctx(headWith([{ kind: 'link', rel: 'preload' }])));
    expect(failing(rs)).toHaveLength(1);
  });
  it('passes a preload link that has an as', async () => {
    const rs = await perf003PreloadAs.check(
      ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true, as: 'style' }]))
    );
    expect(failing(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // one passing result seeds the route
  });
  it('does not fire on a dynamically-bound as (present)', async () => {
    const rs = await perf003PreloadAs.check(ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true }])));
    expect(failing(rs)).toHaveLength(0);
  });
  it('emits nothing when there is no preload link', async () => {
    const rs = await perf003PreloadAs.check(ctx(headWith([{ kind: 'link', rel: 'stylesheet' }])));
    expect(rs).toHaveLength(0);
  });
});

describe('PERF004 font preload missing crossorigin', () => {
  it('flags as=font preload without crossorigin', async () => {
    const rs = await perf004FontPreloadCrossorigin.check(
      ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true, as: 'font' }]))
    );
    expect(failing(rs)).toHaveLength(1);
  });
  it('passes as=font preload with crossorigin', async () => {
    const rs = await perf004FontPreloadCrossorigin.check(
      ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true, as: 'font', hasCrossorigin: true }]))
    );
    expect(failing(rs)).toHaveLength(0);
  });
  it('ignores a non-font preload', async () => {
    const rs = await perf004FontPreloadCrossorigin.check(
      ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true, as: 'script' }]))
    );
    expect(rs).toHaveLength(0); // not relevant → no signal
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/core && pnpm vitest run test/perf-resource-hints.test.ts`
Expected: FAIL — `perf003PreloadAs`/`perf004FontPreloadCrossorigin` not exported.

- [ ] **Step 3: Create the `linkRule` helper**

Create `packages/core/src/rules/perf/link-rule.ts`:

```ts
import type { Fix, Result, Severity } from '../../types.js';
import type { HeadTag } from '../../head.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

export interface LinkRuleOptions {
  id: string;
  title: string;
  severity: Severity;
  /** Noun phrase for messages, e.g. '`as` on a preloaded `<link>`'. */
  label: string;
  recommendation: string;
  rationale: string;
  fix?: Fix;
  /** Which link tags this rule evaluates (e.g. rel === 'preload'). */
  relevant: (tag: HeadTag) => boolean;
  /** Returns true when a relevant link satisfies the rule (passes). */
  ok: (tag: HeadTag) => boolean;
}

/** Build a route-scoped Performance rule that checks each relevant <link> in the effective head. */
export function linkRule(opts: LinkRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'performance',
    severity: opts.severity,
    scope: 'route',
    rationale: opts.rationale,
    ...(opts.fix ? { fix: opts.fix } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const head of ctx.heads) {
        const links = head.tags.filter((t) => t.kind === 'link' && opts.relevant(t));
        // No relevant link on this route → no Performance signal (mirrors imageRule).
        if (links.length === 0) continue;
        const bad = links.filter((t) => !opts.ok(t));
        if (bad.length === 0) {
          // One passing result seeds the route at 100 for the per-category score.
          out.push({
            id: opts.id,
            category: 'performance',
            severity: opts.severity,
            detection: { presence: 'own', value: 'static' },
            route: head.route,
            message: opts.label,
            recommendation: opts.recommendation,
            docsUrl
          });
          continue;
        }
        for (const _ of bad) {
          out.push({
            id: opts.id,
            category: 'performance',
            severity: opts.severity,
            detection: { presence: 'none', value: 'absent' },
            route: head.route,
            location: head.file,
            message: `Missing ${opts.label}`,
            recommendation: opts.recommendation,
            docsUrl,
            ...(opts.fix ? { fix: { ...opts.fix } } : {})
          });
        }
      }
      return out;
    }
  };
}
```

- [ ] **Step 4: Create the two rules**

Create `packages/core/src/rules/perf/resource-hints.ts`:

```ts
import { linkRule } from './link-rule.js';

export const perf003PreloadAs = linkRule({
  id: 'PERF003',
  title: 'Preload missing as',
  severity: 'warning',
  label: '`as` on a preloaded `<link>`',
  recommendation:
    'Add an `as` attribute to every `<link rel="preload">` so the browser knows the resource type and can prioritize it.',
  rationale:
    'A `<link rel="preload">` without an `as` attribute is ignored by the browser (or fetched a second time), wasting the preload.',
  fix: {
    description: 'Add an `as` attribute matching the resource type to the preload link.',
    snippet: '<link rel="preload" href="/app.css" as="style" />',
    lang: 'html'
  },
  relevant: (t) => t.rel === 'preload',
  ok: (t) => t.hasAs === true
});

export const perf004FontPreloadCrossorigin = linkRule({
  id: 'PERF004',
  title: 'Font preload missing crossorigin',
  severity: 'warning',
  label: '`crossorigin` on a font preload',
  recommendation:
    'Add `crossorigin` to `<link rel="preload" as="font">` — fonts are fetched in CORS mode, so without it the preload fetches a second, unused copy.',
  rationale:
    'A font preload without `crossorigin` does not match the actual (CORS) font request, so the preloaded file is never used and the font downloads twice.',
  fix: {
    description: 'Add the `crossorigin` attribute to the font preload link.',
    snippet: '<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin />',
    lang: 'html'
  },
  relevant: (t) => t.rel === 'preload' && t.as === 'font',
  ok: (t) => t.hasCrossorigin === true
});
```

- [ ] **Step 5: Register + export the rules**

In `packages/core/src/rules/index.ts`:

- Add the import (after the `perf001ImageDimensions, perf002ImageLoading` import line):

```ts
import { perf003PreloadAs, perf004FontPreloadCrossorigin } from './perf/resource-hints.js';
```

- Add both to the `allRules` array (after `perf002ImageLoading`):

```ts
(perf002ImageLoading, perf003PreloadAs, perf004FontPreloadCrossorigin);
```

- Add both to the re-export block (after `perf002ImageLoading`):

```ts
(perf002ImageLoading, perf003PreloadAs, perf004FontPreloadCrossorigin);
```

In `packages/core/src/index.ts`, find the existing rules export (the line exporting `perf001ImageDimensions, perf002ImageLoading` from `./rules/index.js`) and add `perf003PreloadAs, perf004FontPreloadCrossorigin` to it. Also export the helper near the `imageRule` export:

```ts
export { linkRule } from './rules/perf/link-rule.js';
```

- [ ] **Step 6: Add the docs pages**

Create `docs/src/content/docs/rules/perf003.md`:

````md
---
title: PERF003 · Preload missing as
description: Every <link rel="preload"> should declare an as attribute.
---

**Severity:** warning

## What it checks

Every `<link rel="preload">` must have an `as` attribute naming the resource type (`style`, `script`, `font`, `image`, …). A preload without `as` is flagged.

## Why it matters

A `<link rel="preload">` without an `as` attribute is ignored by the browser (or fetched a second time), wasting the preload.

## How to fix

Add an `as` attribute matching the resource type:

```html
<link rel="preload" href="/app.css" as="style" />
```
````

````

Create `docs/src/content/docs/rules/perf004.md`:

```md
---
title: PERF004 · Font preload missing crossorigin
description: A font preload must set crossorigin so the preloaded file is actually used.
---

**Severity:** warning

## What it checks

Every `<link rel="preload" as="font">` must include the `crossorigin` attribute. A font preload without it is flagged.

## Why it matters

A font preload without `crossorigin` does not match the actual (CORS) font request, so the preloaded file is never used and the font downloads twice.

## How to fix

Add `crossorigin` to the font preload:

```html
<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin />
````

````

Create `docs/src/content/docs/ja/rules/perf003.md`:

```md
---
title: PERF003 · preload に as がない
description: すべての <link rel="preload"> は as 属性を指定すべきです。
---

**重大度:** warning

## チェック内容

すべての `<link rel="preload">` は、リソース種別を示す `as` 属性（`style`・`script`・`font`・`image` など）を持つ必要があります。`as` のない preload は検出されます。

## なぜ重要か

`as` 属性のない `<link rel="preload">` はブラウザに無視される（または二重にフェッチされる）ため、preload が無駄になります。

## 修正方法

リソース種別に合った `as` 属性を追加します：

```html
<link rel="preload" href="/app.css" as="style" />
````

````

Create `docs/src/content/docs/ja/rules/perf004.md`:

```md
---
title: PERF004 · フォント preload に crossorigin がない
description: フォントの preload は crossorigin を指定しないと使われません。
---

**重大度:** warning

## チェック内容

すべての `<link rel="preload" as="font">` は `crossorigin` 属性を含む必要があります。これがないフォント preload は検出されます。

## なぜ重要か

`crossorigin` のないフォント preload は実際の（CORS）フォントリクエストと一致しないため、preload したファイルは使われず、フォントが二重にダウンロードされます。

## 修正方法

フォントの preload に `crossorigin` を追加します：

```html
<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin />
````

````

- [ ] **Step 7: Run the rule test + docs-link integrity + full suites**

Run: `cd packages/core && pnpm vitest run test/perf-resource-hints.test.ts`
Expected: PASS.

Then the **full** core + cli + vite suites (adding rules to `allRules` can break rule-count / rule-list assertions — e.g. MCP/explain-rule tests, scoring snapshots, the docs-links integrity test):
Run: `cd /Users/oe.kazuma/localRepo/oss/svelte-vitals && CI=true pnpm --filter @svelte-vitals/core --filter svelte-vitals --filter @svelte-vitals/vite --filter @svelte-vitals/mcp test`
Expected: PASS. If any test asserts a fixed rule count or enumerates rule ids (search: `grep -rn "allRules\|PERF002\|toHaveLength" packages/*/test | grep -iE "length|count|perf"`), update it to include PERF003/PERF004. The docs-links test passes because the four pages were added in Step 6.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/perf/link-rule.ts packages/core/src/rules/perf/resource-hints.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/perf-resource-hints.test.ts docs/src/content/docs/rules/perf003.md docs/src/content/docs/rules/perf004.md docs/src/content/docs/ja/rules/perf003.md docs/src/content/docs/ja/rules/perf004.md
git commit -m "feat(core): add PERF003/PERF004 resource-hint rules + docs"
````

---

### Task 3: Changeset + full verification

**Files:**

- Create: `.changeset/perf-resource-hints.md`

**Interfaces:** none (release).

- [ ] **Step 1: Add the changeset**

Create `.changeset/perf-resource-hints.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add two static resource-hint Performance checks: PERF003 flags a `<link rel="preload">`
with no `as` attribute (the browser ignores or double-fetches it), and PERF004 flags a
`<link rel="preload" as="font">` with no `crossorigin` (the font preload is wasted and the
file downloads twice). Both surface in the CLI, the static report, and the vite plugin /
dev UI. Static mode evaluates hints in `<svelte:head>`; resource hints in `app.html` are
covered in plugin/rendered mode.
```

- [ ] **Step 2: Full verification**

Run from the repo root:

```bash
CI=true pnpm -r typecheck && CI=true pnpm -r test && pnpm build && CI=true pnpm --filter docs build && pnpm lint && pnpm check:publish
```

Expected: all green. (Run `pnpm format` first if prettier flags the new Markdown; re-run lint. `attw` inside `check:publish` may fail LOCALLY only — known pre-existing local-cache issue, CI-unaffected; if only attw/npm-pack fails and publint passes, treat it as the known issue.) Confirm `pnpm --filter docs build` succeeds with the four new rule pages.

- [ ] **Step 3: Commit**

```bash
git add .changeset/perf-resource-hints.md
git commit -m "chore: changeset for PERF003/PERF004 (core + cli + vite minor)"
```

---

## Self-Review

**Spec coverage:**

- PERF003 (preload missing `as`, warning, route-scoped) → Task 2. ✅
- PERF004 (font preload missing `crossorigin`, warning, route-scoped) → Task 2. ✅
- HeadTag `as` / `hasCrossorigin` (+ `hasAs` to distinguish dynamic-present from absent) → Task 1. ✅
- Both providers populate the fields; dynamic binding counts as present → Task 1 (CLI uses `findAttr` for presence + `attrText` for literal; vite reads getAttribute/hasAttribute). ✅
- Scoring mirrors imageRule (no-signal / pass-seeds / fail-with-fix) → Task 2 `linkRule`. ✅
- No false negatives — decide on presence + `as` keyword only → Task 2 (`ok` reads `hasAs`/`hasCrossorigin`; `relevant` reads `rel`/`as`). ✅
- Static-mode multi-preload limitation documented → spec + Global Constraints (rules unaffected). ✅
- Docs pages PERF003/004 en + ja → Task 2 Step 6 (required by the docs-links integrity test). ✅
- core + cli + vite minor changeset → Task 3. ✅

**Placeholder scan:** No "TBD"/"add error handling"/"similar to". Every code step has complete code. The CLI parse-test import is hedged with an exact grep to locate the existing parse test; the create-file fallback is concrete.

**Type consistency:** `HeadTag.as?: string` / `hasAs?: boolean` / `hasCrossorigin?: boolean` (Task 1) are read by `linkRule`'s `relevant`/`ok` and the two rules (Task 2). `linkRule(opts): Rule` with `relevant`/`ok: (tag: HeadTag) => boolean` matches both rule definitions. Result shape (`detection: {presence,value}`, `category:'performance'`, `route`, `message`, `recommendation`, `docsUrl`, optional `fix`) mirrors `imageRule` exactly. Rule ids `'PERF003'`/`'PERF004'` match the docs slugs `perf003`/`perf004` (lowercased by `docsUrlFor`) and the four created pages. `defineConfig` imported from `../src/types.js` in the test (matches its export site).

**Note on the dynamic-`as` representation:** the spec says a dynamic `as` "counts as present"; this plan implements that precisely with `hasAs` (presence, incl. dynamic) separate from `as` (literal keyword only). PERF003 checks `hasAs`; PERF004 checks `as === 'font'`. So `as={x}` → `hasAs:true`, `as:undefined` → neither rule fires. This is a faithful refinement of the spec's stated behavior.
