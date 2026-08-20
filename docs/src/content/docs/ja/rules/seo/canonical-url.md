---
title: seo/canonical-url · Canonical URL
description: すべてのルートに <link rel="canonical"> タグを含めるべきです。
---

**重大度:** warning

## チェック内容

すべてのルートには、直接指定またはレイアウトチェーンからの継承で `<link rel="canonical">` タグを含めるべきです。canonical リンクがない、または空のルートを検出します。

## なぜ重要か

canonical URL は、どの URL が正規かを検索エンジンに伝えます。これにより、クエリ文字列違いだけの URL に評価が分散する、重複コンテンツの問題を防げます(末尾スラッシュの有無は SvelteKit 自身が既定で正規化するため、ここでは対象外です)。

## 修正方法

`<svelte:head>` 内に `<link rel="canonical">` を追加するか、メタコンポーネントの canonical プロップを設定します：

```svelte
<svelte:head>
  <link rel="canonical" href="https://example.com/this-page" />
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。リテラルに読めない値（`{data.title}`）は `dynamic` となり、`treatDynamicAs` で判定されます。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルなので `treatDynamicAs` は関係ありません。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/canonical-url': 'off'
  }
};
```
