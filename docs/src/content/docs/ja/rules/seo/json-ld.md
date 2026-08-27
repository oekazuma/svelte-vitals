---
title: seo/json-ld · JSON-LD 構造化データ
description: どのルートにも JSON-LD 構造化データを入れましょう。
---

**重大度:** info

## チェック内容

すべてのルートに `<script type="application/ld+json">` の JSON-LD ブロックを含めるべきです（直接指定でも、レイアウトチェーン経由の継承でも構いません）。JSON-LD ブロックがないルートを検出します。

## なぜ重要か

JSON-LD 構造化データがあると、検索エンジンはそのページにリッチリザルト（パンくずリスト、記事、商品など）を表示できます。

## 修正方法

`<svelte:head>` 内に、リテラル JSON で JSON-LD の `<script>` を追加します。Svelte はスクリプトの中身をそのまま出力するので、`{JSON.stringify(...)}` のような補間を書くと、その文字列がリテラルのまま出力されて無効な JSON-LD になります。

```svelte
<svelte:head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Page title"
    }
  </script>
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。リテラルに読めない値（`{data.title}`）は `dynamic` となり、`treatDynamicAs` で判定されます。`<svelte:head>` 内で `{@html}` により注入した JSON-LD は、ソース解析が見える `<script>` 要素ではないため Missing として報告されます。レンダリング解析はそれを見つけます。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルなので `treatDynamicAs` は関係ありません。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld': 'off'
  }
};
```
