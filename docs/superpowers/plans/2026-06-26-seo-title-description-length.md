# SEO Phase B — title / description length (SEO022, SEO023) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two route-scoped, `info`-severity SEO rules that flag a static `<title>` outside 30–60 chars (SEO022) and a static `<meta name="description">` outside 70–160 chars (SEO023).

**Architecture:** Capture the literal visible text of a static title/description onto `HeadTag.text` (mirroring `HeadTag.jsonld`), measure it with a pure `visibleLength()` helper, and evaluate it with a small `lengthRule` factory. Presence/emptiness stays owned by SEO001/SEO002; the length rules emit nothing when the value is dynamic or absent.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces (`@svelte-vitals/core`, `@svelte-vitals/cli`, `@svelte-vitals/vite`), Astro Starlight docs, Changesets.

## Global Constraints

- Core engine stays dependency-free: `visibleLength` uses only JS built-ins (no `node:`, no new deps).
- Capture only the literal text of **static** title/description; dynamic (`{...}`) → leave `text` undefined (consistent with `jsonld`).
- `<title>` (RCDATA) and `content="…"` (attribute) have entities **decoded** by the browser; count the **decoded** visible text. (This differs from JSON-LD's raw-text capture.)
- Both rules: `category: 'seo'`, `severity: 'info'`, `scope: 'route'`.
- Thresholds verbatim: title `{ min: 30, max: 60 }`, description `{ min: 70, max: 160 }`.
- Spec: `docs/superpowers/specs/2026-06-26-seo-title-description-length-design.md`.
- Branch: `feat/seo-title-description-length` (already created, spec already committed).
- Run commands from the repo root unless noted.

---

## File Structure

- Create: `packages/core/src/rules/seo/text-metrics.ts` — `visibleLength()`.
- Create: `packages/core/test/text-metrics.test.ts` — its unit tests.
- Modify: `packages/core/src/head.ts` — add `text?: string` to `HeadTag`.
- Modify: `packages/cli/src/providers/source/parse.ts` — capture title + description text (static).
- Modify: `packages/cli/test/parse-jsonld.test.ts` is unrelated; create `packages/cli/test/parse-length.test.ts`.
- Modify: `packages/vite/src/providers/rendered/parse-html.ts` — capture title + description text.
- Modify: `packages/vite/test/parse-html.test.ts` — capture assertions.
- Create: `packages/core/src/rules/seo/seo022-023.ts` — the two rules.
- Create: `packages/core/test/seo-length-rules.test.ts` — rule tests.
- Modify: `packages/core/src/rules/index.ts` + `packages/core/src/index.ts` — register/export.
- Create: 4 docs pages (`docs/src/content/docs/rules/seo022.md`, `seo023.md`, and `ja/` equivalents).
- Create: `.changeset/seo-title-description-length.md`.

---

### Task 1: `visibleLength` helper

**Files:**

- Create: `packages/core/src/rules/seo/text-metrics.ts`
- Test: `packages/core/test/text-metrics.test.ts`

**Interfaces:**

- Produces: `export function visibleLength(s: string): number`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/text-metrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { visibleLength } from '../src/rules/seo/text-metrics.js';

describe('visibleLength', () => {
  it('counts trimmed, whitespace-collapsed code points', () => {
    expect(visibleLength('Hello')).toBe(5);
    expect(visibleLength('  Hello  ')).toBe(5); // trimmed
    expect(visibleLength('a\n\t  b   c')).toBe(5); // "a b c" → 5
    expect(visibleLength('')).toBe(0);
    expect(visibleLength('   ')).toBe(0);
  });
  it('counts an astral emoji as one character', () => {
    expect(visibleLength('hi 😀')).toBe(4); // h i space emoji
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test text-metrics`
Expected: FAIL — cannot resolve `../src/rules/seo/text-metrics.js`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/rules/seo/text-metrics.ts`:

```ts
// Pure text measurement for SEO length rules. No node:, no deps.

/** Visible character count as a SERP would show it: trimmed, internal whitespace runs collapsed, counted by code point. */
export function visibleLength(s: string): number {
  const collapsed = s.trim().replace(/\s+/g, ' ');
  return [...collapsed].length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core test text-metrics`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rules/seo/text-metrics.ts packages/core/test/text-metrics.test.ts
git commit -m "feat(core): add visibleLength text-metrics helper"
```

---

### Task 2: Capture title/description text in static (CLI) mode

**Files:**

- Modify: `packages/core/src/head.ts` (add field after the `jsonld?` line, ~line 27)
- Modify: `packages/cli/src/providers/source/parse.ts` (title branch ~line 117-119, meta branch ~line 123-134)
- Test: `packages/cli/test/parse-length.test.ts` (create)

**Interfaces:**

- Produces: `HeadTag.text?: string`; `parseHeadTags` now sets `text` on static title and `meta[name=description]` tags.
- Consumes: existing `textFromNodes(nodes)` and `attrText(attributes, name)` in `parse.ts`.

- [ ] **Step 1: Add the `text` field to `HeadTag`**

In `packages/core/src/head.ts`, immediately after the `jsonld?: string;` line (line 27), add:

```ts
  /** Literal visible text of a static <title> or <meta name="description"> content, set only when static. Undefined when dynamic. */
  text?: string;
```

- [ ] **Step 2: Write the failing test**

Create `packages/cli/test/parse-length.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseHeadTags } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;
const find = (src: string, kind: 'title' | 'meta') => parseHeadTags(src, 'x.svelte').find((t) => t.kind === kind)!;

describe('parse: title/description text capture (static)', () => {
  it('captures static title text', () => {
    expect(find(head('<title>About Us</title>'), 'title').text).toBe('About Us');
  });
  it('leaves title text undefined when dynamic', () => {
    expect(find(head('<title>{data.title}</title>'), 'title').text).toBeUndefined();
  });
  it('captures static description content', () => {
    const t = find(head('<meta name="description" content="A concise summary." />'), 'meta');
    expect(t.text).toBe('A concise summary.');
  });
  it('leaves description text undefined when content is dynamic', () => {
    const t = find(head('<meta name="description" content={desc} />'), 'meta');
    expect(t.text).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter svelte-vitals test parse-length`
Expected: FAIL — `text` is `undefined` for the static cases (capture not wired yet).

- [ ] **Step 4: Implement title capture**

In `packages/cli/src/providers/source/parse.ts`, replace the title branch (currently lines 117-120):

```ts
if (node?.type === 'TitleElement') {
  tags.push({ kind: 'title', value: valueFromNodes(node.fragment?.nodes ?? []) });
  continue;
}
```

with:

```ts
if (node?.type === 'TitleElement') {
  const titleNodes = node.fragment?.nodes ?? [];
  const text = textFromNodes(titleNodes);
  tags.push({ kind: 'title', value: valueFromNodes(titleNodes), ...(text !== undefined ? { text } : {}) });
  continue;
}
```

- [ ] **Step 5: Implement description capture**

In the same file, replace the `meta` branch (currently lines 123-134):

```ts
    if (node.name === 'meta') {
      const name = attrText(node.attributes, 'name');
      const property = attrText(node.attributes, 'property');
      const content = name === 'robots' ? attrText(node.attributes, 'content') : undefined;
      const noindex = content !== undefined && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
      tags.push({
        kind: 'meta',
        ...(name ? { name } : {}),
        ...(property ? { property } : {}),
        value: attrValue(node.attributes, 'content'),
        ...(noindex ? { noindex: true } : {})
      });
    } else if (node.name === 'link') {
```

with (adds `descText` and spreads `text`):

```ts
    if (node.name === 'meta') {
      const name = attrText(node.attributes, 'name');
      const property = attrText(node.attributes, 'property');
      const content = name === 'robots' ? attrText(node.attributes, 'content') : undefined;
      const noindex = content !== undefined && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
      const contentValue = attrValue(node.attributes, 'content');
      // Only capture description text when content is static — a quoted dynamic value
      // (content="{desc}") must stay dynamic, else SEO023 false-positives on it.
      const descText =
        name === 'description' && contentValue === 'static' ? attrText(node.attributes, 'content') : undefined;
      tags.push({
        kind: 'meta',
        ...(name ? { name } : {}),
        ...(property ? { property } : {}),
        value: contentValue,
        ...(noindex ? { noindex: true } : {}),
        ...(descText !== undefined ? { text: descText } : {})
      });
    } else if (node.name === 'link') {
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals test parse-length`
Expected: PASS (4 tests).
Run: `pnpm --filter @svelte-vitals/core typecheck && pnpm --filter svelte-vitals typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/head.ts packages/cli/src/providers/source/parse.ts packages/cli/test/parse-length.test.ts
git commit -m "feat(cli): capture static title/description text onto HeadTag.text"
```

---

### Task 3: Capture title/description text in rendered (vite) mode

**Files:**

- Modify: `packages/vite/src/providers/rendered/parse-html.ts` (title ~line 19-20, meta ~line 22-36)
- Test: `packages/vite/test/parse-html.test.ts` (add a describe block)

**Interfaces:**

- Consumes: `HeadTag.text` (added in Task 2), node-html-parser `title.text` and `meta.getAttribute('content')`.
- Produces: rendered title/description tags carry decoded `text`.

- [ ] **Step 1: Write the failing test**

In `packages/vite/test/parse-html.test.ts`, append a new describe block at the end of the file:

```ts
describe('parse-html: title/description text capture', () => {
  it('captures decoded title text (RCDATA entities decoded)', () => {
    const { tags } = parseHtmlHead(html('<title>Caf&eacute; &amp; Bar</title>'));
    expect(tags.find((t) => t.kind === 'title')!.text).toBe('Café & Bar');
  });
  it('captures description content text', () => {
    const { tags } = parseHtmlHead(html('<meta name="description" content="A concise summary."/>'));
    const desc = tags.find((t) => t.kind === 'meta' && t.name === 'description')!;
    expect(desc.text).toBe('A concise summary.');
  });
});
```

(The existing `html()` helper at the top of the file wraps the argument in `<head>…</head>`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @svelte-vitals/vite test parse-html`
Expected: FAIL — `text` is `undefined` (capture not wired yet).

- [ ] **Step 3: Implement title capture**

In `packages/vite/src/providers/rendered/parse-html.ts`, replace the title line (currently lines 19-20):

```ts
const title = head.querySelector('title');
if (title) tags.push({ kind: 'title', presence: 'own', value: attrValue(title.text) });
```

with (note: `title.text` is the decoded RCDATA — the visible text):

```ts
const title = head.querySelector('title');
if (title) {
  const text = title.text;
  tags.push({
    kind: 'title',
    presence: 'own',
    value: attrValue(text),
    ...(text && text.trim().length > 0 ? { text } : {})
  });
}
```

- [ ] **Step 4: Implement description capture**

In the same file, replace the meta loop body (currently lines 22-36):

```ts
for (const meta of head.querySelectorAll('meta')) {
  const name = meta.getAttribute('name');
  const property = meta.getAttribute('property');
  if (!name && !property) continue;
  const content = name === 'robots' ? meta.getAttribute('content') : null;
  const noindex = content != null && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
  tags.push({
    kind: 'meta',
    ...(name ? { name } : {}),
    ...(property ? { property } : {}),
    presence: 'own',
    value: attrValue(meta.getAttribute('content')),
    ...(noindex ? { noindex: true } : {})
  });
}
```

with (adds `descText`):

```ts
for (const meta of head.querySelectorAll('meta')) {
  const name = meta.getAttribute('name');
  const property = meta.getAttribute('property');
  if (!name && !property) continue;
  const content = name === 'robots' ? meta.getAttribute('content') : null;
  const noindex = content != null && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
  const descText = name === 'description' ? meta.getAttribute('content') : null;
  tags.push({
    kind: 'meta',
    ...(name ? { name } : {}),
    ...(property ? { property } : {}),
    presence: 'own',
    value: attrValue(meta.getAttribute('content')),
    ...(noindex ? { noindex: true } : {}),
    ...(descText && descText.trim().length > 0 ? { text: descText } : {})
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/vite test parse-html`
Expected: PASS (existing + 2 new).
Run: `pnpm --filter @svelte-vitals/vite typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/vite/src/providers/rendered/parse-html.ts packages/vite/test/parse-html.test.ts
git commit -m "feat(vite): capture decoded title/description text in rendered mode"
```

---

### Task 4: SEO022 / SEO023 rules + registration

**Files:**

- Create: `packages/core/src/rules/seo/seo022-023.ts`
- Modify: `packages/core/src/rules/index.ts` (import, `allRules`, re-export)
- Modify: `packages/core/src/index.ts` (re-export)
- Test: `packages/core/test/seo-length-rules.test.ts` (create)

**Interfaces:**

- Consumes: `visibleLength` (Task 1), `HeadTag.text` (Task 2), `Rule`/`RuleContext` from `../../rule.js`, `Result` from `../../types.js`, `docsUrlFor` from `../../rule.js`.
- Produces: `export const seo022TitleLength: Rule`, `export const seo023DescriptionLength: Rule`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/seo-length-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { seo022TitleLength, seo023DescriptionLength } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { RuleContext } from '../src/rule.js';

const headWith = (tag: Partial<HeadTag> & Pick<HeadTag, 'kind'>): ResolvedHead => ({
  route: '/x',
  source: 'rendered',
  file: 'x',
  tags: [{ presence: 'own', value: 'static', ...tag } as HeadTag]
});
const ctx = (head: ResolvedHead): RuleContext => ({ heads: [head], project: defaultProject, config: defineConfig({}) });
const fails = (rs: Awaited<ReturnType<typeof seo022TitleLength.check>>) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

const title = (text?: string) => headWith({ kind: 'title', ...(text !== undefined ? { text } : {}) });
const desc = (text?: string) =>
  headWith({ kind: 'meta', name: 'description', ...(text !== undefined ? { text } : {}) });

describe('SEO022 title length', () => {
  it('flags a too-short title', async () => {
    expect(fails(await seo022TitleLength.check(ctx(title('Home'))))).toHaveLength(1);
  });
  it('flags a too-long title', async () => {
    expect(fails(await seo022TitleLength.check(ctx(title('x'.repeat(61)))))).toHaveLength(1);
  });
  it('passes an in-range title', async () => {
    const rs = await seo022TitleLength.check(ctx(title('A perfectly reasonable page title here')));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a dynamic/absent title', async () => {
    expect(await seo022TitleLength.check(ctx(title(undefined)))).toHaveLength(0);
  });
});

describe('SEO023 description length', () => {
  it('flags a too-short description', async () => {
    expect(fails(await seo023DescriptionLength.check(ctx(desc('Too short.'))))).toHaveLength(1);
  });
  it('flags a too-long description', async () => {
    expect(fails(await seo023DescriptionLength.check(ctx(desc('x'.repeat(161)))))).toHaveLength(1);
  });
  it('passes an in-range description', async () => {
    const rs = await seo023DescriptionLength.check(ctx(desc('x'.repeat(100))));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a dynamic/absent description', async () => {
    expect(await seo023DescriptionLength.check(ctx(desc(undefined)))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test seo-length-rules`
Expected: FAIL — `seo022TitleLength` / `seo023DescriptionLength` are not exported.

- [ ] **Step 3: Write the rules**

Create `packages/core/src/rules/seo/seo022-023.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import { visibleLength } from './text-metrics.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

interface LengthRuleOptions {
  id: string;
  title: string;
  label: string;
  noun: string;
  match: (t: HeadTag) => boolean;
  min: number;
  max: number;
  recommendation: string;
  rationale: string;
}

/** Build a route-scoped length rule that runs only on a static (captured) title/description text. */
function lengthRule(opts: LengthRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'seo',
    severity: 'info',
    scope: 'route',
    rationale: opts.rationale,
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const head of ctx.heads) {
        const tag = head.tags.find(opts.match);
        // No tag, or dynamic/absent text → presence is SEO001/SEO002's concern, emit nothing.
        if (!tag || typeof tag.text !== 'string') continue;
        const len = visibleLength(tag.text);
        let problem: string | undefined;
        if (len < opts.min) problem = `${opts.noun} is too short (${len} chars; aim for ${opts.min}–${opts.max})`;
        else if (len > opts.max) problem = `${opts.noun} is too long (${len} chars; aim for ${opts.min}–${opts.max})`;
        out.push(
          problem
            ? {
                id: opts.id,
                category: 'seo',
                severity: 'info',
                detection: PENALIZED,
                route: head.route,
                location: head.file,
                message: problem,
                recommendation: opts.recommendation,
                docsUrl
              }
            : {
                id: opts.id,
                category: 'seo',
                severity: 'info',
                detection: PASS,
                route: head.route,
                message: opts.label,
                recommendation: opts.recommendation,
                docsUrl
              }
        );
      }
      return out;
    }
  };
}

export const seo022TitleLength = lengthRule({
  id: 'SEO022',
  title: 'Title length',
  label: 'Title length',
  noun: 'Title',
  match: (t) => t.kind === 'title',
  min: 30,
  max: 60,
  recommendation: 'Aim for a title of 30–60 characters so it is not truncated in search results.',
  rationale:
    'A title that is too short wastes the strongest on-page signal; one that is too long is truncated in the SERP.'
});

export const seo023DescriptionLength = lengthRule({
  id: 'SEO023',
  title: 'Description length',
  label: 'Description length',
  noun: 'Description',
  match: (t) => t.kind === 'meta' && t.name === 'description',
  min: 70,
  max: 160,
  recommendation: 'Aim for a meta description of 70–160 characters so it is not truncated in search results.',
  rationale:
    'A description that is too short under-uses the SERP snippet; one that is too long is truncated by search engines.'
});
```

- [ ] **Step 4: Register the rules**

In `packages/core/src/rules/index.ts`, add the import after the `seo016-021` import block:

```ts
import { seo022TitleLength, seo023DescriptionLength } from './seo/seo022-023.js';
```

In the same file, add to the END of the `allRules` array (after `seo021RequiredProps`):

```ts
  seo021RequiredProps,
  seo022TitleLength,
  seo023DescriptionLength
];
```

(Replace the existing closing `  seo021RequiredProps\n];` with the three lines above.)

And add to the END of the re-export `export { … }` block (after `seo021RequiredProps`):

```ts
  seo021RequiredProps,
  seo022TitleLength,
  seo023DescriptionLength
};
```

- [ ] **Step 5: Re-export from the package entry**

In `packages/core/src/index.ts`, in the `export { … } from './rules/index.js'` block, add after `seo021RequiredProps`:

```ts
  seo021RequiredProps,
  seo022TitleLength,
  seo023DescriptionLength
} from './rules/index.js';
```

(Replace the existing `  seo021RequiredProps\n} from './rules/index.js';`.)

- [ ] **Step 6: Run tests + typecheck to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test seo-length-rules`
Expected: PASS (8 tests).
Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/rules/seo/seo022-023.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/seo-length-rules.test.ts
git commit -m "feat(core): add SEO022/SEO023 title & description length rules"
```

---

### Task 5: Docs pages + changeset

**Files:**

- Create: `docs/src/content/docs/rules/seo022.md`, `docs/src/content/docs/rules/seo023.md`
- Create: `docs/src/content/docs/ja/rules/seo022.md`, `docs/src/content/docs/ja/rules/seo023.md`
- Create: `.changeset/seo-title-description-length.md`

**Interfaces:** none (content + release metadata).

- [ ] **Step 1: Write the English docs**

Create `docs/src/content/docs/rules/seo022.md`:

````md
---
title: SEO022 · Title length
description: The document title should be 30–60 characters.
---

**Severity:** info

## What it checks

Flags a static `<title>` whose visible text is shorter than 30 or longer than 60 characters. Whitespace is trimmed and collapsed before counting; dynamic titles are not checked.

## Why it matters

A title that is too short wastes the strongest on-page SEO signal; one that is too long is truncated in search results, hiding the end of your headline.

## How to fix

```svelte
<svelte:head>
  <title>Concise, descriptive page title (30–60 chars)</title>
</svelte:head>
```
````

Create `docs/src/content/docs/rules/seo023.md`:

````md
---
title: SEO023 · Description length
description: The meta description should be 70–160 characters.
---

**Severity:** info

## What it checks

Flags a static `<meta name="description">` whose content is shorter than 70 or longer than 160 characters. Whitespace is trimmed and collapsed before counting; dynamic descriptions are not checked.

## Why it matters

A description that is too short under-uses the search snippet; one that is too long is truncated by search engines, cutting off your call to action.

## How to fix

```svelte
<svelte:head>
  <meta name="description" content="A concise, compelling summary of the page in roughly 70–160 characters." />
</svelte:head>
```
````

- [ ] **Step 2: Write the Japanese docs**

Create `docs/src/content/docs/ja/rules/seo022.md`:

````md
---
title: SEO022 · タイトルの長さ
description: ドキュメントのタイトルは 30〜60 文字であるべきです。
---

**重大度:** info

## チェック内容

静的な `<title>` の表示テキストが 30 文字未満、または 60 文字超のものを検出します。カウント前に空白はトリム・圧縮されます。動的なタイトルは検査しません。

## なぜ重要か

タイトルが短すぎると最も強力なオンページ SEO シグナルを無駄にし、長すぎると検索結果で切り詰められて見出しの末尾が隠れます。

## 修正方法

```svelte
<svelte:head>
  <title>簡潔で説明的なページタイトル（30〜60 文字）</title>
</svelte:head>
```
````

Create `docs/src/content/docs/ja/rules/seo023.md`:

````md
---
title: SEO023 · 説明文の長さ
description: meta description は 70〜160 文字であるべきです。
---

**重大度:** info

## チェック内容

静的な `<meta name="description">` の内容が 70 文字未満、または 160 文字超のものを検出します。カウント前に空白はトリム・圧縮されます。動的な説明文は検査しません。

## なぜ重要か

説明文が短すぎると検索スニペットを活かしきれず、長すぎると検索エンジンに切り詰められて行動喚起が途切れます。

## 修正方法

```svelte
<svelte:head>
  <meta name="description" content="ページ内容を簡潔に伝える、およそ 70〜160 文字の説明文。" />
</svelte:head>
```
````

- [ ] **Step 3: Write the changeset**

Create `.changeset/seo-title-description-length.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add SEO022 (title length, 30–60 chars) and SEO023 (meta description length,
70–160 chars). Both check only static text — the literal title/description is now
captured onto the head model — and flag both too-short and too-long values; a
dynamic title/description is skipped (presence stays owned by SEO001/SEO002).
```

- [ ] **Step 4: Verify docs build**

Run: `pnpm --filter docs build`
Expected: build succeeds and includes the 4 new rule pages (no broken-link or missing-page errors).

- [ ] **Step 5: Commit**

```bash
git add docs/src/content/docs/rules/seo022.md docs/src/content/docs/rules/seo023.md docs/src/content/docs/ja/rules/seo022.md docs/src/content/docs/ja/rules/seo023.md .changeset/seo-title-description-length.md
git commit -m "docs: SEO022/SEO023 reference pages (en+ja) + changeset"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole suite, typecheck, and lint**

Run:

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint && pnpm --filter docs build
```

Expected: all green. Core test count rises by 10 (`text-metrics` 2 + `seo-length-rules` 8); cli by 4; vite by 2.

- [ ] **Step 2: If lint reports formatting, fix and re-run**

Run: `pnpm exec prettier --write . && pnpm lint`
Expected: "All matched files use Prettier code style!" and eslint clean.

- [ ] **Step 3: Final commit (only if Step 2 changed files)**

```bash
git add -A
git commit -m "chore: format SEO022/SEO023 changes"
```

---

## Self-Review

**Spec coverage:**

- Capture model `HeadTag.text` → Task 2 Step 1. ✓
- Entity decoding (title RCDATA, content attr) → Task 3 Steps 3-4 (uses `.text` / `getAttribute`), asserted in Task 3 Step 1. ✓
- `visibleLength` (trim, collapse, code points) → Task 1. ✓
- `lengthRule` factory + thresholds + no-signal-on-dynamic → Task 4. ✓
- Registration + MCP surface (via `allRules`) → Task 4 Steps 4-5. ✓
- Docs 4 pages + changeset (core/cli/vite/mcp minor) → Task 5. ✓
- Testing matrix (short/in-range/long/dynamic/absent × title/desc, capture, visibleLength) → Tasks 1-4. ✓
- Out of scope (uniqueness, pixel width, config) → not planned. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `visibleLength(s: string): number` used identically in Task 1 and Task 4. `HeadTag.text?: string` added in Task 2, consumed in Tasks 3-4. Rule names `seo022TitleLength` / `seo023DescriptionLength` consistent across Tasks 4-5 and tests. `match`/`noun`/`min`/`max`/`label` match the `LengthRuleOptions` interface. ✓
