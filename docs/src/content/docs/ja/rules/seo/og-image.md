---
title: seo/og-image · Open Graph 画像
description: <meta property="og:image"> タグはどのルートにも必要です。
---

**重大度:** warning

## チェック内容

すべてのルートに `<meta property="og:image">` タグが必要です（直接指定でも、レイアウトチェーン経由の継承でも構いません）。Open Graph 画像のメタタグがない、または空のルートを検出します。

## なぜ重要か

`og:image` は、ページがソーシャルプラットフォームでシェアされたときに表示されるプレビュー用サムネイルです。ないとリンクは画像なしで表示され、クリック数が減ります。

## 修正方法

`<meta property="og:image">` を追加するか、メタコンポーネントの `openGraph.images` を設定します：

```svelte
<svelte:head>
  <meta property="og:image" content="https://example.com/og.png" />
</svelte:head>
```
