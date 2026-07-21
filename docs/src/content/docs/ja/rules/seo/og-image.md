---
title: seo/og-image · Open Graph 画像
description: すべてのルートは <meta property="og:image"> タグを含む必要があります。
---

**重大度:** warning

## チェック内容

すべてのルートは `<meta property="og:image">` タグを含む必要があります（直接指定またはレイアウトチェーンを通じた継承）。欠落している Open Graph 画像メタタグは指摘されます。

## なぜ重要か

`og:image` は、ページがソーシャルプラットフォームでシェアされたときに表示されるプレビューサムネイルです。ない場合、リンクは素朴に表示され、クリック数が減少します。

## 修正方法

`<meta property="og:image">` を追加するか、メタコンポーネントの `openGraph.images` を設定します：

```svelte
<svelte:head>
  <meta property="og:image" content="https://example.com/og.png" />
</svelte:head>
```
