# ルールIDをESLintスタイル(`category/kebab-case`)に移行する — Design

Date: 2026-07-22
Status: Approved

## Problem

ルールIDは現在 `SEO008`、`PERF011`、`SEC003`、`CORRECT007`、`ARCH001` のようなカテゴリ略称+連番の形式。設定(`rules: { SEO031: 'off' }`)や抑制コメント(`// svelte-vitals-disable-next-line SEO031`)でこのIDを見ても、何をチェックしているルールなのか文脈がわからない。ESLintの `no-unused-vars`、`import/order` のように、名前自体が意味を持つ形式に変える。

v1.0未満のため後方互換は不要(旧IDのエイリアスは作らない)。

## 新ID形式

`<category>/<kebab-case-name>`。`category` は既存の `Rule.category` フィールドの値(`seo` | `performance` | `correctness` | `security` | `architecture`)とそのまま一致させる — IDのプレフィックスとカテゴリフィールドが別々の語彙を持つ現状のズレ(`PERF` vs `performance`、`CORRECT` vs `correctness`、`SEC` vs `security`、`ARCH` vs `architecture`)を解消する。

例: `seo/ssr-disabled`、`performance/load-waterfall`、`security/load-state-write`、`correctness/orphan-effect`、`architecture/component-size`。

## 全60ルールの対応表

スラッグは既存ファイル名に由来するものを優先し、1ファイルに複数ルールがまとまっていてスラッグがないものは `title` フィールドをkebab-case化して命名した。

### architecture (2)

| 旧ID | title | 新ID | 新ファイル |
|---|---|---|---|
| ARCH001 | Component size | `architecture/component-size` | `architecture/component-size.ts` |
| ARCH002 | Prop count | `architecture/prop-count` | `architecture/prop-count.ts` |

### correctness (9)

| 旧ID | title | 新ID | 新ファイル |
|---|---|---|---|
| CORRECT001 | Keyed each block | `correctness/each-key` | `correctness/each-key.ts` |
| CORRECT002 | Effect used to derive state | `correctness/effect-as-derived` | `correctness/effect-as-derived.ts` |
| CORRECT003 | Effect used as onMount | `correctness/effect-as-onmount` | `correctness/effect-as-onmount.ts` |
| CORRECT004 | Unmutated $state | `correctness/unmutated-state` | `correctness/unmutated-state.ts` |
| CORRECT005 | Mutated non-bindable prop | `correctness/prop-mutation` | `correctness/prop-mutation.ts` |
| CORRECT006 | Orphan $effect | `correctness/orphan-effect` | `correctness/orphan-effect.ts` |
| CORRECT007 | Lifecycle call outside component initialisation | `correctness/orphan-lifecycle` | `correctness/orphan-lifecycle.ts` |
| CORRECT008 | Browser global in server module code | `correctness/server-browser-global` | `correctness/server-browser-global.ts` |
| CORRECT009 | Browser global during component initialisation | `correctness/instance-browser-global` | `correctness/instance-browser-global.ts` |

### performance (13)

| 旧ID | title | 新ID | 新ファイル |
|---|---|---|---|
| PERF001 | Image dimensions | `performance/image-dimensions` | `perf/image-dimensions.ts` |
| PERF002 | Image loading hint | `performance/image-loading-hint` | `perf/image-loading-hint.ts` |
| PERF003 | Preload missing as | `performance/preload-missing-as` | `perf/preload-missing-as.ts` |
| PERF004 | Font preload missing crossorigin | `performance/font-preload-crossorigin` | `perf/font-preload-crossorigin.ts` |
| PERF005 | LCP image eager loading | `performance/lcp-image` | `perf/lcp-image.ts` |
| PERF006 | Responsive image | `performance/responsive-image` | `perf/responsive-image.ts` |
| PERF007 | Render-blocking script | `performance/render-blocking-script` | `perf/render-blocking-script.ts` |
| PERF008 | Preconnect third-party origin | `performance/preconnect` | `perf/preconnect.ts` |
| PERF009 | Heavy dependency import | `performance/heavy-import` | `perf/heavy-import.ts` |
| PERF010 | Namespace import | `performance/namespace-import` | `perf/namespace-import.ts` |
| PERF011 | Load waterfall | `performance/load-waterfall` | `perf/load-waterfall.ts` |
| PERF012 | Minification disabled | `performance/minify-disabled` | `perf/minify-disabled.ts` |
| PERF013 | Sequential independent awaits | `performance/sequential-awaits` | `perf/sequential-awaits.ts` |

### security (5)

| 旧ID | title | 新ID | 新ファイル |
|---|---|---|---|
| SEC001 | Raw HTML render | `security/raw-html` | `security/raw-html.ts` |
| SEC002 | javascript: URL | `security/javascript-url` | `security/javascript-url.ts` |
| SEC003 | Handler writes imported state | `security/load-state-write` | `security/load-state-write.ts` |
| SEC004 | Server module-scope state | `security/server-module-state` | `security/server-module-state.ts` |
| SEC005 | Shared runes-state import on the server | `security/shared-state-import` | `security/shared-state-import.ts` |

### seo (31)

| 旧ID | title | 新ID | 新ファイル |
|---|---|---|---|
| SEO001 | Title presence | `seo/title-presence` | `seo/title-presence.ts` |
| SEO002 | Description presence | `seo/description-presence` | `seo/description-presence.ts` |
| SEO003 | Canonical URL | `seo/canonical-url` | `seo/canonical-url.ts` |
| SEO004 | Open Graph image | `seo/og-image` | `seo/og-image.ts` |
| SEO005 | Open Graph title | `seo/og-title` | `seo/og-title.ts` |
| SEO006 | robots.txt | `seo/robots-txt` | `seo/robots-txt.ts` |
| SEO007 | sitemap.xml | `seo/sitemap-xml` | `seo/sitemap-xml.ts` |
| SEO008 | JSON-LD structured data | `seo/json-ld` | `seo/json-ld.ts` |
| SEO009 | `<html lang>` | `seo/html-lang` | `seo/html-lang.ts` |
| SEO010 | Indexability | `seo/indexability` | `seo/indexability.ts` |
| SEO011 | Twitter Card | `seo/twitter-card` | `seo/twitter-card.ts` |
| SEO012 | Open Graph description | `seo/og-description` | `seo/og-description.ts` |
| SEO013 | Open Graph URL | `seo/og-url` | `seo/og-url.ts` |
| SEO014 | Viewport | `seo/viewport` | `seo/viewport.ts` |
| SEO015 | Sitemap referenced in robots.txt | `seo/sitemap-in-robots` | `seo/sitemap-in-robots.ts` |
| SEO016 | JSON-LD validity | `seo/json-ld-validity` | `seo/json-ld-validity.ts` |
| SEO017 | Deprecated structured-data type | `seo/json-ld-deprecated-type` | `seo/json-ld-deprecated-type.ts` |
| SEO018 | JSON-LD relative URL | `seo/json-ld-relative-url` | `seo/json-ld-relative-url.ts` |
| SEO019 | JSON-LD date format | `seo/json-ld-date-format` | `seo/json-ld-date-format.ts` |
| SEO020 | JSON-LD placeholder text | `seo/json-ld-placeholder` | `seo/json-ld-placeholder.ts` |
| SEO021 | JSON-LD required properties | `seo/json-ld-required-props` | `seo/json-ld-required-props.ts` |
| SEO022 | Title length | `seo/title-length` | `seo/title-length.ts` |
| SEO023 | Description length | `seo/description-length` | `seo/description-length.ts` |
| SEO024 | Character encoding | `seo/charset` | `seo/charset.ts` |
| SEO025 | Image alt text | `seo/image-alt` | `seo/image-alt.ts` |
| SEO026 | hreflang validity | `seo/hreflang` | `seo/hreflang.ts` |
| SEO027 | Heading hierarchy | `seo/heading-hierarchy` | `seo/heading-hierarchy.ts` |
| SEO028 | Duplicate title | `seo/duplicate-title` | `seo/duplicate-title.ts` |
| SEO029 | Duplicate description | `seo/duplicate-description` | `seo/duplicate-description.ts` |
| SEO030 | Heading order | `seo/heading-order` | `seo/heading-order.ts` |
| SEO031 | SSR disabled | `seo/ssr-disabled` | `seo/ssr-disabled.ts` |

複数ルールが1ファイルにまとまっていた既存ファイル(`correct001-002.ts`、`images.ts`、`resource-hints.ts`、`seo002-005-008.ts`、`seo010-015.ts`、`seo016-021.ts`、`seo022-023.ts`、`seo028-029-uniqueness.ts`、`sec001-002.ts`)は、この移行でルールごとに1ファイルへ分割する。共有ヘルパー(`head-tag-rule.ts`、`jsonld-engine.ts`、`component-rule.ts`、`kit-module-rule.ts`、`image-rule.ts`、`link-rule.ts`、`detection.ts`、`text-metrics.ts`、`project-rules.ts`の共通処理)はそのまま維持し、`project-rules.ts`(`robots-txt`/`sitemap-xml`/`html-lang`の3ルールを含む)のみ同様に分割する。

## コード側の変更

### 抑制コメントの正規表現(`packages/core/src/component-parse.ts`)

現行:
```ts
const JS_DIRECTIVE = /^\s*\/\/\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*$/;
const HTML_DIRECTIVE = /^\s*<!--\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*-->\s*$/;
```

`[A-Za-z]+\d+`(英字列+数字)を `[a-z]+\/[a-z][a-z0-9-]*`(小文字カテゴリ + スラッシュ + kebab-case名)に置き換える。マッチ後に行っていた `.toUpperCase()` 正規化(該当箇所)は削除し、大文字小文字を区別する — ESLintのルール名同様、新IDは小文字固定とする。

### config・CLI・MCPの照合ロジック

`config.rules[rule.id]` などの完全一致照合ロジック自体は変更不要(元々プレフィックスに依存していない)。変更が要るのは大文字小文字の正規化処理のみ:
- `packages/cli/src/rules-config.ts` の `--rules`/`--ignore` 引数を `.toUpperCase()` して比較している箇所を、小文字比較(またはそのまま大文字小文字区別)に変更。
- config例・エラーメッセージ中のサンプルIDをすべて新形式に更新。

configファイルの例も変わる: `rules: { SEO031: 'off' }` → `rules: { 'seo/ssr-disabled': 'off' }`(キーにスラッシュを含むためクォート必須。ESLintの`.eslintrc`と同じ形)。

### `docsUrlFor`(`packages/core/src/rule.ts`)

```ts
export function docsUrlFor(id: string): string {
  return `https://oekazuma.github.io/svelte-vitals/rules/${id.toLowerCase()}`;
}
```
IDが最初から小文字なので実質的にロジック変更は不要(`.toLowerCase()`は冗長だが害もない)。生成されるURLは `https://oekazuma.github.io/svelte-vitals/rules/seo/ssr-disabled` のようにスラッシュを含むパスになる。

## ドキュメント(en/ja)の移行

`docs/src/content/docs/rules/*.md` と `docs/src/content/docs/ja/rules/*.md` を、ルールIDのカテゴリでサブディレクトリ分割する:

```
docs/src/content/docs/rules/seo031.md → docs/src/content/docs/rules/seo/ssr-disabled.md
docs/src/content/docs/ja/rules/seo031.md → docs/src/content/docs/ja/rules/seo/ssr-disabled.md
```

front matterの `title` は `title: SEO031 · SSR disabled` → `title: seo/ssr-disabled · SSR disabled` の形式に更新(IDセグメントだけ差し替え、区切りの `·` はそのまま)。

`packages/cli/test/docs-links.test.ts` は、ID文字列からファイルパスへの変換規則を「`rules/${id.toLowerCase()}.md` を探す」から「`rules/${id}.md` を探す」(IDが既に `category/name` なので追加のカテゴリ分岐は不要)に更新する。

## テストコードの更新

`packages/core/test`、`packages/cli/test`、`packages/vite/test`、`packages/mcp/test` 内でハードコードされている旧ID文字列(約84ファイル・584件)を新IDに一括置換する。ルール実装ファイルの分割・リネームに対応するテストファイルがある場合は、可能な範囲でテストファイル名も追従させる(必須ではない — 実装計画側で個別に判断)。

## 実施方針

1つの大きなブランチ/PRで一括実施する。旧IDのエイリアス・移行期間は設けない(v1.0前の破壊的変更方針)。

## 検証

- `pnpm build` / `pnpm typecheck` / `pnpm test`(core・cli・vite・mcp全パッケージ) / `pnpm lint` / `pnpm check:publish`
- `pnpm --filter docs build`(en/ja 双方のルールページがビルドできること、`docs-links.test.ts` が新パス規則で全ページの存在を検証すること)
- 手動確認: config例(`rules: { 'seo/ssr-disabled': 'off' }`)と抑制コメント(`// svelte-vitals-disable-next-line seo/ssr-disabled`)がそれぞれ実際に効くこと
- changeset必須(user-facing / 破壊的変更のため `pnpm changeset` で major bump相当を記録)
