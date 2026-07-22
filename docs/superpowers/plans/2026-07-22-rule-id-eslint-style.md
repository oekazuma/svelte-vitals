# ルールIDのESLintスタイル移行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** svelte-vitalsの全60ルールのIDを `SEO008` 形式から `seo/json-ld` 形式(`category/kebab-case`)に移行し、config・抑制コメント・CLI/MCP・docsを一貫して更新する。

**Architecture:** ルール実装ファイルをルールごとに1ファイルへ分割・リネームしてIDを変更 → coreの周辺ロジック(抑制コメント正規表現、大文字小文字正規化)を更新 → 全パッケージのテスト・サンプルコード内のID文字列を一括置換 → docs(en/ja)のルールページをカテゴリのサブディレクトリへ移行 → changeset作成 → 全体検証。設計は[docs/superpowers/specs/2026-07-22-rule-id-eslint-style-design.md](../specs/2026-07-22-rule-id-eslint-style-design.md)(Fable 5レビュー済み・承認済み)を参照。

**Tech Stack:** TypeScript(pnpmモノレポ)、vitest、Astro Starlight(docs)。

## Global Constraints

- 新ID形式は `<category>/<kebab-case-name>`。`category` は `Rule.category` の値(`seo`|`performance`|`correctness`|`security`|`architecture`)と完全一致させる。
- 全60ルールの新旧対応は本計画のTask 1で作成する `scratchpad/rule-id-map.json` を単一の正とする。設計書の対応表と完全に一致する(Fable 5指摘反映済みの `security/handler-state-write`、`seo/single-h1`、`seo/heading-level-skip` を含む)。
- **旧IDのエイリアス・後方互換は一切作らない**(v1.0前の破壊的変更方針)。
- ルール実装ファイルの **export識別子名(例: `seo002Description`、`perf011LoadWaterfall`)は変更しない**。ファイル名と `id:` フィールドの値のみ変更する — 識別子リネームは本移行の本質(ユーザー向けID命名)に寄与せず、影響範囲を不必要に広げるため対象外。
- `packages/core/src/rules/perf/` ディレクトリ名は据え置き(IDのカテゴリプレフィックスは `performance/` になるが、ディレクトリ名はユーザー向けAPIではないため変更しない)。
- 抑制コメントの新ID部分の正規表現は `[a-z]+\/[a-z][a-z0-9-]*`。大文字小文字は区別する(ESLintのルール名同様、新IDは小文字固定)。
- config例のキーはスラッシュを含むためクォート必須: `rules: { 'seo/ssr-disabled': 'off' }`。
- 各タスクの最後で該当パッケージの `pnpm --filter <pkg> test` を実行し、パスすることを確認してからコミットする。

---

## Task 1: 移行マッピングの作成

**Files:**

- Create: `/private/tmp/claude-501/-Users-oekazuma-localRepo-svelte-vitals/ad91d3ba-700b-4a5e-9fa8-bf7974cdb1e1/scratchpad/rule-id-map.json`(以下 `scratchpad/rule-id-map.json` と表記。セッションのスクラッチパッドが変わっている場合は同内容のファイルをそこに作成する)
- Create: `/private/tmp/claude-501/-Users-oekazuma-localRepo-svelte-vitals/ad91d3ba-700b-4a5e-9fa8-bf7974cdb1e1/scratchpad/replace-rule-ids.mjs`(以下 `scratchpad/replace-rule-ids.mjs`)

**Interfaces:**

- Produces: `rule-id-map.json` は `[{ "oldId": "SEO001", "newId": "seo/title-presence" }, ...]` という60要素の配列。Task 11〜13・17でこのファイルをNode script経由で読み込み、テキスト一括置換に使う。

- [ ] **Step 1: マッピングJSONを作成する**

`scratchpad/rule-id-map.json` に以下を書き込む(60エントリ全件、設計書と一致):

```json
[
  { "oldId": "ARCH001", "newId": "architecture/component-size" },
  { "oldId": "ARCH002", "newId": "architecture/prop-count" },
  { "oldId": "CORRECT001", "newId": "correctness/each-key" },
  { "oldId": "CORRECT002", "newId": "correctness/effect-as-derived" },
  { "oldId": "CORRECT003", "newId": "correctness/effect-as-onmount" },
  { "oldId": "CORRECT004", "newId": "correctness/unmutated-state" },
  { "oldId": "CORRECT005", "newId": "correctness/prop-mutation" },
  { "oldId": "CORRECT006", "newId": "correctness/orphan-effect" },
  { "oldId": "CORRECT007", "newId": "correctness/orphan-lifecycle" },
  { "oldId": "CORRECT008", "newId": "correctness/server-browser-global" },
  { "oldId": "CORRECT009", "newId": "correctness/instance-browser-global" },
  { "oldId": "SEC001", "newId": "security/raw-html" },
  { "oldId": "SEC002", "newId": "security/javascript-url" },
  { "oldId": "SEC003", "newId": "security/handler-state-write" },
  { "oldId": "SEC004", "newId": "security/server-module-state" },
  { "oldId": "SEC005", "newId": "security/shared-state-import" },
  { "oldId": "PERF001", "newId": "performance/image-dimensions" },
  { "oldId": "PERF002", "newId": "performance/image-loading-hint" },
  { "oldId": "PERF006", "newId": "performance/responsive-image" },
  { "oldId": "PERF003", "newId": "performance/preload-missing-as" },
  { "oldId": "PERF004", "newId": "performance/font-preload-crossorigin" },
  { "oldId": "PERF005", "newId": "performance/lcp-image" },
  { "oldId": "PERF007", "newId": "performance/render-blocking-script" },
  { "oldId": "PERF008", "newId": "performance/preconnect" },
  { "oldId": "PERF009", "newId": "performance/heavy-import" },
  { "oldId": "PERF010", "newId": "performance/namespace-import" },
  { "oldId": "PERF011", "newId": "performance/load-waterfall" },
  { "oldId": "PERF012", "newId": "performance/minify-disabled" },
  { "oldId": "PERF013", "newId": "performance/sequential-awaits" },
  { "oldId": "SEO001", "newId": "seo/title-presence" },
  { "oldId": "SEO002", "newId": "seo/description-presence" },
  { "oldId": "SEO003", "newId": "seo/canonical-url" },
  { "oldId": "SEO004", "newId": "seo/og-image" },
  { "oldId": "SEO005", "newId": "seo/og-title" },
  { "oldId": "SEO006", "newId": "seo/robots-txt" },
  { "oldId": "SEO007", "newId": "seo/sitemap-xml" },
  { "oldId": "SEO008", "newId": "seo/json-ld" },
  { "oldId": "SEO009", "newId": "seo/html-lang" },
  { "oldId": "SEO010", "newId": "seo/indexability" },
  { "oldId": "SEO011", "newId": "seo/twitter-card" },
  { "oldId": "SEO012", "newId": "seo/og-description" },
  { "oldId": "SEO013", "newId": "seo/og-url" },
  { "oldId": "SEO014", "newId": "seo/viewport" },
  { "oldId": "SEO015", "newId": "seo/sitemap-in-robots" },
  { "oldId": "SEO016", "newId": "seo/json-ld-validity" },
  { "oldId": "SEO017", "newId": "seo/json-ld-deprecated-type" },
  { "oldId": "SEO018", "newId": "seo/json-ld-relative-url" },
  { "oldId": "SEO019", "newId": "seo/json-ld-date-format" },
  { "oldId": "SEO020", "newId": "seo/json-ld-placeholder" },
  { "oldId": "SEO021", "newId": "seo/json-ld-required-props" },
  { "oldId": "SEO022", "newId": "seo/title-length" },
  { "oldId": "SEO023", "newId": "seo/description-length" },
  { "oldId": "SEO024", "newId": "seo/charset" },
  { "oldId": "SEO025", "newId": "seo/image-alt" },
  { "oldId": "SEO026", "newId": "seo/hreflang" },
  { "oldId": "SEO027", "newId": "seo/single-h1" },
  { "oldId": "SEO028", "newId": "seo/duplicate-title" },
  { "oldId": "SEO029", "newId": "seo/duplicate-description" },
  { "oldId": "SEO030", "newId": "seo/heading-level-skip" },
  { "oldId": "SEO031", "newId": "seo/ssr-disabled" }
]
```

- [ ] **Step 2: 一括置換スクリプトを作成する**

`scratchpad/replace-rule-ids.mjs`:

```js
#!/usr/bin/env node
// Usage: node replace-rule-ids.mjs <repoRoot> <relativeDir1> [relativeDir2 ...]
// Replaces every whole-word occurrence of a mapped oldId with its newId, recursively,
// across all files in the given directories (relative to repoRoot). Prints changed files.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [repoRoot, ...dirs] = process.argv.slice(2);
if (!repoRoot || dirs.length === 0) {
  console.error('Usage: node replace-rule-ids.mjs <repoRoot> <relativeDir1> [relativeDir2 ...]');
  process.exit(1);
}

const map = JSON.parse(readFileSync(new URL('./rule-id-map.json', import.meta.url), 'utf8'));
const patterns = map.map(({ oldId, newId }) => ({ re: new RegExp(`\\b${oldId}\\b`, 'g'), newId }));

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

let changedCount = 0;
for (const relDir of dirs) {
  const absDir = join(repoRoot, relDir);
  const files = walk(absDir, []);
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    let next = content;
    for (const { re, newId } of patterns) next = next.replace(re, newId);
    if (next !== content) {
      writeFileSync(file, next);
      changedCount++;
      console.log('changed:', file);
    }
  }
}
console.log(`done. ${changedCount} file(s) changed.`);
```

- [ ] **Step 3: 動作確認**

Run: `node /path/to/scratchpad/replace-rule-ids.mjs /Users/oekazuma/localRepo/svelte-vitals docs/superpowers/plans/does-not-exist`

Expected: `Usage:` エラーにならず、対象ディレクトリが空/存在しないため `done. 0 file(s) changed.` のみ出力される(スクリプト自体が例外なく走ることの確認。実ディレクトリへの適用はTask 11以降で行う)。

このタスクはコミット不要(scratchpad配下の一時ファイルなのでリポジトリにコミットしない)。

---

## Task 2: architecture カテゴリのルール分割

**Files:**

- Create: `packages/core/src/rules/architecture/component-size.ts`
- Create: `packages/core/src/rules/architecture/prop-count.ts`
- Delete: `packages/core/src/rules/architecture/arch001-002.ts`
- Modify: `packages/core/src/rules/index.ts:52`(このタスクでは変更しない — importパスの一括更新はTask 8で行う。分割ファイルは一旦旧ファイルと共存させず、このタスク内でindex.tsの該当1行だけ先に直す)

**Interfaces:**

- Produces: `arch001ComponentSize`(`id: 'architecture/component-size'`)、`arch002PropCount`(`id: 'architecture/prop-count'`)。識別子名は変更なし。

- [ ] **Step 1: `component-size.ts` を作成**

```ts
import { componentRule } from '../component-rule.js';

/** A component longer than this many lines is a "god component" smell. */
const MAX_LOC = 400;

export const arch001ComponentSize = componentRule({
  id: 'architecture/component-size',
  title: 'Component size',
  category: 'architecture',
  severity: 'info',
  label: 'Component size',
  recommendation: `Split components over ${MAX_LOC} lines into smaller, focused pieces.`,
  rationale:
    'A very large component is hard to read, test, and reuse, and is a common sign that several responsibilities should be split out.',
  applies: (c) => c.loc > 0, // skip unanalyzable files (loc 0 = read/parse failure), don't PASS them
  bad: (c) => (c.loc > MAX_LOC ? [{ line: 1, message: `Component is ${c.loc} lines (over ${MAX_LOC})` }] : [])
});
```

- [ ] **Step 2: `prop-count.ts` を作成**

```ts
import { componentRule } from '../component-rule.js';

/** More destructured props than this suggests the component is doing too much. */
const MAX_PROPS = 10;

export const arch002PropCount = componentRule({
  id: 'architecture/prop-count',
  title: 'Prop count',
  category: 'architecture',
  severity: 'info',
  label: 'Prop count',
  recommendation: `Group related props into an object, or split the component, when it takes more than ${MAX_PROPS} props.`,
  rationale:
    'A component taking many props is usually doing too much; grouping or splitting keeps its API understandable.',
  applies: (c) => c.propCount > 0, // only components whose props we could count
  bad: (c) =>
    c.propCount > MAX_PROPS ? [{ line: 1, message: `Component takes ${c.propCount} props (over ${MAX_PROPS})` }] : []
});
```

- [ ] **Step 3: 旧ファイルを削除し、index.tsのimportを1行更新**

```bash
rm packages/core/src/rules/architecture/arch001-002.ts
```

`packages/core/src/rules/index.ts:52` を編集:

```ts
// before
import { arch001ComponentSize, arch002PropCount } from './architecture/arch001-002.js';
// after
import { arch001ComponentSize } from './architecture/component-size.js';
import { arch002PropCount } from './architecture/prop-count.js';
```

- [ ] **Step 4: ビルド確認**

Run: `pnpm --filter @svelte-vitals/core build`
Expected: 型エラーなくビルドが通る(この段階ではテストのID文字列はまだ更新していないため、`pnpm test` は後続タスクまで実行しない)

- [ ] **Step 5: コミット**

```bash
git add packages/core/src/rules/architecture packages/core/src/rules/index.ts
git commit -m "refactor(core): split architecture rules into per-rule files with new IDs"
```

---

## Task 3: correctness カテゴリのルール分割

**Files:**

- Create: `packages/core/src/rules/correctness/each-key.ts`
- Create: `packages/core/src/rules/correctness/effect-as-derived.ts`
- Create: `packages/core/src/rules/correctness/effect-as-onmount.ts`
- Modify(rename): `correct004-unmutated-state.ts` → `unmutated-state.ts`
- Modify(rename): `correct005-prop-mutation.ts` → `prop-mutation.ts`
- Modify(rename): `correct006-orphan-effect.ts` → `orphan-effect.ts`
- Modify(rename): `correct007-orphan-lifecycle.ts` → `orphan-lifecycle.ts`
- Modify(rename): `correct008-browser-globals.ts` → `server-browser-global.ts`
- Modify(rename): `correct009-instance-browser-globals.ts` → `instance-browser-global.ts`
- Delete: `packages/core/src/rules/correctness/correct001-002.ts`
- Modify: `packages/core/src/rules/index.ts`(該当import群)

**Interfaces:**

- Produces: `correct001EachKey`(`id: 'correctness/each-key'`)、`correct002EffectDerived`(`id: 'correctness/effect-as-derived'`)、`correct003EffectAsOnMount`(`id: 'correctness/effect-as-onmount'`)、`correct004UnmutatedState`(`id: 'correctness/unmutated-state'`)、`correct005PropMutation`(`id: 'correctness/prop-mutation'`)、`correct006OrphanEffect`(`id: 'correctness/orphan-effect'`)、`correct007OrphanLifecycle`(`id: 'correctness/orphan-lifecycle'`)、`correct008BrowserGlobals`(`id: 'correctness/server-browser-global'`)、`correct009InstanceBrowserGlobals`(`id: 'correctness/instance-browser-global'`)。識別子名は変更なし。

- [ ] **Step 1: `each-key.ts` を作成**

```ts
import { componentRule } from '../component-rule.js';

export const correct001EachKey = componentRule({
  id: 'correctness/each-key',
  title: 'Keyed each block',
  category: 'correctness',
  label: 'Keyed {#each}',
  recommendation: 'Add a key to the {#each} block, e.g. {#each items as item (item.id)}.',
  rationale:
    'An unkeyed {#each} adds/removes nodes at the end and rewrites the data of the DOM nodes in between when the list reorders, so element state/focus sticks to positions instead of items; a key lets Svelte insert, move, and delete the right nodes instead.',
  applies: (c) => c.eachBlocks.length > 0,
  bad: (c) => c.eachBlocks.filter((e) => !e.hasKey).map((e) => ({ line: e.line, message: '{#each} block has no key' }))
});
```

- [ ] **Step 2: `effect-as-derived.ts` を作成**

```ts
import { componentRule } from '../component-rule.js';

export const correct002EffectDerived = componentRule({
  id: 'correctness/effect-as-derived',
  title: 'Effect used to derive state',
  category: 'correctness',
  label: '$effect usage',
  recommendation: 'Replace the state-syncing $effect with a derived value, e.g. let x = $derived(expr).',
  rationale:
    'An $effect whose body only assigns to $state is the "useEffect → $effect" anti-pattern: it reruns after render and can cause extra passes or loops. $derived expresses the same dependency declaratively.',
  applies: (c) => c.effects.length > 0,
  bad: (c) =>
    c.effects
      .filter((e) => e.assignsOnlyState)
      .map((e) => ({ line: e.line, message: '$effect only assigns state — use $derived instead' }))
});
```

- [ ] **Step 3: `effect-as-onmount.ts` を作成**

```ts
import { componentRule } from '../component-rule.js';

export const correct003EffectAsOnMount = componentRule({
  id: 'correctness/effect-as-onmount',
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

- [ ] **Step 4: 残り6ファイルをリネームし、内部の `id:`(または `const ID =`)を更新**

```bash
git mv packages/core/src/rules/correctness/correct004-unmutated-state.ts packages/core/src/rules/correctness/unmutated-state.ts
git mv packages/core/src/rules/correctness/correct005-prop-mutation.ts packages/core/src/rules/correctness/prop-mutation.ts
git mv packages/core/src/rules/correctness/correct006-orphan-effect.ts packages/core/src/rules/correctness/orphan-effect.ts
git mv packages/core/src/rules/correctness/correct007-orphan-lifecycle.ts packages/core/src/rules/correctness/orphan-lifecycle.ts
git mv packages/core/src/rules/correctness/correct008-browser-globals.ts packages/core/src/rules/correctness/server-browser-global.ts
git mv packages/core/src/rules/correctness/correct009-instance-browser-globals.ts packages/core/src/rules/correctness/instance-browser-global.ts
```

各ファイルの `id` 相当の値を書き換える:

`unmutated-state.ts:4`: `id: 'CORRECT004',` → `id: 'correctness/unmutated-state',`

`prop-mutation.ts:4`: `id: 'CORRECT005',` → `id: 'correctness/prop-mutation',`

`orphan-effect.ts:4`: `id: 'CORRECT006',` → `id: 'correctness/orphan-effect',`

`orphan-lifecycle.ts:8`: `const ID = 'CORRECT007';` → `const ID = 'correctness/orphan-lifecycle';`(この1箇所の変更だけで、同ファイル内の `id: ID` 参照すべてに伝播する)

`server-browser-global.ts:8`: `const ID = 'CORRECT008';` → `const ID = 'correctness/server-browser-global';`

`instance-browser-global.ts:4`: `id: 'CORRECT009',` → `id: 'correctness/instance-browser-global',`

- [ ] **Step 5: 旧ファイルを削除し、index.tsのimportを更新**

```bash
rm packages/core/src/rules/correctness/correct001-002.ts
```

`packages/core/src/rules/index.ts` の該当7行(41-47行目)を編集:

```ts
// before
import { correct001EachKey, correct002EffectDerived, correct003EffectAsOnMount } from './correctness/correct001-002.js';
import { correct004UnmutatedState } from './correctness/correct004-unmutated-state.js';
import { correct005PropMutation } from './correctness/correct005-prop-mutation.js';
import { correct006OrphanEffect } from './correctness/correct006-orphan-effect.js';
import { correct007OrphanLifecycle } from './correctness/correct007-orphan-lifecycle.js';
import { correct008BrowserGlobals } from './correctness/correct008-browser-globals.js';
import { correct009InstanceBrowserGlobals } from './correctness/correct009-instance-browser-globals.js';
// after
import { correct001EachKey } from './correctness/each-key.js';
import { correct002EffectDerived } from './correctness/effect-as-derived.js';
import { correct003EffectAsOnMount } from './correctness/effect-as-onmount.js';
import { correct004UnmutatedState } from './correctness/unmutated-state.js';
import { correct005PropMutation } from './correctness/prop-mutation.js';
import { correct006OrphanEffect } from './correctness/orphan-effect.js';
import { correct007OrphanLifecycle } from './correctness/orphan-lifecycle.js';
import { correct008BrowserGlobals } from './correctness/server-browser-global.js';
import { correct009InstanceBrowserGlobals } from './correctness/instance-browser-global.js';
```

- [ ] **Step 6: ビルド確認**

Run: `pnpm --filter @svelte-vitals/core build`
Expected: 型エラーなくビルドが通る

- [ ] **Step 7: コミット**

```bash
git add packages/core/src/rules/correctness packages/core/src/rules/index.ts
git commit -m "refactor(core): split correctness rules into per-rule files with new IDs"
```

---

## Task 4: security カテゴリのルール分割

**Files:**

- Create: `packages/core/src/rules/security/raw-html.ts`
- Create: `packages/core/src/rules/security/javascript-url.ts`
- Modify(rename): `sec003-load-state-write.ts` → `handler-state-write.ts`
- Modify(rename): `sec004-server-module-state.ts` → `server-module-state.ts`
- Modify(rename): `sec005-shared-state-import.ts` → `shared-state-import.ts`
- Delete: `packages/core/src/rules/security/sec001-002.ts`
- Modify: `packages/core/src/rules/index.ts`(該当import群)

**Interfaces:**

- Produces: `sec001Html`(`id: 'security/raw-html'`)、`sec002JavascriptUrl`(`id: 'security/javascript-url'`)、`sec003LoadStateWrite`(`id: 'security/handler-state-write'`)、`sec004ServerModuleState`(`id: 'security/server-module-state'`)、`sec005SharedStateImport`(`id: 'security/shared-state-import'`)。識別子名は変更なし。

- [ ] **Step 1: `raw-html.ts` を作成**

```ts
import { componentRule } from '../component-rule.js';

export const sec001Html = componentRule({
  id: 'security/raw-html',
  title: 'Raw HTML render',
  category: 'security',
  label: '{@html} usage',
  recommendation: 'Sanitize the value before {@html} (e.g. DOMPurify), or render it as text/markup instead.',
  rationale:
    '{@html} renders its value as unescaped HTML; if the value can contain user input and is not sanitized, it is a cross-site-scripting (XSS) vector.',
  applies: (c) => c.htmlTags.length > 0,
  bad: (c) =>
    c.htmlTags.map((h) => ({ line: h.line, message: '{@html} renders unescaped HTML — ensure it is sanitized' }))
});
```

- [ ] **Step 2: `javascript-url.ts` を作成**

```ts
import { componentRule } from '../component-rule.js';

export const sec002JavascriptUrl = componentRule({
  id: 'security/javascript-url',
  title: 'javascript: URL',
  category: 'security',
  label: 'No javascript: URLs',
  recommendation: 'Use an event handler or a real URL instead of a javascript: URL.',
  rationale:
    'A javascript: URL in href/src/action executes arbitrary script on activation — an XSS / unsafe-navigation vector that also breaks under a strict Content-Security-Policy.',
  applies: (c) => c.javascriptUrls.length > 0,
  bad: (c) => c.javascriptUrls.map((u) => ({ line: u.line, message: 'javascript: URL in an attribute' }))
});
```

- [ ] **Step 3: 残り3ファイルをリネームしIDを更新**

```bash
git mv packages/core/src/rules/security/sec003-load-state-write.ts packages/core/src/rules/security/handler-state-write.ts
git mv packages/core/src/rules/security/sec004-server-module-state.ts packages/core/src/rules/security/server-module-state.ts
git mv packages/core/src/rules/security/sec005-shared-state-import.ts packages/core/src/rules/security/shared-state-import.ts
```

`handler-state-write.ts`: `id: 'SEC003',` → `id: 'security/handler-state-write',`(title `'Handler writes imported state'` は変更しない)

`server-module-state.ts`: `id: 'SEC004',` → `id: 'security/server-module-state',`

`shared-state-import.ts`: `id: 'SEC005',` → `id: 'security/shared-state-import',`

- [ ] **Step 4: 旧ファイルを削除し、index.tsのimportを更新**

```bash
rm packages/core/src/rules/security/sec001-002.ts
```

`packages/core/src/rules/index.ts` の該当4行(48-51行目)を編集:

```ts
// before
import { sec001Html, sec002JavascriptUrl } from './security/sec001-002.js';
import { sec003LoadStateWrite } from './security/sec003-load-state-write.js';
import { sec004ServerModuleState } from './security/sec004-server-module-state.js';
import { sec005SharedStateImport } from './security/sec005-shared-state-import.js';
// after
import { sec001Html } from './security/raw-html.js';
import { sec002JavascriptUrl } from './security/javascript-url.js';
import { sec003LoadStateWrite } from './security/handler-state-write.js';
import { sec004ServerModuleState } from './security/server-module-state.js';
import { sec005SharedStateImport } from './security/shared-state-import.js';
```

- [ ] **Step 5: ビルド確認**

Run: `pnpm --filter @svelte-vitals/core build`
Expected: 型エラーなくビルドが通る

- [ ] **Step 6: コミット**

```bash
git add packages/core/src/rules/security packages/core/src/rules/index.ts
git commit -m "refactor(core): split security rules into per-rule files with new IDs"
```

---

## Task 5: performance カテゴリのルール分割

**Files:**

- Create: `packages/core/src/rules/perf/image-dimensions.ts`、`image-loading-hint.ts`、`responsive-image.ts`
- Create: `packages/core/src/rules/perf/preload-missing-as.ts`、`font-preload-crossorigin.ts`
- Modify(rename): `perf005-lcp-image.ts` → `lcp-image.ts`
- Modify(rename): `perf007-render-blocking.ts` → `render-blocking-script.ts`
- Modify(rename): `perf008-preconnect.ts` → `preconnect.ts`
- Modify(rename): `perf009-heavy-import.ts` → `heavy-import.ts`
- Modify(rename): `perf010-namespace-import.ts` → `namespace-import.ts`
- Modify(rename): `perf011-load-waterfall.ts` → `load-waterfall.ts`
- Modify(rename): `perf012-minify-disabled.ts` → `minify-disabled.ts`
- Modify(rename): `perf013-sequential-awaits.ts` → `sequential-awaits.ts`
- Delete: `packages/core/src/rules/perf/images.ts`、`resource-hints.ts`
- Modify: `packages/core/src/rules/index.ts`

**Interfaces:**

- Produces: 13ルール全ての `id` が `performance/...` になる。識別子名は変更なし。`docsUrlFor('PERF005')` のような直書きリテラル引数を持つファイル(`lcp-image.ts`、`render-blocking-script.ts`、`preconnect.ts`)は、そのファイル内の**全出現箇所**を書き換える必要がある(定数化されていないため)。

- [ ] **Step 1: `image-dimensions.ts` を作成**

```ts
import { imageRule } from './image-rule.js';

export const perf001ImageDimensions = imageRule({
  id: 'performance/image-dimensions',
  title: 'Image dimensions',
  severity: 'warning',
  label: '<img> width/height',
  recommendation: 'Set explicit width and height on <img> to reserve space and avoid layout shift (CLS).',
  rationale:
    'An <img> without explicit width and height triggers layout shift (CLS) as it loads, hurting Core Web Vitals and visual stability.',
  fix: {
    description: 'Add explicit width and height attributes to the <img>.',
    snippet: '<img src="/hero.jpg" width="1200" height="630" alt="…" />',
    lang: 'svelte'
  },
  ok: (img) => img.hasWidth && img.hasHeight
});
```

- [ ] **Step 2: `image-loading-hint.ts` を作成**

```ts
import { imageRule } from './image-rule.js';

export const perf002ImageLoading = imageRule({
  id: 'performance/image-loading-hint',
  title: 'Image loading hint',
  severity: 'info',
  label: '<img> loading attribute',
  recommendation: 'Set loading="lazy" for offscreen images; keep the LCP image eager (consider fetchpriority="high").',
  rationale:
    'A loading attribute lets the browser defer offscreen images; without it images load eagerly and can delay more important content. Static analysis cannot tell which image is the LCP, so this is advisory.',
  fix: {
    description: 'Add loading="lazy" to offscreen <img> elements (leave the LCP/hero image eager).',
    snippet: '<img src="/thumb.jpg" width="320" height="240" loading="lazy" alt="…" />',
    lang: 'svelte'
  },
  ok: (img) => img.hasLoading
});
```

- [ ] **Step 3: `responsive-image.ts` を作成**

```ts
import { imageRule } from './image-rule.js';

export const perf006ResponsiveImage = imageRule({
  id: 'performance/responsive-image',
  title: 'Responsive image',
  severity: 'info',
  label: '<img> srcset',
  recommendation: 'Provide a srcset (and sizes) so the browser can pick a right-sized image per viewport.',
  rationale:
    'An <img> without srcset ships one fixed-size asset to every device, wasting bytes on small screens. Static analysis cannot measure intended display size, so this is advisory.',
  fix: {
    description: 'Add a srcset (and sizes) to the <img> for responsive delivery.',
    snippet:
      '<img src="/hero.jpg" srcset="/hero-800.jpg 800w, /hero-1600.jpg 1600w" sizes="100vw" width="1600" height="900" alt="…" />',
    lang: 'svelte'
  },
  ok: (img) => img.hasSrcset
});
```

- [ ] **Step 4: `preload-missing-as.ts` を作成**

```ts
import { linkRule } from './link-rule.js';

export const perf003PreloadAs = linkRule({
  id: 'performance/preload-missing-as',
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
```

- [ ] **Step 5: `font-preload-crossorigin.ts` を作成**

```ts
import { linkRule } from './link-rule.js';

export const perf004FontPreloadCrossorigin = linkRule({
  id: 'performance/font-preload-crossorigin',
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

- [ ] **Step 6: 残り8ファイルをリネームしIDを更新**

```bash
git mv packages/core/src/rules/perf/perf005-lcp-image.ts packages/core/src/rules/perf/lcp-image.ts
git mv packages/core/src/rules/perf/perf007-render-blocking.ts packages/core/src/rules/perf/render-blocking-script.ts
git mv packages/core/src/rules/perf/perf008-preconnect.ts packages/core/src/rules/perf/preconnect.ts
git mv packages/core/src/rules/perf/perf009-heavy-import.ts packages/core/src/rules/perf/heavy-import.ts
git mv packages/core/src/rules/perf/perf010-namespace-import.ts packages/core/src/rules/perf/namespace-import.ts
git mv packages/core/src/rules/perf/perf011-load-waterfall.ts packages/core/src/rules/perf/load-waterfall.ts
git mv packages/core/src/rules/perf/perf012-minify-disabled.ts packages/core/src/rules/perf/minify-disabled.ts
git mv packages/core/src/rules/perf/perf013-sequential-awaits.ts packages/core/src/rules/perf/sequential-awaits.ts
```

`lcp-image.ts` — `'PERF005'` の**全4箇所**(`docsUrlFor('PERF005')`、`id: 'PERF005'` ×3)を `'performance/lcp-image'` に置換。

`render-blocking-script.ts` — `'PERF007'` の**全3箇所**(`docsUrlFor('PERF007')`、`id: 'PERF007'` ×2)を `'performance/render-blocking-script'` に置換。

`preconnect.ts` — `'PERF008'` の**全3箇所**(`docsUrlFor('PERF008')`、`id: 'PERF008'` ×2)を `'performance/preconnect'` に置換。

`heavy-import.ts:13`: `id: 'PERF009',` → `id: 'performance/heavy-import',`

`namespace-import.ts:4`: `id: 'PERF010',` → `id: 'performance/namespace-import',`

`load-waterfall.ts:13`: `id: 'PERF011',` → `id: 'performance/load-waterfall',`

`minify-disabled.ts`: `id: 'PERF012',` → `id: 'performance/minify-disabled',`

`sequential-awaits.ts:12`: `id: 'PERF013',` → `id: 'performance/sequential-awaits',`

- [ ] **Step 7: 旧ファイルを削除し、index.tsのimportを更新**

```bash
rm packages/core/src/rules/perf/images.ts packages/core/src/rules/perf/resource-hints.ts
```

`packages/core/src/rules/index.ts` の該当行(12-16行目、53-57行目)を編集:

```ts
// before (12-16行目)
import { perf001ImageDimensions, perf002ImageLoading, perf006ResponsiveImage } from './perf/images.js';
import { perf003PreloadAs, perf004FontPreloadCrossorigin } from './perf/resource-hints.js';
import { perf005LcpImage } from './perf/perf005-lcp-image.js';
import { perf007RenderBlockingScript } from './perf/perf007-render-blocking.js';
import { perf008Preconnect } from './perf/perf008-preconnect.js';
// after
import { perf001ImageDimensions } from './perf/image-dimensions.js';
import { perf002ImageLoading } from './perf/image-loading-hint.js';
import { perf006ResponsiveImage } from './perf/responsive-image.js';
import { perf003PreloadAs } from './perf/preload-missing-as.js';
import { perf004FontPreloadCrossorigin } from './perf/font-preload-crossorigin.js';
import { perf005LcpImage } from './perf/lcp-image.js';
import { perf007RenderBlockingScript } from './perf/render-blocking-script.js';
import { perf008Preconnect } from './perf/preconnect.js';
```

```ts
// before (53-57行目)
import { perf009HeavyImport } from './perf/perf009-heavy-import.js';
import { perf010NamespaceImport } from './perf/perf010-namespace-import.js';
import { perf012MinifyDisabled } from './perf/perf012-minify-disabled.js';
import { perf011LoadWaterfall } from './perf/perf011-load-waterfall.js';
import { perf013SequentialAwaits } from './perf/perf013-sequential-awaits.js';
// after
import { perf009HeavyImport } from './perf/heavy-import.js';
import { perf010NamespaceImport } from './perf/namespace-import.js';
import { perf012MinifyDisabled } from './perf/minify-disabled.js';
import { perf011LoadWaterfall } from './perf/load-waterfall.js';
import { perf013SequentialAwaits } from './perf/sequential-awaits.js';
```

- [ ] **Step 8: ビルド確認**

Run: `pnpm --filter @svelte-vitals/core build`
Expected: 型エラーなくビルドが通る

- [ ] **Step 9: コミット**

```bash
git add packages/core/src/rules/perf packages/core/src/rules/index.ts
git commit -m "refactor(core): split performance rules into per-rule files with new IDs"
```

---

## Task 6: seo カテゴリ前半(SEO001-015)のルール分割

**Files:**

- Create: `packages/core/src/rules/seo/title-presence.ts`
- Create: `packages/core/src/rules/seo/description-presence.ts`、`canonical-url.ts`、`og-image.ts`、`og-title.ts`、`json-ld.ts`
- Create: `packages/core/src/rules/seo/robots-txt.ts`、`sitemap-xml.ts`、`html-lang.ts`
- Create: `packages/core/src/rules/seo/indexability.ts`、`twitter-card.ts`、`og-description.ts`、`og-url.ts`、`viewport.ts`、`sitemap-in-robots.ts`
- Delete: `packages/core/src/rules/seo/seo001-title.ts`、`seo002-005-008.ts`、`project-rules.ts`、`seo010-015.ts`
- Modify: `packages/core/src/rules/index.ts`

**Interfaces:**

- Produces: `seo001Title`(`id: 'seo/title-presence'`)、`seo002Description`(`id: 'seo/description-presence'`)、`seo003Canonical`(`id: 'seo/canonical-url'`)、`seo004OgImage`(`id: 'seo/og-image'`)、`seo005OgTitle`(`id: 'seo/og-title'`)、`seo006Robots`(`id: 'seo/robots-txt'`)、`seo007Sitemap`(`id: 'seo/sitemap-xml'`)、`seo008JsonLd`(`id: 'seo/json-ld'`)、`seo009HtmlLang`(`id: 'seo/html-lang'`)、`seo010Indexability`(`id: 'seo/indexability'`)、`seo011TwitterCard`(`id: 'seo/twitter-card'`)、`seo012OgDescription`(`id: 'seo/og-description'`)、`seo013OgUrl`(`id: 'seo/og-url'`)、`seo014Viewport`(`id: 'seo/viewport'`)、`seo015SitemapInRobots`(`id: 'seo/sitemap-in-robots'`)。識別子名は変更なし。

- [ ] **Step 1: `title-presence.ts` を作成**(`seo001-title.ts` を新ファイルへ、`'SEO001'` の2箇所を置換)

```ts
import type { Result, Detection, Fix } from '../../types.js';
import type { HeadTag, ResolvedHead } from '../../head.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const FIX: Fix = {
  description: 'Add a <title> inside <svelte:head> (a dynamic title is fine).',
  snippet: '<svelte:head>\n  <title>{data.title}</title>\n</svelte:head>',
  lang: 'svelte'
};

function detectTitle(head: ResolvedHead): Detection {
  const title: HeadTag | undefined = head.tags.find((t) => t.kind === 'title');
  if (!title) {
    // No <title> anywhere in the layout chain.
    return { presence: 'none', value: 'absent' };
  }
  return { presence: title.presence, value: title.value };
}

function messageFor(detection: Detection): string {
  if (detection.presence === 'none') return 'Missing <title>';
  if (detection.value === 'absent') return 'Empty <title>';
  return '<title>';
}

/**
 * seo/title-presence — every route should resolve a non-empty <title> (design §11).
 * A dynamic title (`{data.title}`) is the most common correct pattern and must
 * never be flagged as missing; it surfaces as value 'dynamic' (design §4).
 */
export const seo001Title: Rule = {
  id: 'seo/title-presence',
  title: 'Title presence',
  category: 'seo',
  severity: 'critical',
  scope: 'route',
  rationale:
    'A unique, non-empty <title> is the single strongest on-page SEO signal and the text shown in search results and browser tabs.',
  fix: FIX,

  async check(ctx: RuleContext): Promise<Result[]> {
    return ctx.heads.map((head) => {
      const detection = detectTitle(head);
      return {
        id: 'seo/title-presence',
        category: 'seo',
        severity: 'critical',
        detection,
        route: head.route,
        location: head.file,
        message: messageFor(detection),
        recommendation:
          'Add a <title> inside <svelte:head>, e.g. <title>{data.title}</title>, ' +
          'or set it via your meta component.',
        docsUrl: docsUrlFor('seo/title-presence'),
        fix: { ...FIX }
      } satisfies Result;
    });
  }
};
```

- [ ] **Step 2: `description-presence.ts`、`canonical-url.ts`、`og-image.ts`、`og-title.ts`、`json-ld.ts` を作成**

`description-presence.ts`:

```ts
import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seo002Description = headTagRule({
  id: 'seo/description-presence',
  title: 'Description presence',
  severity: 'critical',
  match: (t: HeadTag) => t.kind === 'meta' && t.name === 'description',
  label: '<meta name="description">',
  recommendation: 'Add a <meta name="description"> in <svelte:head>, or set the description on your meta component.',
  rationale:
    'A meta description is the snippet search engines show under your title; without one they invent one from page text, often poorly.',
  fix: {
    description: 'Add a <meta name="description"> inside <svelte:head>, or set description on your meta component.',
    snippet: '<svelte:head>\n  <meta name="description" content="A concise page summary." />\n</svelte:head>',
    lang: 'svelte'
  }
});
```

`canonical-url.ts`:

```ts
import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seo003Canonical = headTagRule({
  id: 'seo/canonical-url',
  title: 'Canonical URL',
  severity: 'warning',
  match: (t: HeadTag) => t.kind === 'link' && t.rel === 'canonical',
  label: '<link rel="canonical">',
  recommendation: 'Add <link rel="canonical"> in <svelte:head>, or set the canonical prop on your meta component.',
  rationale:
    'A canonical URL tells search engines which URL is authoritative, preventing duplicate-content dilution across query strings and trailing-slash variants.',
  fix: {
    description: 'Add <link rel="canonical"> inside <svelte:head>, or set the canonical prop on your meta component.',
    snippet: '<svelte:head>\n  <link rel="canonical" href="https://example.com/this-page" />\n</svelte:head>',
    lang: 'svelte'
  }
});
```

`og-image.ts`:

```ts
import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seo004OgImage = headTagRule({
  id: 'seo/og-image',
  title: 'Open Graph image',
  severity: 'warning',
  match: (t: HeadTag) => t.kind === 'meta' && t.property === 'og:image',
  label: '<meta property="og:image">',
  recommendation: 'Add <meta property="og:image">, or set openGraph.images on your meta component.',
  rationale:
    'og:image is the preview thumbnail shown when the page is shared on social platforms; without it links render bare and get fewer clicks.',
  fix: {
    description: 'Add <meta property="og:image">, or set openGraph.images on your meta component.',
    snippet: '<svelte:head>\n  <meta property="og:image" content="https://example.com/og.png" />\n</svelte:head>',
    lang: 'svelte'
  }
});
```

`og-title.ts`:

```ts
import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seo005OgTitle = headTagRule({
  id: 'seo/og-title',
  title: 'Open Graph title',
  severity: 'warning',
  match: (t: HeadTag) => t.kind === 'meta' && t.property === 'og:title',
  label: '<meta property="og:title">',
  recommendation: 'Add <meta property="og:title">, or set openGraph.title on your meta component.',
  rationale:
    'og:title controls the headline shown when the page is shared on social platforms, independent of the document <title>.',
  fix: {
    description: 'Add <meta property="og:title">, or set openGraph.title on your meta component.',
    snippet: '<svelte:head>\n  <meta property="og:title" content="Page title" />\n</svelte:head>',
    lang: 'svelte'
  }
});
```

`json-ld.ts`:

```ts
import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seo008JsonLd = headTagRule({
  id: 'seo/json-ld',
  title: 'JSON-LD structured data',
  severity: 'info',
  match: (t: HeadTag) => t.kind === 'jsonld',
  label: 'JSON-LD (<script type="application/ld+json">)',
  recommendation: 'Add JSON-LD structured data, e.g. via <svelte:head> or a JsonLd component.',
  rationale:
    'JSON-LD structured data lets search engines render rich results (breadcrumbs, articles, products) for the page.',
  fix: {
    // Svelte ships <script> contents verbatim (the body is raw text, not Svelte
    // markup), so use literal JSON here — an interpolation like {JSON.stringify(...)}
    // would be emitted as that literal string and produce invalid JSON-LD.
    description: 'Add a JSON-LD <script> inside <svelte:head> with literal JSON (Svelte emits the script body as-is).',
    snippet:
      '<svelte:head>\n' +
      '  <script type="application/ld+json">\n' +
      '    {\n' +
      '      "@context": "https://schema.org",\n' +
      '      "@type": "WebPage",\n' +
      '      "name": "Page title"\n' +
      '    }\n' +
      '  </script>\n' +
      '</svelte:head>',
    lang: 'svelte'
  }
});
```

- [ ] **Step 3: 現在の `seo002-005-008.ts` の完全な内容を確認してからStep 2との差分を検証**

Run: `git show HEAD:packages/core/src/rules/seo/seo002-005-008.ts | tail -20`
Expected: Step 2で書いた5ファイルの内容が、末尾の閉じ括弧・`fix.snippet`の改行を含めて元ファイルの対応部分と一致している(特に `json-ld.ts` の `snippet` 文字列連結)ことを目視確認する。差異があれば元ファイルの内容を優先してコピーし直す。

- [ ] **Step 4: `robots-txt.ts`、`sitemap-xml.ts`、`html-lang.ts` を作成**(`project-rules.ts` を分割、各 `'SEO00N'` を2箇所ずつ置換)

`robots-txt.ts`:

```ts
import type { Detection, Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const present: Detection = { presence: 'own', value: 'static' };
const absent: Detection = { presence: 'none', value: 'absent' };

const FIX: Fix = {
  description: 'Create static/robots.txt (or a src/routes/robots.txt/+server endpoint).',
  snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
  lang: 'text'
};

export const seo006Robots: Rule = {
  id: 'seo/robots-txt',
  title: 'robots.txt',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'robots.txt tells crawlers which paths they may fetch and points them to your sitemap; missing it leaves crawl behaviour to defaults.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.hasRobotsTxt ? present : absent;
    return [
      {
        id: 'seo/robots-txt',
        category: 'seo',
        severity: 'warning',
        detection,
        message: ctx.project.hasRobotsTxt ? 'robots.txt' : 'Missing robots.txt',
        recommendation: 'Add static/robots.txt or a src/routes/robots.txt/+server endpoint.',
        docsUrl: docsUrlFor('seo/robots-txt'),
        fix: { ...FIX }
      }
    ];
  }
};
```

`sitemap-xml.ts`:

```ts
import type { Detection, Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const present: Detection = { presence: 'own', value: 'static' };
const absent: Detection = { presence: 'none', value: 'absent' };

const FIX: Fix = {
  description: 'Create static/sitemap.xml (or a src/routes/sitemap.xml/+server endpoint).',
  snippet:
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc></url>\n</urlset>',
  lang: 'xml'
};

export const seo007Sitemap: Rule = {
  id: 'seo/sitemap-xml',
  title: 'sitemap.xml',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'A sitemap.xml lists your URLs so search engines can discover and prioritise them, especially pages not well linked internally.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.hasSitemap ? present : absent;
    return [
      {
        id: 'seo/sitemap-xml',
        category: 'seo',
        severity: 'warning',
        detection,
        message: ctx.project.hasSitemap ? 'sitemap.xml' : 'Missing sitemap.xml',
        recommendation: 'Add static/sitemap.xml or a src/routes/sitemap.xml/+server endpoint.',
        docsUrl: docsUrlFor('seo/sitemap-xml'),
        fix: { ...FIX }
      }
    ];
  }
};
```

`html-lang.ts`:

```ts
import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const FIX: Fix = {
  description: 'Set the lang attribute on <html> in src/app.html.',
  snippet: '<html lang="en">',
  lang: 'html'
};

export const seo009HtmlLang: Rule = {
  id: 'seo/html-lang',
  title: '<html lang>',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'The <html lang> attribute declares the page language for search engines, screen readers, and translation tools.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.htmlLang;
    const message =
      detection.presence === 'none'
        ? 'Missing <html lang>'
        : detection.value === 'absent'
          ? 'Empty <html lang>'
          : '<html lang>';
    return [
      {
        id: 'seo/html-lang',
        category: 'seo',
        severity: 'warning',
        detection,
        message,
        recommendation: 'Set <html lang="..."> in src/app.html.',
        docsUrl: docsUrlFor('seo/html-lang'),
        fix: { ...FIX }
      }
    ];
  }
};
```

- [ ] **Step 5: `indexability.ts`、`twitter-card.ts`、`og-description.ts`、`og-url.ts`、`viewport.ts`、`sitemap-in-robots.ts` を作成**(`seo010-015.ts` を分割)

`indexability.ts`:

```ts
import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const FIX: Fix = {
  description: 'If this route should be indexed, drop noindex from its <meta name="robots">.',
  snippet: '<svelte:head>\n  <meta name="robots" content="index, follow" />\n</svelte:head>',
  lang: 'svelte'
};

// seo/indexability — flag-on-presence: a route whose robots meta is noindex. info advisory.
export const seo010Indexability: Rule = {
  id: 'seo/indexability',
  title: 'Indexability',
  category: 'seo',
  severity: 'info',
  scope: 'route',
  rationale:
    'A noindex directive removes the page from search results; an accidental noindex on a public route silently deindexes it.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const docsUrl = docsUrlFor('seo/indexability');
    const out: Result[] = [];
    for (const head of ctx.heads) {
      const noindexed = head.tags.some((t) => t.kind === 'meta' && t.name === 'robots' && t.noindex === true);
      if (!noindexed) continue;
      out.push({
        id: 'seo/indexability',
        category: 'seo',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' }, // surfaced as an issue (isPenalized)
        route: head.route,
        location: head.file,
        message: 'Route is noindex — verify this is intentional',
        recommendation: 'If this route should be indexed, remove noindex from its <meta name="robots">.',
        docsUrl,
        fix: { ...FIX }
      });
    }
    return out;
  }
};
```

`twitter-card.ts`:

```ts
import { headTagRule } from './head-tag-rule.js';

export const seo011TwitterCard = headTagRule({
  id: 'seo/twitter-card',
  title: 'Twitter Card',
  severity: 'info',
  match: (t) => t.kind === 'meta' && t.name === 'twitter:card',
  label: '<meta name="twitter:card">',
  recommendation: 'Add <meta name="twitter:card" content="summary_large_image"> so X/Twitter renders a rich card.',
  rationale:
    'twitter:card selects how the page renders when shared on X/Twitter; without it the platform falls back to a basic link (Open Graph tags are used as fallbacks for the rest).',
  fix: {
    description: 'Add a twitter:card meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta name="twitter:card" content="summary_large_image" />\n</svelte:head>',
    lang: 'svelte'
  }
});
```

`og-description.ts`:

```ts
import { headTagRule } from './head-tag-rule.js';

export const seo012OgDescription = headTagRule({
  id: 'seo/og-description',
  title: 'Open Graph description',
  severity: 'warning',
  match: (t) => t.kind === 'meta' && t.property === 'og:description',
  label: '<meta property="og:description">',
  recommendation: 'Add <meta property="og:description">, or set openGraph.description on your meta component.',
  rationale:
    'og:description is the summary shown under the title in social previews; without it platforms guess or show nothing, lowering click-through.',
  fix: {
    description: 'Add an og:description meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta property="og:description" content="A concise page summary." />\n</svelte:head>',
    lang: 'svelte'
  }
});
```

`og-url.ts`:

```ts
import { headTagRule } from './head-tag-rule.js';

export const seo013OgUrl = headTagRule({
  id: 'seo/og-url',
  title: 'Open Graph URL',
  severity: 'info',
  match: (t) => t.kind === 'meta' && t.property === 'og:url',
  label: '<meta property="og:url">',
  recommendation: 'Add <meta property="og:url"> with the canonical URL, or set openGraph.url on your meta component.',
  rationale:
    'og:url tells social platforms the canonical address to attribute shares and likes to, consolidating engagement on one URL.',
  fix: {
    description: 'Add an og:url meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta property="og:url" content="https://example.com/this-page" />\n</svelte:head>',
    lang: 'svelte'
  }
});
```

`viewport.ts`:

```ts
import { headTagRule } from './head-tag-rule.js';

export const seo014Viewport = headTagRule({
  id: 'seo/viewport',
  title: 'Viewport',
  severity: 'warning',
  match: (t) => t.kind === 'meta' && t.name === 'viewport',
  label: '<meta name="viewport">',
  // Viewport canonically lives in app.html, which static (CLI) mode does not
  // resolve into head tags — only evaluate rendered heads so the rule stays
  // silent there instead of false-flagging "missing" on every route.
  appliesTo: (head) => head.source === 'rendered',
  recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> (usually in app.html).',
  rationale:
    'Without a viewport meta tag the page is not mobile-responsive, which Google penalizes under mobile-first indexing.',
  fix: {
    description: 'Add the viewport meta tag (typically in src/app.html <head>).',
    snippet: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    lang: 'html'
  }
});
```

`sitemap-in-robots.ts`:

```ts
import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const FIX: Fix = {
  description: 'Add a Sitemap: line to static/robots.txt.',
  snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
  lang: 'text'
};

// seo/sitemap-in-robots — project rule: robots.txt should point crawlers at the sitemap.
export const seo015SitemapInRobots: Rule = {
  id: 'seo/sitemap-in-robots',
  title: 'Sitemap referenced in robots.txt',
  category: 'seo',
  severity: 'info',
  scope: 'project',
  rationale:
    'A Sitemap: line in robots.txt helps crawlers discover your sitemap; without it discovery relies on manual submission.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const { hasRobotsTxt, hasSitemap, robotsReferencesSitemap } = ctx.project;
    // Only meaningful when both exist AND we could read the static robots.txt and found no reference.
    if (!(hasRobotsTxt && hasSitemap && robotsReferencesSitemap === false)) return [];
    return [
      {
        id: 'seo/sitemap-in-robots',
        category: 'seo',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message: 'robots.txt does not reference your sitemap',
        recommendation: 'Add a Sitemap: line to static/robots.txt pointing at your sitemap.xml.',
        docsUrl: docsUrlFor('seo/sitemap-in-robots'),
        fix: { ...FIX }
      }
    ];
  }
};
```

- [ ] **Step 6: 旧ファイルを削除し、index.tsのimportを更新**

```bash
rm packages/core/src/rules/seo/seo001-title.ts packages/core/src/rules/seo/seo002-005-008.ts packages/core/src/rules/seo/project-rules.ts packages/core/src/rules/seo/seo010-015.ts
```

`packages/core/src/rules/index.ts` の該当行(3-11行目、17-24行目)を編集:

```ts
// before
import { seo001Title } from './seo/seo001-title.js';
import {
  seo002Description,
  seo003Canonical,
  seo004OgImage,
  seo005OgTitle,
  seo008JsonLd
} from './seo/seo002-005-008.js';
import { seo006Robots, seo007Sitemap, seo009HtmlLang } from './seo/project-rules.js';
// after
import { seo001Title } from './seo/title-presence.js';
import { seo002Description } from './seo/description-presence.js';
import { seo003Canonical } from './seo/canonical-url.js';
import { seo004OgImage } from './seo/og-image.js';
import { seo005OgTitle } from './seo/og-title.js';
import { seo008JsonLd } from './seo/json-ld.js';
import { seo006Robots } from './seo/robots-txt.js';
import { seo007Sitemap } from './seo/sitemap-xml.js';
import { seo009HtmlLang } from './seo/html-lang.js';
```

```ts
// before
import {
  seo010Indexability,
  seo011TwitterCard,
  seo012OgDescription,
  seo013OgUrl,
  seo014Viewport,
  seo015SitemapInRobots
} from './seo/seo010-015.js';
// after
import { seo010Indexability } from './seo/indexability.js';
import { seo011TwitterCard } from './seo/twitter-card.js';
import { seo012OgDescription } from './seo/og-description.js';
import { seo013OgUrl } from './seo/og-url.js';
import { seo014Viewport } from './seo/viewport.js';
import { seo015SitemapInRobots } from './seo/sitemap-in-robots.js';
```

- [ ] **Step 7: ビルド確認**

Run: `pnpm --filter @svelte-vitals/core build`
Expected: 型エラーなくビルドが通る

- [ ] **Step 8: コミット**

```bash
git add packages/core/src/rules/seo packages/core/src/rules/index.ts
git commit -m "refactor(core): split seo rules (title/description/og/robots/sitemap/html-lang/indexability/twitter/viewport) into per-rule files with new IDs"
```

---

## Task 7: seo カテゴリ後半(SEO016-031)のルール分割

**Files:**

- Modify: `packages/core/src/rules/seo/jsonld-engine.ts`(`jsonldRule`・`jsonldTags`ヘルパーを追加)
- Create: `packages/core/src/rules/seo/json-ld-validity.ts`、`json-ld-deprecated-type.ts`、`json-ld-relative-url.ts`、`json-ld-date-format.ts`、`json-ld-placeholder.ts`、`json-ld-required-props.ts`
- Create: `packages/core/src/rules/seo/length-rule.ts`(新規共有ヘルパー)、`title-length.ts`、`description-length.ts`
- Modify(rename): `seo024-charset.ts` → `charset.ts`
- Modify(rename): `seo025-image-alt.ts` → `image-alt.ts`
- Modify(rename): `seo026-hreflang.ts` → `hreflang.ts`
- Create: `packages/core/src/rules/seo/single-h1.ts`(旧 `seo027-heading.ts`)
- Create: `packages/core/src/rules/seo/uniqueness-rule.ts`(新規共有ヘルパー)、`duplicate-title.ts`、`duplicate-description.ts`
- Create: `packages/core/src/rules/seo/heading-level-skip.ts`(旧 `seo030-heading-order.ts`)
- Modify(rename): `seo031-ssr-disabled.ts` → `ssr-disabled.ts`
- Delete: `packages/core/src/rules/seo/seo016-021.ts`、`seo022-023.ts`、`seo027-heading.ts`、`seo028-029-uniqueness.ts`、`seo030-heading-order.ts`
- Modify: `packages/core/src/rules/index.ts`

**Interfaces:**

- Consumes: `packages/core/src/rules/seo/jsonld-engine.ts` の既存export(`parseJsonLd`、`typeOf`、`collectValues`、`nodeStringValues`、`isAbsoluteUrl`、`isIso8601`、`hasPlaceholder`、`hasNonEmpty`、`URL_KEYS`、`DATE_KEYS`、`DEPRECATED_TYPES`、`REQUIRED_PROPS`、`JsonLdNode` 型)
- Produces: `jsonld-engine.ts` に新規追加する `jsonldTags(head): HeadTag[]` と `jsonldRule(opts: JsonLdRuleOptions): Rule`(`JsonLdRuleOptions` 型も同ファイルでexport)。`length-rule.ts` の `lengthRule(opts: LengthRuleOptions): Rule`(`LengthRuleOptions` 型もexport)。`uniqueness-rule.ts` の `uniquenessRule(opts: UniquenessRuleOptions): Rule`(`UniquenessRuleOptions` 型もexport)。全16ルールの `id` が `seo/...` になる。識別子名は変更なし。

- [ ] **Step 1: `jsonld-engine.ts` の末尾に `jsonldTags` と `jsonldRule` を追加**

現在の `jsonld-engine.ts` は型・純粋関数のみで `Rule`/`RuleContext`/`HeadTag`/`Result`/`Fix` に依存していない。ファイル先頭のimportに以下を追加する:

```ts
import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import { PENALIZED, PASS } from './detection.js';
```

ファイル末尾に以下を追加する(`seo016-021.ts` から移動、`docsUrlFor` 呼び出し以外はロジック変更なし):

```ts
/** Static jsonld tags on a head (those with captured raw content). */
export function jsonldTags(head: { tags: HeadTag[] }): HeadTag[] {
  return head.tags.filter((t) => t.kind === 'jsonld' && typeof t.jsonld === 'string');
}

export interface JsonLdRuleOptions {
  id: string;
  title: string;
  severity: 'warning' | 'info';
  label: string;
  recommendation: string;
  rationale: string;
  fix?: Fix;
  /**
   * Returns a problem message (fail), undefined (pass), or false (no signal — emit nothing).
   * Only called on parseable JSON-LD.
   */
  problem: (nodes: JsonLdNode[]) => string | false | undefined;
}

/** Build a route-scoped JSON-LD rule that runs `problem` over each static, parseable JSON-LD on a route. */
export function jsonldRule(opts: JsonLdRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'seo',
    severity: opts.severity,
    scope: 'route',
    rationale: opts.rationale,
    ...(opts.fix ? { fix: opts.fix } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const head of ctx.heads) {
        for (const tag of jsonldTags(head)) {
          const parsed = parseJsonLd(tag.jsonld as string);
          if (!parsed.ok) continue; // seo/json-ld-validity owns parse failures
          // seo/json-ld-validity owns the @context/@type validity gate; the other JSON-LD
          // rules only inspect JSON-LD it considers valid, so they never emit passes for
          // structurally-invalid data.
          if (!parsed.nodes.some((n) => '@context' in n) || !parsed.nodes.some((n) => typeOf(n).length > 0)) continue;
          const problem = opts.problem(parsed.nodes);
          if (problem === false) continue; // no signal — rule is not applicable to these nodes
          out.push(
            problem
              ? {
                  id: opts.id,
                  category: 'seo',
                  severity: opts.severity,
                  detection: PENALIZED,
                  route: head.route,
                  location: head.file,
                  message: problem,
                  recommendation: opts.recommendation,
                  docsUrl,
                  ...(opts.fix ? { fix: { ...opts.fix } } : {})
                }
              : {
                  id: opts.id,
                  category: 'seo',
                  severity: opts.severity,
                  detection: PASS,
                  route: head.route,
                  message: opts.label,
                  recommendation: opts.recommendation,
                  docsUrl
                }
          );
        }
      }
      return out;
    }
  };
}
```

- [ ] **Step 2: `json-ld-validity.ts` を作成**(`seo016-021.ts` の `seo016JsonLdValidity` 部分、`jsonldTags` は `jsonld-engine.js` からimport)

```ts
import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { parseJsonLd, typeOf } from './jsonld-engine.js';
import { jsonldTags } from './jsonld-engine.js';
import { PENALIZED, PASS } from './detection.js';

// seo/json-ld-validity — validity (parse + @context + @type), custom because it owns parse failures.
export const seo016JsonLdValidity: Rule = {
  id: 'seo/json-ld-validity',
  title: 'JSON-LD validity',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale:
    'Invalid JSON-LD — unparseable, or missing @context/@type — is silently ignored by search engines, so the structured data does nothing.',
  fix: {
    description: 'Make the JSON-LD valid: parseable JSON with both @context (schema.org) and @type.',
    snippet:
      '<svelte:head>\n  <script type="application/ld+json">\n    {"@context":"https://schema.org","@type":"WebPage","name":"…"}\n  </script>\n</svelte:head>',
    lang: 'svelte'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const docsUrl = docsUrlFor('seo/json-ld-validity');
    const out: Result[] = [];
    for (const head of ctx.heads) {
      for (const tag of jsonldTags(head)) {
        const parsed = parseJsonLd(tag.jsonld as string);
        let problem: string | undefined;
        if (!parsed.ok) problem = 'JSON-LD is not valid JSON';
        else if (!parsed.nodes.some((n) => '@context' in n)) problem = 'JSON-LD is missing @context';
        else if (!parsed.nodes.some((n) => typeOf(n).length > 0)) problem = 'JSON-LD is missing @type';
        out.push(
          problem
            ? {
                id: 'seo/json-ld-validity',
                category: 'seo',
                severity: 'warning',
                detection: PENALIZED,
                route: head.route,
                location: head.file,
                message: problem,
                recommendation: 'Make the JSON-LD valid JSON with both @context and @type.',
                docsUrl,
                fix: { ...(seo016JsonLdValidity.fix as Fix) }
              }
            : {
                id: 'seo/json-ld-validity',
                category: 'seo',
                severity: 'warning',
                detection: PASS,
                route: head.route,
                message: 'JSON-LD validity',
                recommendation: 'Make the JSON-LD valid JSON with both @context and @type.',
                docsUrl
              }
        );
      }
    }
    return out;
  }
};
```

- [ ] **Step 3: `json-ld-deprecated-type.ts`、`json-ld-relative-url.ts`、`json-ld-date-format.ts`、`json-ld-placeholder.ts`、`json-ld-required-props.ts` を作成**(いずれも `jsonldRule` を `jsonld-engine.js` からimport)

`json-ld-deprecated-type.ts`:

```ts
import { jsonldRule } from './jsonld-engine.js';
import { typeOf, DEPRECATED_TYPES } from './jsonld-engine.js';

export const seo017DeprecatedType = jsonldRule({
  id: 'seo/json-ld-deprecated-type',
  title: 'Deprecated structured-data type',
  severity: 'info',
  label: 'Structured-data type',
  recommendation:
    'Verify the rich-result status of this @type; Google dropped or restricted some (e.g. HowTo, FAQPage).',
  rationale: 'Some schema types no longer produce rich results, so the markup adds weight without the SERP benefit.',
  problem: (nodes) => {
    const dep = nodes.flatMap(typeOf).find((t) => DEPRECATED_TYPES.has(t));
    return dep ? `@type "${dep}" no longer reliably produces a Google rich result` : undefined;
  }
});
```

`json-ld-relative-url.ts`:

```ts
import { jsonldRule } from './jsonld-engine.js';
import { collectValues, isAbsoluteUrl, URL_KEYS } from './jsonld-engine.js';

export const seo018RelativeUrl = jsonldRule({
  id: 'seo/json-ld-relative-url',
  title: 'JSON-LD relative URL',
  severity: 'warning',
  label: 'JSON-LD URLs',
  recommendation: 'Use absolute URLs (http/https) for url/@id/image/logo/sameAs/contentUrl/thumbnailUrl in JSON-LD.',
  rationale: 'Search engines need absolute URLs in structured data; a relative URL cannot be resolved reliably.',
  fix: {
    description: 'Replace relative URLs in JSON-LD with absolute URLs.',
    snippet: '"image": "https://example.com/logo.png"',
    lang: 'json'
  },
  problem: (nodes) => {
    const bad = collectValues(nodes, URL_KEYS).find((v) => !isAbsoluteUrl(v));
    return bad ? `Relative URL in JSON-LD: "${bad}" — use an absolute URL` : undefined;
  }
});
```

`json-ld-date-format.ts`:

```ts
import { jsonldRule } from './jsonld-engine.js';
import { collectValues, isIso8601, DATE_KEYS } from './jsonld-engine.js';

export const seo019DateFormat = jsonldRule({
  id: 'seo/json-ld-date-format',
  title: 'JSON-LD date format',
  severity: 'info',
  label: 'JSON-LD dates',
  recommendation: 'Use ISO-8601 dates (e.g. 2026-06-26 or 2026-06-26T10:00:00Z) in JSON-LD.',
  rationale: 'Schema.org date properties expect ISO-8601; other formats may be ignored or misparsed.',
  fix: {
    description: 'Format JSON-LD date properties as ISO-8601.',
    snippet: '"datePublished": "2026-06-26"',
    lang: 'json'
  },
  problem: (nodes) => {
    const bad = collectValues(nodes, DATE_KEYS).find((v) => !isIso8601(v));
    return bad ? `Non-ISO-8601 date in JSON-LD: "${bad}"` : undefined;
  }
});
```

`json-ld-placeholder.ts`:

```ts
import { jsonldRule } from './jsonld-engine.js';
import { nodeStringValues, hasPlaceholder } from './jsonld-engine.js';

export const seo020Placeholder = jsonldRule({
  id: 'seo/json-ld-placeholder',
  title: 'JSON-LD placeholder text',
  severity: 'info',
  label: 'JSON-LD content',
  recommendation: 'Replace placeholder/boilerplate text in JSON-LD with real values.',
  rationale: 'Leftover placeholder text (e.g. "Your Company Name", "lorem ipsum") ships misleading structured data.',
  problem: (nodes) => {
    const bad = nodes.flatMap(nodeStringValues).find(hasPlaceholder);
    return bad ? `Placeholder text in JSON-LD: "${bad}"` : undefined;
  }
});
```

`json-ld-required-props.ts`:

```ts
import { jsonldRule } from './jsonld-engine.js';
import { typeOf, hasNonEmpty, REQUIRED_PROPS } from './jsonld-engine.js';

export const seo021RequiredProps = jsonldRule({
  id: 'seo/json-ld-required-props',
  title: 'JSON-LD required properties',
  severity: 'warning',
  label: 'JSON-LD required properties',
  recommendation: "Add the properties Google requires for this @type's rich result.",
  rationale: 'A recognized @type missing its required properties is ineligible for the corresponding rich result.',
  problem: (nodes) => {
    let hasKnownType = false;
    for (const node of nodes) {
      for (const t of typeOf(node)) {
        const required = REQUIRED_PROPS[t];
        if (!required) continue; // unknown/custom type → not flagged
        hasKnownType = true;
        const missing = required.filter((p) => !hasNonEmpty(node, p));
        if (missing.length > 0) return `${t} JSON-LD is missing required ${missing.join(', ')}`;
      }
    }
    // No known types found → no signal (rule is not applicable)
    return hasKnownType ? undefined : false;
  }
});
```

- [ ] **Step 4: 新規共有ヘルパー `length-rule.ts` を作成**(`seo022-023.ts` の `lengthRule` 部分を抽出)

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import { visibleLength } from './text-metrics.js';
import { PENALIZED, PASS } from './detection.js';

export interface LengthRuleOptions {
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
export function lengthRule(opts: LengthRuleOptions): Rule {
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
        // No tag, or dynamic/absent text → presence is seo/title-presence's or
        // seo/description-presence's concern, emit nothing.
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
                location: tag.file ?? head.file,
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
```

- [ ] **Step 5: `title-length.ts`、`description-length.ts` を作成**

`title-length.ts`:

```ts
import { lengthRule } from './length-rule.js';

export const seo022TitleLength = lengthRule({
  id: 'seo/title-length',
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
```

`description-length.ts`:

```ts
import { lengthRule } from './length-rule.js';

export const seo023DescriptionLength = lengthRule({
  id: 'seo/description-length',
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

- [ ] **Step 6: `charset.ts`、`image-alt.ts`、`hreflang.ts` をリネームしIDを更新**

```bash
git mv packages/core/src/rules/seo/seo024-charset.ts packages/core/src/rules/seo/charset.ts
git mv packages/core/src/rules/seo/seo025-image-alt.ts packages/core/src/rules/seo/image-alt.ts
git mv packages/core/src/rules/seo/seo026-hreflang.ts packages/core/src/rules/seo/hreflang.ts
```

`charset.ts:9`: `id: 'SEO024',` → `id: 'seo/charset',`

`image-alt.ts:10`: `id: 'SEO025',` → `id: 'seo/image-alt',`

`hreflang.ts` — `'SEO026'` の**全3箇所**(`docsUrlFor('SEO026')`、`id: 'SEO026'` ×2)を `'seo/hreflang'` に置換。

- [ ] **Step 7: `single-h1.ts` を作成**(`seo027-heading.ts` をリネーム、`'SEO027'` を全3箇所置換、`title` は変更しない)

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from './detection.js';

const docsUrl = docsUrlFor('seo/single-h1');
const recommendation = 'Use exactly one <h1> per page for its main topic; demote extra top-level headings to <h2>+.';

/**
 * seo/single-h1 — Heading hierarchy (single H1). Reads the per-route page-body headings
 * channel (collected by both providers). Zero <h1> (no primary heading) and two
 * or more (diluted topic) are both flagged; exactly one passes. A route whose
 * headings were not collected (channel unset) emits nothing.
 */
export const seo027Heading: Rule = {
  id: 'seo/single-h1',
  title: 'Heading hierarchy',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale:
    'Each page should have exactly one <h1> naming its main topic; none leaves the page without a primary heading, and several dilute the topic signal.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.headings ?? []) {
      const h1 = route.headings.filter((h) => h.level === 1);
      let problem: string | undefined;
      let where: { location?: string; line?: number } = {};
      if (h1.length === 0) {
        problem = 'Missing <h1>';
        const first = route.headings[0];
        if (first) where = { location: first.file, ...(first.line > 0 ? { line: first.line } : {}) };
      } else if (h1.length > 1) {
        problem = `Multiple <h1> (${h1.length}); use exactly one`;
        const extra = h1[1]!;
        where = { location: extra.file, ...(extra.line > 0 ? { line: extra.line } : {}) };
      }
      out.push(
        problem
          ? {
              id: 'seo/single-h1',
              category: 'seo',
              severity: 'warning',
              detection: PENALIZED,
              route: route.route,
              ...where,
              message: problem,
              recommendation,
              docsUrl
            }
          : {
              id: 'seo/single-h1',
              category: 'seo',
              severity: 'warning',
              detection: PASS,
              route: route.route,
              message: 'Heading hierarchy',
              recommendation,
              docsUrl
            }
      );
    }
    return out;
  }
};
```

- [ ] **Step 8: 新規共有ヘルパー `uniqueness-rule.ts` を作成**(`seo028-029-uniqueness.ts` の `uniquenessRule` 部分を抽出)

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import { PENALIZED, PASS } from './detection.js';
import { collapseWhitespace } from './text-metrics.js';

export interface UniquenessRuleOptions {
  id: string;
  title: string;
  label: string;
  noun: string;
  match: (t: HeadTag) => boolean;
  recommendation: string;
  rationale: string;
}

/**
 * Build a route-scoped rule that flags a static title/description duplicated across
 * routes. A route-scoped rule still sees every route in `ctx.heads`, so it can
 * group by normalized text. Dynamic/absent values (no captured `text`) are skipped.
 */
export function uniquenessRule(opts: UniquenessRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'seo',
    severity: 'warning',
    scope: 'route',
    rationale: opts.rationale,
    async check(ctx: RuleContext): Promise<Result[]> {
      // Gather (head, tag, normalized text) for every route with captured text.
      const entries: { route: string; file: string; text: string }[] = [];
      const counts = new Map<string, number>();
      for (const head of ctx.heads) {
        const tag = head.tags.find(opts.match);
        if (!tag || typeof tag.text !== 'string') continue;
        const text = collapseWhitespace(tag.text);
        if (text.length === 0) continue;
        entries.push({ route: head.route, file: tag.file ?? head.file, text });
        counts.set(text, (counts.get(text) ?? 0) + 1);
      }
      return entries.map((e) => {
        const n = counts.get(e.text) ?? 1;
        return n > 1
          ? {
              id: opts.id,
              category: 'seo',
              severity: 'warning',
              detection: PENALIZED,
              route: e.route,
              location: e.file,
              message: `${opts.noun} is duplicated across ${n} routes`,
              recommendation: opts.recommendation,
              docsUrl
            }
          : {
              id: opts.id,
              category: 'seo',
              severity: 'warning',
              detection: PASS,
              route: e.route,
              message: opts.label,
              recommendation: opts.recommendation,
              docsUrl
            };
      });
    }
  };
}
```

- [ ] **Step 9: `duplicate-title.ts`、`duplicate-description.ts` を作成**

`duplicate-title.ts`:

```ts
import { uniquenessRule } from './uniqueness-rule.js';

export const seo028TitleUnique = uniquenessRule({
  id: 'seo/duplicate-title',
  title: 'Duplicate title',
  label: 'Unique title',
  noun: 'Title',
  match: (t) => t.kind === 'title',
  recommendation: 'Give each route a unique <title> that describes that page specifically.',
  rationale:
    'Duplicate titles across pages make them compete in search results and weaken each page’s relevance signal.'
});
```

`duplicate-description.ts`:

```ts
import { uniquenessRule } from './uniqueness-rule.js';

export const seo029DescriptionUnique = uniquenessRule({
  id: 'seo/duplicate-description',
  title: 'Duplicate description',
  label: 'Unique description',
  noun: 'Description',
  match: (t) => t.kind === 'meta' && t.name === 'description',
  recommendation: 'Write a unique meta description per route so each search snippet is page-specific.',
  rationale:
    'Duplicate meta descriptions give search engines no per-page summary, so they are often ignored or rewritten.'
});
```

- [ ] **Step 10: `heading-level-skip.ts`、`ssr-disabled.ts` を作成/リネーム**

`heading-level-skip.ts`(`seo030-heading-order.ts` をリネーム、`'SEO030'` を全3箇所置換):

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from './detection.js';

const docsUrl = docsUrlFor('seo/heading-level-skip');
const recommendation = 'Increase heading levels one step at a time (do not jump, e.g. from <h2> straight to <h4>).';

/**
 * seo/heading-level-skip — Skipped heading level. Walking a route's body headings in
 * document order, a level that jumps more than +1 over the previous heading (e.g.
 * h2 → h4) breaks the outline. The first heading has no predecessor (missing/multiple
 * <h1> stays seo/single-h1's concern). A route with no headings emits nothing.
 */
export const seo030HeadingOrder: Rule = {
  id: 'seo/heading-level-skip',
  title: 'Heading order',
  category: 'seo',
  severity: 'info',
  scope: 'route',
  rationale:
    'Skipping a heading level breaks the document outline that search engines and assistive tech rely on to understand page structure.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.headings ?? []) {
      if (route.headings.length === 0) continue; // no headings → no outline signal
      let prev = route.headings[0]!.level;
      let skip: { level: number; prev: number; line: number; file: string } | undefined;
      for (let i = 1; i < route.headings.length; i++) {
        const h = route.headings[i]!;
        if (h.level > prev + 1) {
          skip = { level: h.level, prev, line: h.line, file: h.file };
          break;
        }
        prev = h.level;
      }
      out.push(
        skip
          ? {
              id: 'seo/heading-level-skip',
              category: 'seo',
              severity: 'info',
              detection: PENALIZED,
              route: route.route,
              location: skip.file,
              ...(skip.line > 0 ? { line: skip.line } : {}),
              message: `Heading level skipped (<h${skip.prev}> to <h${skip.level}>)`,
              recommendation,
              docsUrl
            }
          : {
              id: 'seo/heading-level-skip',
              category: 'seo',
              severity: 'info',
              detection: PASS,
              route: route.route,
              message: 'Heading order',
              recommendation,
              docsUrl
            }
      );
    }
    return out;
  }
};
```

```bash
git mv packages/core/src/rules/seo/seo031-ssr-disabled.ts packages/core/src/rules/seo/ssr-disabled.ts
```

`ssr-disabled.ts:10`: `id: 'SEO031',` → `id: 'seo/ssr-disabled',`

- [ ] **Step 11: 旧ファイルを削除し、index.tsのimportを更新**

```bash
rm packages/core/src/rules/seo/seo016-021.ts packages/core/src/rules/seo/seo022-023.ts packages/core/src/rules/seo/seo027-heading.ts packages/core/src/rules/seo/seo028-029-uniqueness.ts packages/core/src/rules/seo/seo030-heading-order.ts
```

`packages/core/src/rules/index.ts` の該当行(25-40行目)を編集:

```ts
// before
import {
  seo016JsonLdValidity,
  seo017DeprecatedType,
  seo018RelativeUrl,
  seo019DateFormat,
  seo020Placeholder,
  seo021RequiredProps
} from './seo/seo016-021.js';
import { seo022TitleLength, seo023DescriptionLength } from './seo/seo022-023.js';
import { seo024Charset } from './seo/seo024-charset.js';
import { seo025ImageAlt } from './seo/seo025-image-alt.js';
import { seo026Hreflang } from './seo/seo026-hreflang.js';
import { seo027Heading } from './seo/seo027-heading.js';
import { seo028TitleUnique, seo029DescriptionUnique } from './seo/seo028-029-uniqueness.js';
import { seo030HeadingOrder } from './seo/seo030-heading-order.js';
import { seo031SsrDisabled } from './seo/seo031-ssr-disabled.js';
// after
import { seo016JsonLdValidity } from './seo/json-ld-validity.js';
import { seo017DeprecatedType } from './seo/json-ld-deprecated-type.js';
import { seo018RelativeUrl } from './seo/json-ld-relative-url.js';
import { seo019DateFormat } from './seo/json-ld-date-format.js';
import { seo020Placeholder } from './seo/json-ld-placeholder.js';
import { seo021RequiredProps } from './seo/json-ld-required-props.js';
import { seo022TitleLength } from './seo/title-length.js';
import { seo023DescriptionLength } from './seo/description-length.js';
import { seo024Charset } from './seo/charset.js';
import { seo025ImageAlt } from './seo/image-alt.js';
import { seo026Hreflang } from './seo/hreflang.js';
import { seo027Heading } from './seo/single-h1.js';
import { seo028TitleUnique } from './seo/duplicate-title.js';
import { seo029DescriptionUnique } from './seo/duplicate-description.js';
import { seo030HeadingOrder } from './seo/heading-level-skip.js';
import { seo031SsrDisabled } from './seo/ssr-disabled.js';
```

- [ ] **Step 12: ビルド確認**

Run: `pnpm --filter @svelte-vitals/core build`
Expected: 型エラーなくビルドが通る。特に `jsonld-engine.ts` に追加した `Rule`/`RuleContext` importと既存の純粋関数群との循環参照がないことを確認する(`rule.ts` は `types.js`・`head.js` にのみ依存し `jsonld-engine.ts` を参照しないため、循環は発生しない)。

- [ ] **Step 13: コミット**

```bash
git add packages/core/src/rules/seo packages/core/src/rules/index.ts
git commit -m "refactor(core): split remaining seo rules (json-ld/*, length/uniqueness helpers, heading, ssr-disabled) into per-rule files with new IDs"
```

---

## Task 8: index.ts全体の整合性確認とcoreビルド

**Files:**

- Modify: `packages/core/src/rules/index.ts`(確認のみ、Task 2-7で既に完成しているはず)

**Interfaces:**

- Consumes: Task 2-7で作成した全60ファイルのexport
- Produces: `allRules: Rule[]`(60要素、順序は変更なし)、`explainRule(id: string)`(Task 10で正規化を変更するまでは大文字小文字非依存のまま)

- [ ] **Step 1: index.ts全体を読み直し、import文とファイルパスの対応を確認**

Run: `cat packages/core/src/rules/index.ts`
Expected: 60個のimport文すべてが新ファイルパス(`.js` 拡張子付き)を指しており、`allRules` 配列と末尾の `export { ... }` ブロックの識別子リストはTask前の順序から変わっていないこと。

- [ ] **Step 2: 全ルールの `id` が新形式であることを確認**

Run:

```bash
node -e "
const { allRules } = require('./packages/core/dist/rules/index.js');
const bad = allRules.filter(r => !/^[a-z]+\/[a-z][a-z0-9-]*$/.test(r.id));
console.log('total:', allRules.length, 'bad:', bad.map(r => r.id));
"
```

(先に `pnpm --filter @svelte-vitals/core build` を実行してdistを生成しておくこと)

Expected: `total: 60 bad: []`

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: エラーなし

このタスクはTask 2-7の延長の確認作業であり、変更がなければコミット不要。もし確認中に誤りを見つけた場合は該当ファイルを修正し、`git commit -m "fix(core): correct rule id/import mismatch found during index.ts audit"` としてコミットする。

---

## Task 9: 抑制コメント正規表現の変更

**Files:**

- Modify: `packages/core/src/component-parse.ts:555-556,571`
- Test: `packages/core/test/component-parse.test.ts`(既存の抑制コメント関連テストを確認・更新)

**Interfaces:**

- Consumes: なし
- Produces: `JS_DIRECTIVE`・`HTML_DIRECTIVE` の新しい正規表現。`ruleIds: string[] | undefined` の値が小文字の新ID(例: `['seo/ssr-disabled']`)になる。

- [ ] **Step 1: 既存の抑制コメントテストを確認**

Run: `grep -n "disable-next-line\|JS_DIRECTIVE\|HTML_DIRECTIVE" packages/core/test/component-parse.test.ts`

Expected: 抑制コメントのテストケースが旧ID(`SEC001`等)を使っている箇所が見つかる。このタスクではまだテスト側のID文字列は変更しない(Task 11で一括置換する)。この時点では正規表現がマッチするパターン自体(大文字小文字・記号)が変わることの確認だけを行う。

- [ ] **Step 2: 正規表現を変更する**

`packages/core/src/component-parse.ts:555-556`:

```ts
// before
const JS_DIRECTIVE = /^\s*\/\/\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*$/;
const HTML_DIRECTIVE =
  /^\s*<!--\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*-->\s*$/;
```

```ts
// after
const RULE_ID_RE = '[a-z]+\\/[a-z][a-z0-9-]*';
const JS_DIRECTIVE = new RegExp(
  `^\\s*//\\s*svelte-vitals-disable-next-line(?:\\s+(${RULE_ID_RE}(?:\\s*,\\s*${RULE_ID_RE})*))?\\s*$`
);
const HTML_DIRECTIVE = new RegExp(
  `^\\s*<!--\\s*svelte-vitals-disable-next-line(?:\\s+(${RULE_ID_RE}(?:\\s*,\\s*${RULE_ID_RE})*))?\\s*-->\\s*$`
);
```

- [ ] **Step 3: マッチ後の大文字化処理を削除する**

`packages/core/src/component-parse.ts:571`:

```ts
// before
const ruleIds = m[1]?.split(',').map((s) => s.trim().toUpperCase());
```

```ts
// after
const ruleIds = m[1]?.split(',').map((s) => s.trim());
```

- [ ] **Step 4: 一時的な手動テストで正規表現の動作を確認**

Run:

```bash
node -e "
const RULE_ID_RE = '[a-z]+\\\\/[a-z][a-z0-9-]*';
const JS_DIRECTIVE = new RegExp(\`^\\\\s*//\\\\s*svelte-vitals-disable-next-line(?:\\\\s+(\${RULE_ID_RE}(?:\\\\s*,\\\\s*\${RULE_ID_RE})*))?\\\\s*\$\`);
console.log(JS_DIRECTIVE.exec('// svelte-vitals-disable-next-line seo/ssr-disabled'));
console.log(JS_DIRECTIVE.exec('// svelte-vitals-disable-next-line seo/ssr-disabled, security/handler-state-write'));
console.log(JS_DIRECTIVE.exec('// svelte-vitals-disable-next-line SEO031')); // should be null (old format no longer matches)
"
```

Expected: 最初の2つはマッチ(グループ1にID文字列)、3つ目は `null`

- [ ] **Step 5: ビルド確認**

Run: `pnpm --filter @svelte-vitals/core build`
Expected: 型エラーなくビルドが通る(既存テストはこの時点でまだ旧IDのため失敗する可能性があるが、Task 11で解消するので今は無視してよい)

- [ ] **Step 6: コミット**

```bash
git add packages/core/src/component-parse.ts
git commit -m "refactor(core): update suppression-comment regex for category/kebab-case rule ids"
```

---

## Task 10: coreの大文字小文字正規化削除(explainRule)

**Files:**

- Modify: `packages/core/src/rules/index.ts:195-198`

**Interfaces:**

- Consumes: `allRules`(Task 8で完成済み)
- Produces: `explainRule(id: string): RuleInfo | undefined` — 完全一致(大文字小文字区別)の照合に変更

- [ ] **Step 1: `explainRule` とそのJSDocを更新**

`packages/core/src/rules/index.ts:195-198`:

```ts
// before
/** Look up a rule's static metadata for the MCP explain_rule tool (issue #24). Rule ids are matched case-insensitively. */
export function explainRule(id: string): RuleInfo | undefined {
  const target = id.toUpperCase();
  const rule = allRules.find((r) => r.id === target);
```

```ts
// after
/** Look up a rule's static metadata for the MCP explain_rule tool (issue #24). Rule ids are matched exactly (case-sensitive, e.g. "seo/ssr-disabled"). */
export function explainRule(id: string): RuleInfo | undefined {
  const rule = allRules.find((r) => r.id === id);
```

- [ ] **Step 2: ビルド確認**

Run: `pnpm --filter @svelte-vitals/core build`
Expected: 型エラーなくビルドが通る

- [ ] **Step 3: コミット**

```bash
git add packages/core/src/rules/index.ts
git commit -m "refactor(core): make explainRule match rule ids case-sensitively"
```

---

## Task 11: coreテストコードの一括置換とテスト実行

**Files:**

- Modify: `packages/core/test/**/*.ts`(旧ID文字列を含む全ファイル)

**Interfaces:**

- Consumes: `scratchpad/rule-id-map.json`、`scratchpad/replace-rule-ids.mjs`(Task 1で作成)

- [ ] **Step 1: 一括置換を実行**

Run: `node /path/to/scratchpad/replace-rule-ids.mjs /Users/oekazuma/localRepo/svelte-vitals packages/core/test`

Expected: `changed: packages/core/test/...` の行が多数出力され、末尾に `done. N file(s) changed.`(Nは0より大きい)

- [ ] **Step 2: 置換漏れがないか確認**

Run: `grep -rlE "\b(SEO0[0-9]{2}|PERF0[01][0-9]|SEC00[0-9]|CORRECT00[0-9]|ARCH00[0-9])\b" packages/core/test/ || echo "NONE FOUND"`

Expected: `NONE FOUND`(旧ID形式の文字列がテストコード中に一つも残っていない)

- [ ] **Step 3: coreパッケージのテストを実行**

Run: `pnpm --filter @svelte-vitals/core test`

Expected: 全テストがパスする(Task 2-10の変更を正しく反映していれば、テストの内容自体は変更していないため、ID文字列の置換だけで通るはず)。失敗するテストがあれば、Task 2-7で作成したファイルのidフィールドと、対応するテストファイルの期待値がずれていないか個別に確認して修正する。

- [ ] **Step 4: コミット**

```bash
git add packages/core/test
git commit -m "test(core): update rule id references to category/kebab-case form"
```

---

## Task 12: MCPの正規化削除とテスト一括置換

**Files:**

- Modify: `packages/mcp/src/tools/analyze.ts:97-98`
- Modify: `packages/mcp/src/tools/explain-rule.ts:7`(zodのdescription例を更新)
- Modify: `packages/mcp/test/**/*.ts`

**Interfaces:**

- Consumes: `findUnknownRuleIds`・`knownRuleIds`(`packages/cli/src/rules-config.ts` からimportしている既存関数、シグネチャ変更なし)

- [ ] **Step 1: `analyze.ts` の正規化を削除**

`packages/mcp/src/tools/analyze.ts:96-98`:

```ts
// before
// Rule ids are accepted case-insensitively; normalize to the canonical
// uppercase form before validation and config building.
const allow = (args.rules ?? []).map((id) => id.toUpperCase());
const ignore = (args.ignore ?? []).map((id) => id.toUpperCase());
```

```ts
// after
// Rule ids are category/kebab-case (e.g. "seo/ssr-disabled") and matched exactly.
const allow = args.rules ?? [];
const ignore = args.ignore ?? [];
```

- [ ] **Step 2: `explain-rule.ts` のサンプルIDを更新**

`packages/mcp/src/tools/explain-rule.ts:7`:

```ts
// before
id: z.string().describe('Rule id to explain, e.g. "SEO001".');
```

```ts
// after
id: z.string().describe('Rule id to explain, e.g. "seo/title-presence".');
```

- [ ] **Step 3: mcpテストの一括置換を実行**

Run: `node /path/to/scratchpad/replace-rule-ids.mjs /Users/oekazuma/localRepo/svelte-vitals packages/mcp/test packages/mcp/src`

Expected: 変更ファイルが出力される

- [ ] **Step 4: 置換漏れ確認とテスト実行**

Run: `grep -rlE "\b(SEO0[0-9]{2}|PERF0[01][0-9]|SEC00[0-9]|CORRECT00[0-9]|ARCH00[0-9])\b" packages/mcp/ || echo "NONE FOUND"`
Expected: `NONE FOUND`

Run: `pnpm --filter @svelte-vitals/mcp build && pnpm --filter @svelte-vitals/mcp test`
Expected: 全テストがパスする

- [ ] **Step 5: コミット**

```bash
git add packages/mcp
git commit -m "refactor(mcp): match rule ids case-sensitively and update sample ids"
```

---

## Task 13: CLI/viteのサンプルID更新とテスト一括置換

**Files:**

- Modify: `packages/cli/src/install/config-content.ts:12`
- Modify: `packages/vite/src/hooks/options.ts:7`
- Modify: `packages/cli/test/**/*.ts`、`packages/vite/test/**/*.ts`

**Interfaces:**

- Consumes: なし(このタスクではCLI本体の照合ロジックは変更しない — 設計書の通りCLIは元々ケースセンシティブな完全一致のため変更不要)

- [ ] **Step 1: `config-content.ts` のscaffoldコメントを更新**

`packages/cli/src/install/config-content.ts:12`:

```ts
// before
// rules: {}, // e.g. { SEO001: 'off' } to disable a rule
```

```ts
// after
// rules: {}, // e.g. { 'seo/title-presence': 'off' } to disable a rule
```

- [ ] **Step 2: `vite/src/hooks/options.ts` のJSDoc例を更新**

`packages/vite/src/hooks/options.ts:7`:

```ts
// before
/** Per-rule overrides keyed by rule id, e.g. `{ SEO008: 'off' }`. Mirrors the plugin option. */
```

```ts
// after
/** Per-rule overrides keyed by rule id, e.g. `{ 'seo/json-ld': 'off' }`. Mirrors the plugin option. */
```

- [ ] **Step 3: cli/viteテストの一括置換を実行**

Run: `node /path/to/scratchpad/replace-rule-ids.mjs /Users/oekazuma/localRepo/svelte-vitals packages/cli/test packages/vite/test packages/cli/src packages/vite/src`

Expected: 変更ファイルが出力される

- [ ] **Step 4: 置換漏れ確認**

Run: `grep -rlE "\b(SEO0[0-9]{2}|PERF0[01][0-9]|SEC00[0-9]|CORRECT00[0-9]|ARCH00[0-9])\b" packages/cli/ packages/vite/ || echo "NONE FOUND"`
Expected: `NONE FOUND`

- [ ] **Step 5: cli・viteそれぞれのビルド・テストを実行**

Run: `pnpm --filter @svelte-vitals/cli build && pnpm --filter @svelte-vitals/cli test`
Run: `pnpm --filter @svelte-vitals/vite build && pnpm --filter @svelte-vitals/vite test`
Expected: 両方とも全テストがパスする

- [ ] **Step 6: `packages/action` の確認**(設計書の通り旧IDのハードコードはない想定)

Run: `grep -rlE "\b(SEO0[0-9]{2}|PERF0[01][0-9]|SEC00[0-9]|CORRECT00[0-9]|ARCH00[0-9])\b" packages/action/src packages/action/test || echo "NONE FOUND (as expected)"`
Expected: `NONE FOUND (as expected)`。もし見つかった場合はここで同様に置換対応する。

- [ ] **Step 7: コミット**

```bash
git add packages/cli packages/vite
git commit -m "refactor(cli,vite): update sample rule ids and test references to category/kebab-case form"
```

---

## Task 14: docs(en)ルールページの移行

**Files:**

- Move: `docs/src/content/docs/rules/*.md`(60ファイル)を `docs/src/content/docs/rules/<category>/<name>.md` へ
- Create: `/private/tmp/claude-501/-Users-oekazuma-localRepo-svelte-vitals/ad91d3ba-700b-4a5e-9fa8-bf7974cdb1e1/scratchpad/migrate-docs.mjs`

**Interfaces:**

- Consumes: `scratchpad/rule-id-map.json`

- [ ] **Step 1: docs移行スクリプトを作成**

`scratchpad/migrate-docs.mjs`:

```js
#!/usr/bin/env node
// Usage: node migrate-docs.mjs <repoRoot> <relativeRulesDir>
// For each { oldId, newId } in rule-id-map.json, moves
// <relativeRulesDir>/<oldId-lowercased>.md to <relativeRulesDir>/<newId>.md
// (creating category subdirectories as needed) and rewrites the front-matter
// `title:` line's ID segment from oldId to newId.
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [repoRoot, relDir] = process.argv.slice(2);
if (!repoRoot || !relDir) {
  console.error('Usage: node migrate-docs.mjs <repoRoot> <relativeRulesDir>');
  process.exit(1);
}

const map = JSON.parse(readFileSync(new URL('./rule-id-map.json', import.meta.url), 'utf8'));
const rulesDir = join(repoRoot, relDir);

for (const { oldId, newId } of map) {
  const oldPath = join(rulesDir, `${oldId.toLowerCase()}.md`);
  const newPath = join(rulesDir, `${newId}.md`);
  if (!existsSync(oldPath)) {
    console.warn('missing (skipped):', oldPath);
    continue;
  }
  mkdirSync(dirname(newPath), { recursive: true });
  let content = readFileSync(oldPath, 'utf8');
  // front-matter: title: OLDID · Rest of title  ->  title: newId · Rest of title
  const titleRe = new RegExp(`^title:\\s*${oldId}(\\s*[·-].*)$`, 'm');
  content = content.replace(titleRe, `title: ${newId}$1`);
  writeFileSync(newPath, content);
  // remove the old file (rename would fail across new subdirectories with git mv,
  // so write the new one then delete the old — git will detect the rename in `git add`)
  if (oldPath !== newPath) {
    const fs = await import('node:fs');
    fs.unlinkSync(oldPath);
  }
  console.log(`${oldPath} -> ${newPath}`);
}
```

- [ ] **Step 2: 英語docsに対して実行**

Run: `node /path/to/scratchpad/migrate-docs.mjs /Users/oekazuma/localRepo/svelte-vitals docs/src/content/docs/rules`

Expected: 60行の `<oldPath> -> <newPath>` が出力され、`missing (skipped)` は出ない

- [ ] **Step 3: front matterのtitle書き換えを目視確認**

Run: `head -3 docs/src/content/docs/rules/seo/ssr-disabled.md`
Expected:

```
---
title: seo/ssr-disabled · SSR disabled
description: export const ssr = false makes a route's content invisible to non-JS crawlers and slower to first paint.
```

- [ ] **Step 4: 旧フラットディレクトリに取り残しがないか確認**

Run: `find docs/src/content/docs/rules -maxdepth 1 -name '*.md'`
Expected: 出力なし(全ファイルがカテゴリのサブディレクトリに移動済み)

- [ ] **Step 5: コミット**

```bash
git add docs/src/content/docs/rules
git commit -m "docs: move en rule pages into category subdirectories with new ids"
```

---

## Task 15: docs(ja)ルールページの移行

**Files:**

- Move: `docs/src/content/docs/ja/rules/*.md`(60ファイル)を `docs/src/content/docs/ja/rules/<category>/<name>.md` へ

**Interfaces:**

- Consumes: `scratchpad/migrate-docs.mjs`(Task 14で作成済み、再利用)

- [ ] **Step 1: 日本語docsに対して同スクリプトを実行**

Run: `node /path/to/scratchpad/migrate-docs.mjs /Users/oekazuma/localRepo/svelte-vitals docs/src/content/docs/ja/rules`

Expected: 60行の `<oldPath> -> <newPath>` が出力され、`missing (skipped)` は出ない

- [ ] **Step 2: front matterを目視確認**

Run: `head -3 docs/src/content/docs/ja/rules/seo/ssr-disabled.md`
Expected:

```
---
title: seo/ssr-disabled · SSR の無効化
description: export const ssr = false は、JS を実行しないクローラーからコンテンツを見えなくし、初回描画も遅くします。
```

- [ ] **Step 3: 旧フラットディレクトリに取り残しがないか確認**

Run: `find docs/src/content/docs/ja/rules -maxdepth 1 -name '*.md'`
Expected: 出力なし

- [ ] **Step 4: コミット**

```bash
git add docs/src/content/docs/ja/rules
git commit -m "docs(ja): move rule pages into category subdirectories with new ids"
```

---

## Task 16: docs-links.test.tsの更新

**Files:**

- Modify: `packages/cli/test/docs-links.test.ts`

**Interfaces:**

- Consumes: `allRules`(`@svelte-vitals/core`、Task 8完成済み、`r.id` が `category/kebab-case` 形式)

- [ ] **Step 1: 現状のテストを完全に読む**

Run: `cat packages/cli/test/docs-links.test.ts`(既に本セッションで内容確認済み — 29行、`r.id.toLowerCase()` によるファイルパス変換と、`readdirSync` によるフラットなstray検出)

- [ ] **Step 2: パス変換と再帰的stray検出に書き換える**

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allRules } from '@svelte-vitals/core';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const enRules = join(repoRoot, 'docs', 'src', 'content', 'docs', 'rules');
const jaRules = join(repoRoot, 'docs', 'src', 'content', 'docs', 'ja', 'rules');

// Every rule links its findings to our own docs, so every category has reference pages.
const DOCUMENTED_CATEGORIES = new Set(['seo', 'performance', 'correctness', 'security', 'architecture']);
const documented = allRules.filter((r) => DOCUMENTED_CATEGORIES.has(r.category));

/** Recursively list every file under `dir`, as paths relative to `dir` (POSIX-style, e.g. "seo/ssr-disabled.md"). */
function listFilesRecursive(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(abs).isDirectory()) out.push(...listFilesRecursive(abs, rel));
    else out.push(rel);
  }
  return out;
}

describe('docs: every documented rule has a reference page (en + ja)', () => {
  it('has an en page per rule id', () => {
    for (const r of documented) {
      expect(existsSync(join(enRules, `${r.id}.md`)), `${r.id} en page`).toBe(true);
    }
  });
  it('has a ja page per rule id', () => {
    for (const r of documented) {
      expect(existsSync(join(jaRules, `${r.id}.md`)), `${r.id} ja page`).toBe(true);
    }
  });
  it('has no stray rule pages without a matching rule', () => {
    const ids = new Set(documented.map((r) => `${r.id}.md`));
    for (const dir of [enRules, jaRules])
      for (const f of listFilesRecursive(dir)) expect(ids.has(f), `stray ${f} in ${dir}`).toBe(true);
  });
});
```

- [ ] **Step 3: テスト実行**

Run: `pnpm --filter @svelte-vitals/cli test -- docs-links`
Expected: 3つのテストケースすべてがパスする

- [ ] **Step 4: コミット**

```bash
git add packages/cli/test/docs-links.test.ts
git commit -m "test(cli): recurse into category subdirectories for docs-links check"
```

---

## Task 17: guides・READMEのサンプルID更新

**Files:**

- Modify: `docs/src/content/docs/guides/{ci,cli,getting-started,dev-dashboard,mcp}.md`、`configuration.mdx`
- Modify: `docs/src/content/docs/ja/guides/{ci,cli,getting-started,dev-dashboard,mcp}.md`、`configuration.mdx`
- Modify: `packages/cli/README.md`、`packages/mcp/README.md`

**Interfaces:**

- Consumes: `scratchpad/replace-rule-ids.mjs`(Task 1で作成済み、再利用)

- [ ] **Step 1: 一括置換を実行**

Run: `node /path/to/scratchpad/replace-rule-ids.mjs /Users/oekazuma/localRepo/svelte-vitals docs/src/content/docs/guides docs/src/content/docs/ja/guides packages/cli/README.md packages/mcp/README.md`

`replace-rule-ids.mjs` の `walk` は単一ファイルパスを渡すと `statSync` が directory でない場合に失敗するため、`packages/cli/README.md` のような単一ファイル引数を渡す場合は次の一行版で代替する:

Run:

```bash
node -e "
const fs = require('fs');
const map = require('/path/to/scratchpad/rule-id-map.json');
for (const file of ['packages/cli/README.md', 'packages/mcp/README.md']) {
  let c = fs.readFileSync(file, 'utf8');
  for (const {oldId, newId} of map) c = c.replace(new RegExp('\\\\b'+oldId+'\\\\b','g'), newId);
  fs.writeFileSync(file, c);
}
console.log('done');
"
```

そして guides ディレクトリには元の `replace-rule-ids.mjs` をディレクトリ引数で実行する:

Run: `node /path/to/scratchpad/replace-rule-ids.mjs /Users/oekazuma/localRepo/svelte-vitals docs/src/content/docs/guides docs/src/content/docs/ja/guides`

- [ ] **Step 2: 置換漏れ確認**

Run: `grep -rlE "\b(SEO0[0-9]{2}|PERF0[01][0-9]|SEC00[0-9]|CORRECT00[0-9]|ARCH00[0-9])\b" docs/src/content/docs/guides docs/src/content/docs/ja/guides packages/cli/README.md packages/mcp/README.md || echo "NONE FOUND"`
Expected: `NONE FOUND`

- [ ] **Step 3: config例のクォート必須化を目視確認**

Run: `grep -n "rules: {" docs/src/content/docs/guides/configuration.mdx docs/src/content/docs/ja/guides/configuration.mdx`

例えば `rules: { seo/ssr-disabled: 'off' }` のようにクォートなしで置換されてしまっている箇所があれば、`rules: { 'seo/ssr-disabled': 'off' }` の形にキーをクォートで囲むよう手動で修正する(単純な文字列置換ではクォートの追加はできないため、このステップは目視で全該当箇所を確認する)。

- [ ] **Step 4: コミット**

```bash
git add docs/src/content/docs/guides docs/src/content/docs/ja/guides packages/cli/README.md packages/mcp/README.md
git commit -m "docs: update guide/readme sample rule ids to category/kebab-case form"
```

---

## Task 18: changeset作成

**Files:**

- Create: `.changeset/rule-id-eslint-style.md`

**Interfaces:**

- なし

- [ ] **Step 1: changesetを作成**

`pnpm changeset` を対話的に実行するか、直接ファイルを作成する。`.changeset/rule-id-eslint-style.md`:

```md
---
'@svelte-vitals/core': major
'@svelte-vitals/cli': major
'@svelte-vitals/vite': major
'@svelte-vitals/mcp': major
---

Rule IDs now use an ESLint-style `category/kebab-case` form (e.g. `seo/ssr-disabled`) instead of `CATEGORY123` (e.g. `SEO031`), so the id itself tells you what a rule checks when disabling it in config or a suppression comment.

This is a breaking change with no backward-compat aliasing:

- Update `svelte-vitals.config.mjs`/`.js`/`.json` `rules` overrides to the new ids (keys now contain a slash, so they must be quoted: `rules: { 'seo/ssr-disabled': 'off' }`).
- Update `// svelte-vitals-disable-next-line <ID>` suppression comments to the new lowercase ids.
- If you have a `.svelte-vitals-suppressions.json` baseline file, every entry is keyed by the old id and will no longer match after upgrading — regenerate it (re-run your suppression-baseline command, e.g. `svelte-vitals --update-suppressions`, after upgrading) rather than hand-editing the old ids.
- The `explain_rule` MCP tool and the `--rules`/`--ignore` CLI/MCP options now expect the new ids.

See the full old-id → new-id mapping in [docs/superpowers/specs/2026-07-22-rule-id-eslint-style-design.md](../docs/superpowers/specs/2026-07-22-rule-id-eslint-style-design.md).
```

- [ ] **Step 2: コミット**

```bash
git add .changeset/rule-id-eslint-style.md
git commit -m "chore: add changeset for rule-id migration"
```

---

## Task 19: 全体最終検証

**Files:**

- なし(検証のみ)

- [ ] **Step 1: 全パッケージのビルド・型チェック**

Run: `pnpm build && pnpm typecheck`
Expected: エラーなし

- [ ] **Step 2: 全パッケージのテスト**

Run: `pnpm test`
Expected: core・cli・vite・mcp・action全パッケージのテストがパスする

- [ ] **Step 3: lint**

Run: `pnpm lint`
Expected: PR #262時点のpre-existing warning(`meta-object.test.ts` 2件)以外のエラー・警告がないこと

- [ ] **Step 4: publish check**

Run: `pnpm check:publish`
Expected: エラーなし

- [ ] **Step 5: docsビルド**

Run: `pnpm --filter docs build`
Expected: 120ページ(en 60 + ja 60、他の既存ページ込みで従来通りの総ページ数)がビルドされ、`docs-links.test.ts` 相当のチェックが通っている(このコマンド自体はvitestではなくastro buildなので、Task 16のテストは既にTask 16内で個別確認済み)

- [ ] **Step 6: 手動動作確認 — config**

一時プロジェクトを用意せず、既存のfixtureを使って確認する場合は以下でCLIのconfigロードが新IDを受け付けることを確認する:

Run: `node -e "
const { allRules } = require('./packages/core/dist/rules/index.js');
console.log(allRules.find(r => r.id === 'seo/ssr-disabled') ? 'OK: found seo/ssr-disabled' : 'FAIL: not found');
console.log(allRules.find(r => r.id === 'SEO031') ? 'FAIL: old id still present' : 'OK: old id gone');
"`
Expected: `OK: found seo/ssr-disabled` と `OK: old id gone`

- [ ] **Step 7: 手動動作確認 — 抑制コメント**

Run:

```bash
node -e "
const RULE_ID_RE = '[a-z]+\\\\/[a-z][a-z0-9-]*';
const JS_DIRECTIVE = new RegExp(\`^\\\\s*//\\\\s*svelte-vitals-disable-next-line(?:\\\\s+(\${RULE_ID_RE}(?:\\\\s*,\\\\s*\${RULE_ID_RE})*))?\\\\s*\$\`);
const m = JS_DIRECTIVE.exec('// svelte-vitals-disable-next-line security/handler-state-write');
console.log(m ? 'OK: ' + m[1] : 'FAIL');
"
```

Expected: `OK: security/handler-state-write`

- [ ] **Step 8: 最終確認(コミット不要、報告のみ)**

Run: `git log --oneline main..HEAD`
Expected: Task 2〜18で作成した一連のコミットが順に並んでいる。この時点で `superpowers:requesting-code-review` スキルに進み、レビューを依頼する準備が整っている。

---

## Self-Review Notes

- **Spec coverage**: 設計書の全項目(60ルール対応表、抑制コメント正規表現、config/CLI/MCP照合、docsUrlFor、docs移行、テスト更新、guides/README、`packages/action`確認、suppressionsファイル失効のchangeset言及、`perf/`ディレクトリ据え置き)にそれぞれ対応するTaskがある。
- **Placeholder scan**: 全Taskのコード変更は完全なコード片を提示しており、「適切に処理する」等のプレースホルダーはない。Task 17のStep 1のみ、単一ファイル引数の制約に対する回避コマンドを明示している。
- **Type consistency**: `jsonldRule`/`jsonldTags`(Task 7)、`lengthRule`(Task 7)、`uniquenessRule`(Task 7)の関数シグネチャは、移動元ファイルの既存シグネチャをそのまま維持しており、呼び出し側(Task 7 Step 3, 5, 9)の引数名と一致している。
- 各カテゴリタスク(2〜7)は独立してビルド確認するため、Task単位でのpartial rollbackが可能。
