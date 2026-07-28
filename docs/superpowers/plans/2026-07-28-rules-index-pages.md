# Rule index pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generated landing pages at `/rules` and `/rules/<category>` (en + ja) that list every rule with its severity and one-line summary.

**Architecture:** A pure rendering module (`packages/cli/scripts/rules-index.mjs`) turns `allRules` plus each locale's rule-page frontmatter into markdown blocks. An entry script writes those blocks into the region between `<!-- rules-index:start -->` / `<!-- rules-index:end -->` markers in twelve hand-written content files. A vitest guard test re-renders the blocks and compares them to what is committed, so a new rule cannot land without regenerating the indexes.

**Tech Stack:** Node ESM scripts (`.mjs`), vitest, Blume (Astro) docs site, oxlint + oxfmt.

**Spec:** `docs/superpowers/specs/2026-07-28-rules-index-pages-design.md`

## Global Constraints

- **Preflight (run once before Task 1):** `pnpm install`, then `pnpm build`. The generator and the guard test import `allRules` / `CATEGORIES` from `@svelte-vitals/core`, which resolves to `packages/core/dist`.
- **Generator code and its tests are `.mjs`, not `.ts`.** `packages/cli/tsconfig.json` has `include: ["src", "test"]` and the base config does not set `allowJs`, so a `.ts` test importing `../scripts/rules-index.mjs` would fail `pnpm typecheck`. `.mjs` files are outside `tsc`'s file selection and vitest's default include pattern (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) already matches `*.test.mjs`.
- **oxfmt reformats `.md` and `.mdx`.** It pads table cells to equal width and re-wraps prose at `printWidth: 120`. The generator therefore emits unpadded tables and unwrapped prose, and `pnpm format` is run after every generation. Never compare generated and committed blocks byte-for-byte — always through `normalizeBlock`.
- **No hard-coded rule counts or ID ranges in hand-written prose** (AGENTS.md). Counts appear only inside the generated block, where they are computed from `allRules`.
- **en/ja stay in sync.** Every content file added under `docs/src/content/docs/` has a counterpart under `docs/src/content/docs/ja/` in the same commit.
- **Category order is core's `CATEGORIES`:** `seo`, `performance`, `correctness`, `security`, `architecture`. Never re-declare this list locally; import it.
- **Rule rows sort by rule id**, ascending, using plain `<` string comparison (not `localeCompare`, which is locale-sensitive and non-deterministic across environments).
- **Docs-only change — no changeset.**

## File Structure

| File                                                             | Responsibility                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/cli/scripts/rules-index.mjs`                           | Create. Pure rendering + parsing. No file writes, no core import — everything is injected, so tests can call it with fixtures. |
| `packages/cli/scripts/gen-rules-index.mjs`                       | Create. Entry point: reads `allRules`/`CATEGORIES`, calls the renderer, rewrites the marker regions.                           |
| `packages/cli/package.json`                                      | Modify. Add the `gen:rules-index` script.                                                                                      |
| `packages/cli/test/rules-index-render.test.mjs`                  | Create. Unit tests for the renderer's parsing, escaping, sorting, and normalization.                                           |
| `packages/cli/test/rules-index.test.mjs`                         | Create. Guard test: committed index pages match the generator.                                                                 |
| `packages/cli/test/docs-links.test.ts`                           | Modify. Its stray-page check must skip `index.mdx` and `meta.ts`.                                                              |
| `docs/src/content/docs/rules/index.mdx` + 5 category `index.mdx` | Create. en landing pages: frontmatter + hand-written prose + marker region.                                                    |
| `docs/src/content/docs/ja/rules/…` (same 6)                      | Create. ja counterparts.                                                                                                       |
| `docs/src/content/docs/rules/<category>/meta.ts` ×5 + ja ×5      | Create. Sidebar label and order for each category group.                                                                       |
| `AGENTS.md`                                                      | Modify. Add the regeneration step to "Adding a rule"; fix the stale rule-filename convention.                                  |

---

### Task 1: Rendering module

**Files:**

- Create: `packages/cli/scripts/rules-index.mjs`
- Test: `packages/cli/test/rules-index-render.test.mjs`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces, all named exports of `packages/cli/scripts/rules-index.mjs`:
  - `START_MARKER: string`, `END_MARKER: string`
  - `LOCALES: readonly ['en', 'ja']`
  - `localeDir(docsRoot: string, locale: string): string`
  - `localeHref(locale: string, path: string): string`
  - `parseFrontmatter(text: string): Record<string, string>`
  - `escapeMdx(text: string): string`
  - `escapeCell(text: string): string`
  - `readSummaries(docsRoot: string, locale: string, rules: Rule[]): Map<string, string>`
  - `renderTable(locale: string, rules: Rule[], summaries: Map<string, string>): string`
  - `renderCategoryPage(locale, category, rules, summaries): string`
  - `renderRulesPage(locale, categories, rules, summaries): string`
  - `renderAll(docsRoot: string, categories: string[], rules: Rule[]): Map<string, string>` — absolute file path → block text
  - `replaceBlock(fileText: string, block: string): string`
  - `extractBlock(fileText: string): string`
  - `normalizeBlock(block: string): string`
  - `parseRuleIds(block: string): string[]`

  `Rule` here means any object with `{ id, category, severity }` — the renderer never touches the rest of a core `Rule`.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/rules-index-render.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import {
  END_MARKER,
  START_MARKER,
  escapeCell,
  escapeMdx,
  extractBlock,
  localeHref,
  normalizeBlock,
  parseFrontmatter,
  parseRuleIds,
  renderTable,
  replaceBlock
} from '../scripts/rules-index.mjs';

const RULES = [
  { id: 'seo/title-presence', category: 'seo', severity: 'critical' },
  { id: 'seo/charset', category: 'seo', severity: 'warning' }
];

const SUMMARIES = new Map([
  ['seo/title-presence', 'Every route should resolve a non-empty <title>.'],
  ['seo/charset', 'Declare {charset}, not a | pipe.']
]);

describe('parseFrontmatter', () => {
  it('reads an unquoted description', () => {
    const text = '---\ntitle: seo/charset · Character encoding\ndescription: Declare a charset.\n---\n\nBody.';
    expect(parseFrontmatter(text)).toEqual({
      title: 'seo/charset · Character encoding',
      description: 'Declare a charset.'
    });
  });

  it('unwraps a single-quoted description and unescapes doubled quotes', () => {
    const text = "---\ntitle: T\ndescription: 'Sanitize it — {@html} renders unescaped HTML. It''s unsafe.'\n---\n";
    expect(parseFrontmatter(text).description).toBe("Sanitize it — {@html} renders unescaped HTML. It's unsafe.");
  });

  it('throws when the file has no frontmatter', () => {
    expect(() => parseFrontmatter('# Just a heading\n')).toThrow(/frontmatter/);
  });
});

describe('escaping', () => {
  it('escapes MDX-significant characters', () => {
    expect(escapeMdx('a <title> and {expr}')).toBe('a &lt;title&gt; and &#123;expr&#125;');
  });

  it('also escapes table pipes in a cell', () => {
    expect(escapeCell('a | b')).toBe('a \\| b');
  });

  it('leaves plain text untouched', () => {
    expect(escapeMdx('Every route should have a canonical URL.')).toBe('Every route should have a canonical URL.');
  });
});

describe('localeHref', () => {
  it('uses a bare path for en', () => {
    expect(localeHref('en', 'seo/charset')).toBe('/rules/seo/charset');
  });

  it('prefixes the locale otherwise', () => {
    expect(localeHref('ja', 'seo/charset')).toBe('/ja/rules/seo/charset');
  });
});

describe('renderTable', () => {
  it('sorts rows by rule id and renders link, severity glyph, and escaped summary', () => {
    expect(renderTable('en', RULES, SUMMARIES)).toBe(
      [
        '| Rule | Severity | Summary |',
        '| --- | --- | --- |',
        '| [`seo/charset`](/rules/seo/charset) | 🟡 warning | Declare &#123;charset&#125;, not a \\| pipe. |',
        '| [`seo/title-presence`](/rules/seo/title-presence) | 🔴 critical | Every route should resolve a non-empty &lt;title&gt;. |'
      ].join('\n')
    );
  });

  it('uses the ja header labels and link prefix', () => {
    const lines = renderTable('ja', RULES, SUMMARIES).split('\n');
    expect(lines[0]).toBe('| ルール | 重大度 | 概要 |');
    expect(lines[2]).toContain('](/ja/rules/seo/charset)');
  });
});

describe('normalizeBlock', () => {
  it('ignores table padding and prose re-wrapping', () => {
    const generated = [
      'Intro sentence that oxfmt will wrap.',
      '',
      '| Rule | Severity |',
      '| --- | --- |',
      '| a | b |'
    ].join('\n');
    const formatted = [
      'Intro sentence that oxfmt',
      'will wrap.',
      '',
      '| Rule | Severity |',
      '| ---- | -------- |',
      '| a    | b        |'
    ].join('\n');
    expect(normalizeBlock(formatted)).toBe(normalizeBlock(generated));
  });

  it('still sees a changed cell', () => {
    expect(normalizeBlock('| a | b |')).not.toBe(normalizeBlock('| a | c |'));
  });
});

describe('parseRuleIds', () => {
  it('collects the rule ids linked from a block', () => {
    expect(parseRuleIds(renderTable('en', RULES, SUMMARIES))).toEqual(['seo/charset', 'seo/title-presence']);
  });
});

describe('replaceBlock / extractBlock', () => {
  const file = `---\ntitle: T\n---\n\nIntro.\n\n${START_MARKER}\n${END_MARKER}\n\nFooter.\n`;

  it('replaces only the marker region', () => {
    const out = replaceBlock(file, 'GENERATED');
    expect(out).toContain('Intro.');
    expect(out).toContain('Footer.');
    expect(out).toContain(`${START_MARKER}\n\nGENERATED\n\n${END_MARKER}`);
  });

  it('round-trips through extractBlock', () => {
    expect(extractBlock(replaceBlock(file, 'GENERATED'))).toBe('GENERATED');
  });

  it('throws when the markers are missing', () => {
    expect(() => replaceBlock('no markers here', 'GENERATED')).toThrow(/marker/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter svelte-vitals exec vitest run test/rules-index-render.test.mjs
```

Expected: FAIL — `Failed to load ../scripts/rules-index.mjs` (the module does not exist yet).

- [ ] **Step 3: Write the module**

Create `packages/cli/scripts/rules-index.mjs`:

```js
// Renders the generated blocks of the docs site's rule index pages.
// Pure: no core import, no writes — `gen-rules-index.mjs` injects the rules and does the I/O.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const START_MARKER = '<!-- rules-index:start -->';
export const END_MARKER = '<!-- rules-index:end -->';

export const LOCALES = ['en', 'ja'];

/** Same glyphs the console reporter and the CI job summary use. */
const SEVERITY_GLYPH = { critical: '🔴', warning: '🟡', info: '🔵' };

/** Category names stay English in both locales — they are the values the CLI reports. */
const CATEGORY_LABEL = {
  seo: 'SEO',
  performance: 'Performance',
  correctness: 'Correctness',
  security: 'Security',
  architecture: 'Architecture'
};

const CATEGORY_ICON = {
  seo: 'search',
  performance: 'zap',
  correctness: 'circle-check',
  security: 'shield',
  architecture: 'layers'
};

// The one place these blurbs live: core has no localized prose, and duplicating them
// across the top-level page and the five category pages would let the two drift.
const CATEGORY_BLURB = {
  en: {
    seo: 'Resolved <head> metadata, structured data, and crawlability — what search engines actually see.',
    performance: 'Images, render-blocking assets, imports, and load waterfalls — what makes a route slow.',
    correctness: 'Svelte 5 runes and lifecycle misuse — code that compiles but behaves wrong.',
    security: 'Unescaped HTML, unsafe URLs, and server state that leaks across requests.',
    architecture: 'Component size and prop surface — signals that a component is doing too much.'
  },
  ja: {
    seo: '解決後の <head> メタデータ、構造化データ、クロール可能性 — 検索エンジンが実際に見るもの。',
    performance: '画像、レンダリングを妨げるアセット、インポート、ロードのウォーターフォール — ルートを遅くする要因。',
    correctness: 'Svelte 5 の runes とライフサイクルの誤用 — コンパイルは通るのに挙動が間違っているコード。',
    security: 'エスケープされない HTML、安全でない URL、サーバー上でリクエストをまたいで漏れる状態。',
    architecture: 'コンポーネントの大きさと props の数 — 1 つのコンポーネントが抱えすぎているサイン。'
  }
};

const TABLE_HEADER = {
  en: ['Rule', 'Severity', 'Summary'],
  ja: ['ルール', '重大度', '概要']
};

const RULE_COUNT = {
  en: (n) => `(${n} rule${n === 1 ? '' : 's'})`,
  ja: (n) => `（${n} 件のルール）`
};

/** Content directory holding a locale's rule pages. */
export function localeDir(docsRoot, locale) {
  return locale === 'en' ? join(docsRoot, 'rules') : join(docsRoot, locale, 'rules');
}

/** Site-root-relative href for a rule id or a category slug. */
export function localeHref(locale, path) {
  return locale === 'en' ? `/rules/${path}` : `/${locale}/rules/${path}`;
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'"))
    return trimmed.slice(1, -1).replaceAll("''", "'");
  return trimmed;
}

/** Minimal YAML reader for the flat `key: value` frontmatter every rule page uses. */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) throw new Error('missing frontmatter');
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([a-zA-Z]+): (.*)$/.exec(line);
    if (field) fields[field[1]] = unquote(field[2]);
  }
  return fields;
}

/** `<` and `{` are JSX syntax in MDX; summaries contain both (`<title>`, `{#each}`). */
export function escapeMdx(text) {
  return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('{', '&#123;').replaceAll('}', '&#125;');
}

export function escapeCell(text) {
  return escapeMdx(text).replaceAll('|', '\\|');
}

/** Summary column: each locale's own rule page frontmatter, so ja stays Japanese. */
export function readSummaries(docsRoot, locale, rules) {
  const dir = localeDir(docsRoot, locale);
  const summaries = new Map();
  for (const rule of rules) {
    const file = join(dir, `${rule.id}.md`);
    const { description } = parseFrontmatter(readFileSync(file, 'utf8'));
    if (!description) throw new Error(`${file}: frontmatter has no description`);
    summaries.set(rule.id, description);
  }
  return summaries;
}

function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function renderTable(locale, rules, summaries) {
  const header = TABLE_HEADER[locale];
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const rule of [...rules].sort(byId)) {
    const severity = `${SEVERITY_GLYPH[rule.severity]} ${rule.severity}`;
    const summary = escapeCell(summaries.get(rule.id));
    lines.push(`| [\`${rule.id}\`](${localeHref(locale, rule.id)}) | ${severity} | ${summary} |`);
  }
  return lines.join('\n');
}

export function renderCategoryPage(locale, category, rules, summaries) {
  const inCategory = rules.filter((rule) => rule.category === category);
  return [escapeMdx(CATEGORY_BLURB[locale][category]), '', renderTable(locale, inCategory, summaries)].join('\n');
}

export function renderRulesPage(locale, categories, rules, summaries) {
  const lines = ['<CardGroup cols={2}>'];
  for (const category of categories) {
    const count = rules.filter((rule) => rule.category === category).length;
    lines.push(
      `  <Card title="${CATEGORY_LABEL[category]}" icon="${CATEGORY_ICON[category]}" href="${localeHref(locale, category)}">`,
      `    ${escapeMdx(CATEGORY_BLURB[locale][category])} ${RULE_COUNT[locale](count)}`,
      '  </Card>'
    );
  }
  lines.push('</CardGroup>');

  for (const category of categories) {
    const inCategory = rules.filter((rule) => rule.category === category);
    lines.push('', `## ${CATEGORY_LABEL[category]}`, '', renderTable(locale, inCategory, summaries));
  }
  return lines.join('\n');
}

/** Absolute file path → generated block, for every index page in every locale. */
export function renderAll(docsRoot, categories, rules) {
  const blocks = new Map();
  for (const locale of LOCALES) {
    const summaries = readSummaries(docsRoot, locale, rules);
    const dir = localeDir(docsRoot, locale);
    blocks.set(join(dir, 'index.mdx'), renderRulesPage(locale, categories, rules, summaries));
    for (const category of categories)
      blocks.set(join(dir, category, 'index.mdx'), renderCategoryPage(locale, category, rules, summaries));
  }
  return blocks;
}

function markerBounds(fileText) {
  const start = fileText.indexOf(START_MARKER);
  const end = fileText.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) throw new Error(`missing ${START_MARKER} / ${END_MARKER} marker pair`);
  return { start, end };
}

export function replaceBlock(fileText, block) {
  const { start, end } = markerBounds(fileText);
  return `${fileText.slice(0, start)}${START_MARKER}\n\n${block}\n\n${fileText.slice(end)}`;
}

export function extractBlock(fileText) {
  const { start, end } = markerBounds(fileText);
  return fileText.slice(start + START_MARKER.length, end).trim();
}

/**
 * Comparable form of a block. oxfmt pads table cells and re-wraps prose at printWidth,
 * so committed text never matches generated text byte-for-byte — compare through this.
 */
export function normalizeBlock(block) {
  const prose = [];
  const rows = [];
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('|')) {
      const cells = trimmed
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split(/(?<!\\)\|/)
        .map((cell) => cell.trim());
      if (cells.every((cell) => /^-+$/.test(cell))) continue; // alignment row
      rows.push(`|${cells.join('|')}|`);
    } else prose.push(trimmed);
  }
  return [prose.join(' ').replace(/\s+/g, ' '), ...rows].join('\n');
}

/** Rule ids linked from a block, in the order they appear. */
export function parseRuleIds(block) {
  return [...block.matchAll(/\[`([^`]+)`\]\(/g)].map((match) => match[1]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter svelte-vitals exec vitest run test/rules-index-render.test.mjs
```

Expected: PASS, 16 tests.

- [ ] **Step 5: Lint and format**

```bash
pnpm format && pnpm lint
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/scripts/rules-index.mjs packages/cli/test/rules-index-render.test.mjs
git commit -m "docs: add renderer for the rule index pages"
```

---

### Task 2: Content pages and the generator

**Files:**

- Create: `docs/src/content/docs/rules/index.mdx`, `docs/src/content/docs/rules/{seo,performance,correctness,security,architecture}/index.mdx`
- Create: `docs/src/content/docs/ja/rules/index.mdx`, `docs/src/content/docs/ja/rules/{seo,performance,correctness,security,architecture}/index.mdx`
- Create: `packages/cli/scripts/gen-rules-index.mjs`
- Modify: `packages/cli/package.json` (scripts block, currently lines 41-46)

**Interfaces:**

- Consumes: `renderAll`, `replaceBlock` from `packages/cli/scripts/rules-index.mjs` (Task 1).
- Produces: the command `pnpm --filter svelte-vitals run gen:rules-index`, and twelve content files whose marker regions Task 3's guard test reads.

- [ ] **Step 1: Create the two top-level pages**

`docs/src/content/docs/rules/index.mdx`:

```mdx
---
title: Rules
description: Every check svelte-vitals runs, grouped by category.
---

Every rule svelte-vitals can report, grouped by category. Each rule links to a reference page describing what it checks, why it matters, and how to fix it.

The severities below are the defaults — see [Configuration](/guides/configuration) to change a rule's severity or turn it off.

<!-- rules-index:start -->
<!-- rules-index:end -->
```

`docs/src/content/docs/ja/rules/index.mdx`:

```mdx
---
title: ルール
description: svelte-vitals が実行するすべてのチェックをカテゴリ別に一覧します。
---

svelte-vitals が報告できるすべてのルールをカテゴリ別に一覧します。各ルールは、何をチェックし、なぜ重要で、どう直すかを説明したリファレンスページにリンクしています。

以下の重大度はデフォルト値です。変更や無効化については [設定](/ja/guides/configuration) を参照してください。

<!-- rules-index:start -->
<!-- rules-index:end -->
```

- [ ] **Step 2: Create the five en category pages**

`docs/src/content/docs/rules/seo/index.mdx`:

```mdx
---
title: SEO rules
description: Every SEO rule svelte-vitals runs.
---

<!-- rules-index:start -->
<!-- rules-index:end -->

See [Configuration](/guides/configuration) to change a rule's severity or turn it off.
```

`docs/src/content/docs/rules/performance/index.mdx`:

```mdx
---
title: Performance rules
description: Every Performance rule svelte-vitals runs.
---

<!-- rules-index:start -->
<!-- rules-index:end -->

See [Configuration](/guides/configuration) to change a rule's severity or turn it off.
```

`docs/src/content/docs/rules/correctness/index.mdx`:

```mdx
---
title: Correctness rules
description: Every Correctness rule svelte-vitals runs.
---

<!-- rules-index:start -->
<!-- rules-index:end -->

See [Configuration](/guides/configuration) to change a rule's severity or turn it off.
```

`docs/src/content/docs/rules/security/index.mdx`:

```mdx
---
title: Security rules
description: Every Security rule svelte-vitals runs.
---

<!-- rules-index:start -->
<!-- rules-index:end -->

See [Configuration](/guides/configuration) to change a rule's severity or turn it off.
```

`docs/src/content/docs/rules/architecture/index.mdx`:

```mdx
---
title: Architecture rules
description: Every Architecture rule svelte-vitals runs.
---

<!-- rules-index:start -->
<!-- rules-index:end -->

See [Configuration](/guides/configuration) to change a rule's severity or turn it off.
```

- [ ] **Step 3: Create the five ja category pages**

`docs/src/content/docs/ja/rules/seo/index.mdx`:

```mdx
---
title: SEO ルール
description: svelte-vitals が実行する SEO ルールの一覧。
---

<!-- rules-index:start -->
<!-- rules-index:end -->

ルールの重大度を変更したり無効にする方法は [設定](/ja/guides/configuration) を参照してください。
```

`docs/src/content/docs/ja/rules/performance/index.mdx`:

```mdx
---
title: Performance ルール
description: svelte-vitals が実行する Performance ルールの一覧。
---

<!-- rules-index:start -->
<!-- rules-index:end -->

ルールの重大度を変更したり無効にする方法は [設定](/ja/guides/configuration) を参照してください。
```

`docs/src/content/docs/ja/rules/correctness/index.mdx`:

```mdx
---
title: Correctness ルール
description: svelte-vitals が実行する Correctness ルールの一覧。
---

<!-- rules-index:start -->
<!-- rules-index:end -->

ルールの重大度を変更したり無効にする方法は [設定](/ja/guides/configuration) を参照してください。
```

`docs/src/content/docs/ja/rules/security/index.mdx`:

```mdx
---
title: Security ルール
description: svelte-vitals が実行する Security ルールの一覧。
---

<!-- rules-index:start -->
<!-- rules-index:end -->

ルールの重大度を変更したり無効にする方法は [設定](/ja/guides/configuration) を参照してください。
```

`docs/src/content/docs/ja/rules/architecture/index.mdx`:

```mdx
---
title: Architecture ルール
description: svelte-vitals が実行する Architecture ルールの一覧。
---

<!-- rules-index:start -->
<!-- rules-index:end -->

ルールの重大度を変更したり無効にする方法は [設定](/ja/guides/configuration) を参照してください。
```

- [ ] **Step 4: Write the generator entry script**

Create `packages/cli/scripts/gen-rules-index.mjs`:

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allRules, CATEGORIES } from '@svelte-vitals/core';
import { renderAll, replaceBlock } from './rules-index.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, '..', '..', '..');
const docsRoot = join(repoRoot, 'docs', 'src', 'content', 'docs');

for (const [file, block] of renderAll(docsRoot, CATEGORIES, allRules)) {
  writeFileSync(file, replaceBlock(readFileSync(file, 'utf8'), block));
  console.log(`Updated ${relative(repoRoot, file)}`);
}
console.log('\nNow run `pnpm format` — oxfmt aligns the generated tables.');
```

- [ ] **Step 5: Register the script**

In `packages/cli/package.json`, add `gen:rules-index` to the scripts block so it reads:

```json
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "gen:rules-index": "node scripts/gen-rules-index.mjs",
    "update-action-pin": "node scripts/gen-action-pin.mjs"
  },
```

- [ ] **Step 6: Generate and format**

```bash
pnpm --filter svelte-vitals run gen:rules-index && pnpm format
```

Expected: twelve `Updated docs/src/content/docs/...` lines, then oxfmt reports the changed files. If it errors with `Cannot find package '@svelte-vitals/core'`, run `pnpm build` first.

- [ ] **Step 7: Inspect one generated page**

```bash
sed -n '1,30p' docs/src/content/docs/rules/architecture/index.mdx
```

Expected: the marker region now holds the Architecture blurb and a two-row table linking `/rules/architecture/component-size` and `/rules/architecture/prop-count`, with `🔵 info` in the severity column.

- [ ] **Step 8: Build the docs**

```bash
pnpm --filter docs check && pnpm --filter docs build
```

Expected: exit 0, no diagnostics. A failure naming an unknown icon means a `CATEGORY_ICON` value is not a Lucide icon name — pick a valid one in `rules-index.mjs` and re-run Step 6.

- [ ] **Step 9: Commit**

```bash
git add docs/src/content/docs/rules docs/src/content/docs/ja/rules packages/cli/scripts/gen-rules-index.mjs packages/cli/package.json
git commit -m "docs: add rule index pages for /rules and each category"
```

---

### Task 3: Guard test

**Files:**

- Create: `packages/cli/test/rules-index.test.mjs`
- Modify: `packages/cli/test/docs-links.test.ts` (the `has no stray rule pages without a matching rule` case)

**Interfaces:**

- Consumes: `renderAll`, `extractBlock`, `normalizeBlock`, `parseRuleIds`, `localeDir`, `LOCALES` from `packages/cli/scripts/rules-index.mjs` (Task 1); the twelve committed content files (Task 2).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/rules-index.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allRules, CATEGORIES } from '@svelte-vitals/core';
import { LOCALES, extractBlock, localeDir, normalizeBlock, parseRuleIds, renderAll } from '../scripts/rules-index.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const docsRoot = join(repoRoot, 'docs', 'src', 'content', 'docs');
const REGENERATE = 'run `pnpm --filter svelte-vitals run gen:rules-index && pnpm format`';

describe('docs: rule index pages are up to date', () => {
  const blocks = renderAll(docsRoot, CATEGORIES, allRules);

  for (const [file, block] of blocks) {
    it(`matches the generator: ${relative(docsRoot, file)}`, () => {
      const committed = extractBlock(readFileSync(file, 'utf8'));
      expect(normalizeBlock(committed), REGENERATE).toBe(normalizeBlock(block));
    });
  }

  for (const locale of LOCALES) {
    it(`lists every rule exactly once across the category pages (${locale})`, () => {
      const dir = localeDir(docsRoot, locale);
      const listed = CATEGORIES.flatMap((category) =>
        parseRuleIds(extractBlock(readFileSync(join(dir, category, 'index.mdx'), 'utf8')))
      );
      expect(listed.slice().sort(), REGENERATE).toEqual(allRules.map((rule) => rule.id).sort());
    });
  }
});
```

- [ ] **Step 2: Run it to verify it passes against the committed pages**

```bash
pnpm --filter svelte-vitals exec vitest run test/rules-index.test.mjs
```

Expected: PASS, 14 tests (12 page comparisons + 2 completeness checks).

- [ ] **Step 3: Prove the guard actually fails on drift**

```bash
perl -pi -e 's/🔵 info/🔴 critical/' docs/src/content/docs/rules/architecture/index.mdx && pnpm --filter svelte-vitals exec vitest run test/rules-index.test.mjs
```

Expected: FAIL on `matches the generator: rules/architecture/index.mdx`, with the regeneration command in the message.

- [ ] **Step 4: Restore the file**

```bash
git checkout docs/src/content/docs/rules/architecture/index.mdx
pnpm --filter svelte-vitals exec vitest run test/rules-index.test.mjs
```

Expected: PASS again.

- [ ] **Step 5: Update the stray-page check**

In `packages/cli/test/docs-links.test.ts`, replace the `has no stray rule pages without a matching rule` case with:

```ts
it('has no stray rule pages without a matching rule', () => {
  const ids = new Set(documented.map((r) => `${r.id}.md`));
  // Generated index pages and sidebar metadata live alongside the rule pages.
  const basename = (f: string) => f.slice(f.lastIndexOf('/') + 1);
  for (const dir of [enRules, jaRules])
    for (const f of listFilesRecursive(dir)) {
      if (basename(f) === 'index.mdx' || basename(f) === 'meta.ts') continue;
      expect(ids.has(f), `stray ${f} in ${dir}`).toBe(true);
    }
});
```

- [ ] **Step 6: Run the whole cli suite**

```bash
pnpm --filter svelte-vitals run test
```

Expected: PASS, including `docs-links.test.ts` (which would otherwise fail on the twelve new `index.mdx` files).

- [ ] **Step 7: Lint, format, commit**

```bash
pnpm format && pnpm lint
git add packages/cli/test/rules-index.test.mjs packages/cli/test/docs-links.test.ts
git commit -m "test(cli): fail the build when the rule index pages go stale"
```

---

### Task 4: Sidebar labels and order

**Files:**

- Create: `docs/src/content/docs/rules/{seo,performance,correctness,security,architecture}/meta.ts`
- Create: `docs/src/content/docs/ja/rules/{seo,performance,correctness,security,architecture}/meta.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks (Blume reads these files directly).
- Produces: nothing later tasks depend on.

Without these, Blume humanizes the folder name — the SEO group reads `Seo` — and the five groups sort alphabetically instead of in the order the CLI reports them.

- [ ] **Step 1: Create the five en meta files**

`docs/src/content/docs/rules/seo/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'SEO', order: 1 });
```

`docs/src/content/docs/rules/performance/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'Performance', order: 2 });
```

`docs/src/content/docs/rules/correctness/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'Correctness', order: 3 });
```

`docs/src/content/docs/rules/security/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'Security', order: 4 });
```

`docs/src/content/docs/rules/architecture/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'Architecture', order: 5 });
```

- [ ] **Step 2: Create the five ja meta files**

Category names stay English in both locales, matching the CLI's own output, so each ja file is identical to its en counterpart.

`docs/src/content/docs/ja/rules/seo/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'SEO', order: 1 });
```

`docs/src/content/docs/ja/rules/performance/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'Performance', order: 2 });
```

`docs/src/content/docs/ja/rules/correctness/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'Correctness', order: 3 });
```

`docs/src/content/docs/ja/rules/security/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'Security', order: 4 });
```

`docs/src/content/docs/ja/rules/architecture/meta.ts`:

```ts
import { defineMeta } from 'blume';

export default defineMeta({ title: 'Architecture', order: 5 });
```

- [ ] **Step 3: Build the docs**

```bash
pnpm --filter docs check && pnpm --filter docs build
```

Expected: exit 0. A `display` field would be a build error here — none of these files set one.

- [ ] **Step 4: Verify the sidebar in the browser**

```bash
pnpm --filter docs dev
```

Open `/rules`, confirm: the Rules section lists SEO, Performance, Correctness, Security, Architecture in that order; `SEO` is not rendered as `Seo`; each category page shows its table; a rule link opens the matching reference page. Then stop the dev server.

- [ ] **Step 5: Lint, format, commit**

```bash
pnpm format && pnpm lint
git add docs/src/content/docs/rules docs/src/content/docs/ja/rules
git commit -m "docs: label and order the rule categories in the sidebar"
```

---

### Task 5: AGENTS.md and full verification

**Files:**

- Modify: `AGENTS.md` (the `Adding a rule` bullet under `## Conventions`)

**Interfaces:**

- Consumes: the `gen:rules-index` command from Task 2.
- Produces: nothing.

- [ ] **Step 1: Update the "Adding a rule" bullet**

In `AGENTS.md`, replace the `**Adding a rule**` bullet with:

```markdown
- **Adding a rule**: create `packages/core/src/rules/<dir>/<slug>.ts` (the Performance directory is `perf/`, not `performance/`), then register it in **four** places: `packages/core/src/rules/index.ts` (the import, the `allRules` array, and the re-export block) _and_ `packages/core/src/index.ts`'s own `export { ... } from './rules/index.js'` list, which duplicates the same names. TypeScript won't catch a missed spot in the fourth place (it's a plain re-export list), so grep for the previous rule's id after adding a new one. Add rule docs under `docs/src/content/docs/rules/<id>.md` (en) and `docs/src/content/docs/ja/rules/<id>.md` (ja) — `packages/cli/test/docs-links.test.ts` fails the build if either is missing. Then regenerate the index pages with `pnpm --filter svelte-vitals run gen:rules-index && pnpm format` and commit them; `packages/cli/test/rules-index.test.mjs` fails the build if they are stale. **Never hard-code rule counts or ID ranges in READMEs/guides** (e.g. "CORRECT001–009" or "the two Performance rules") — such text rots on every new rule; refer to rule _categories_ instead. Rule IDs in guides are fine only as examples or sample output.
```

- [ ] **Step 2: Run the full verification suite**

```bash
pnpm lint && pnpm build && pnpm typecheck && pnpm test
```

Expected: all four exit 0.

- [ ] **Step 3: Build the docs one more time**

```bash
pnpm --filter docs check && pnpm --filter docs build
```

Expected: exit 0.

- [ ] **Step 4: Confirm the working tree is clean apart from the AGENTS.md edit**

```bash
git status --porcelain
```

Expected: only ` M AGENTS.md`. Anything else means a previous task left a file uncommitted or `pnpm format` reformatted generated output — commit or regenerate as appropriate.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document the rule index regeneration step"
```

---

## Out of scope

- No changeset — this is a docs-only change (AGENTS.md).
- No "has options" column in the tables; per-rule options stay documented on each rule page and in the configuration guide.
- No top-level `rules/meta.ts`: the group already humanizes to `Rules` and sorts after `Guides`, matching how `guides/` itself gets no meta file today.
