---
title: seo/og-url · Open Graph URL
description: og:url には、そのページの正規アドレスを入れましょう。
---

**重大度:** warning

## チェック内容

すべてのルートは `<meta property="og:url">` を持つべきです（直接指定でも継承でも構いません）。欠けている、または空のルートを検出します。

## なぜ重要か

og:url は、シェアやいいねをどの正規アドレスに帰属させるべきかをソーシャルプラットフォームに伝え、エンゲージメントを一つの URL に集約します。[Open Graph プロトコル](https://ogp.me/)では、`og:title`・`og:type`・`og:image` と並んで `og:url` は必須プロパティに挙げられています。

2026-08-09 の重大度レビュー以前は `info` でした。理由は「og:url は `<link rel="canonical">` でだいたいカバーされる」というものでした — og:url がなくても、多くの受信側は canonical URL にフォールバックできるのは事実です。しかしこれは役割の異なる二つの仕組みを混同しています。canonical は検索エンジンにどの URL をインデックスすべきか伝えるものであり、og:url はソーシャルプラットフォームにシェアをどの URL に帰属させるか伝えるものです。Open Graph の仕様自体が `og:url` を必須としている一方（`og:description` は任意 — [`seo/og-description`](/ja/rules/seo/og-description) を参照）、現在の重大度は仕様が定める必須・任意の区分に合わせています。

## 修正方法

```svelte
<svelte:head>
  <meta property="og:url" content="https://example.com/this-page" />
</svelte:head>
```

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/og-url': 'off'
  }
};
```
