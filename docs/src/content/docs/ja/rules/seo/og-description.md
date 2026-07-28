---
title: seo/og-description · Open Graph description
description: og:description はどのルートにも入れましょう。
---

**重大度:** warning

## チェック内容

すべてのルートに `<meta property="og:description">` タグが必要です（直接指定でも継承でも構いません）。タグがない場合や空の場合に検出します。

## なぜ重要か

og:description は、ソーシャルプレビューでタイトルの下に表示される要約文です。ないと各プラットフォームが内容を推測するか何も表示せず、クリック率が下がります。

## 修正方法

```svelte
<svelte:head>
  <meta property="og:description" content="ページの簡潔な要約。" />
</svelte:head>
```
