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

`<svelte:head>` 内に、リテラル JSON で JSON-LD の `<script>` を追加します。Svelte はスクリプトの中身をそのまま出力するので、`{JSON.stringify(...)}` のような補間を書くと、その文字列がリテラルのまま出力されて無効な JSON-LD になります：

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

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'seo/json-ld': 'off'
  }
};
```
