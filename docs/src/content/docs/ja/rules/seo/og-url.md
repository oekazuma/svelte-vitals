---
title: seo/og-url · Open Graph URL
description: og:url には、そのページの正規アドレスを入れましょう。
---

**重大度:** warning

## チェック内容

すべてのルートは `<meta property="og:url">` を持つべきです（直接指定でも継承でも構いません）。欠けている、または空のルートを検出します。

## なぜ重要か

og:url は、シェアやいいねをどの正規アドレスに帰属させるべきかをソーシャルプラットフォームに伝え、エンゲージメントを1つの URL に集約します。[Open Graph プロトコル](https://ogp.me/)では、`og:title`・`og:type`・`og:image` と並んで `og:url` は必須プロパティに挙げられています。

2026-08-09 の重大度レビュー以前は `info` でした。理由は「og:url は `<link rel="canonical">` でだいたいカバーされる」というものでした — og:url がなくても、多くの受信側は canonical URL にフォールバックできるのは事実です。しかしこれは役割の異なる2つの仕組みを混同しています。canonical は検索エンジンにどの URL をインデックスすべきか伝えるものであり、og:url はソーシャルプラットフォームにシェアをどの URL に帰属させるか伝えるものです。Open Graph の仕様自体が `og:url` を必須としている一方（`og:description` は任意 — [`seo/og-description`](/ja/rules/seo/og-description) を参照）、現在の重大度は仕様が定める必須・任意の区分に合わせています。

## 修正方法

```svelte
<svelte:head>
  <meta property="og:url" content="https://example.com/this-page" />
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。リテラルに読めない値（`{data.title}`）は `dynamic` となり、`treatDynamicAs` で判定されます。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルなので `treatDynamicAs` は関係ありません。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/og-url': 'off'
  }
};
```
