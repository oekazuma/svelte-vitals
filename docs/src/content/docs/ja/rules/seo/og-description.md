---
title: seo/og-description · Open Graph description
description: og:description はどのルートにも入れましょう。
---

**重大度:** info

## チェック内容

すべてのルートに `<meta property="og:description">` タグを含めるべきです（直接指定でも継承でも構いません）。タグがない場合や空の場合は、情報提供レベルの指摘として検出します。

## なぜ重要か

og:description は、ソーシャルプレビューでタイトルの下に表示される要約文です。ないと各プラットフォームが内容を推測するか何も表示せず、クリック率が下がります。

2026-08-09 の重大度レビュー以前は `warning` でした。[Open Graph プロトコル](https://ogp.me/)は `og:description` を任意のメタデータとして扱っており、必須（Basic Metadata）の `og:url`（参照: [`seo/og-url`](/ja/rules/seo/og-url)）とは異なります。そのため仕様が定める必須・任意の区分に合わせて重大度を下げました。

## 修正方法

```svelte
<svelte:head>
  <meta property="og:description" content="ページの簡潔な要約。" />
</svelte:head>
```
