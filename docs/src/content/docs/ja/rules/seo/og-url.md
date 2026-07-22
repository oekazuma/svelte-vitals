---
title: seo/og-url · Open Graph URL
description: すべてのルートは、正規アドレスを示す og:url を含めるべきです。
---

**重大度:** info

## チェック内容

すべてのルートは `<meta property="og:url">` を持つべきです（直接指定でも継承でも構いません）。欠けているルートを検出します。

## なぜ重要か

og:url は、シェアやいいねをどの正規アドレスに帰属させるべきかをソーシャルプラットフォームに伝え、エンゲージメントを一つの URL に集約します。

## 修正方法

```svelte
<svelte:head>
  <meta property="og:url" content="https://example.com/this-page" />
</svelte:head>
```
