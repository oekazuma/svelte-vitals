---
title: seo/og-title · Open Graph タイトル
description: すべてのルートは <meta property="og:title"> タグを含む必要があります。
---

**重大度:** warning

## チェック内容

すべてのルートは `<meta property="og:title">` タグを含む必要があります（直接指定またはレイアウトチェーンを通じた継承）。欠落している Open Graph タイトルメタタグは指摘されます。

## なぜ重要か

`og:title` は、ページがソーシャルプラットフォームでシェアされたときに表示される見出しを制御します。これはドキュメントの `<title>` とは独立しています。

## 修正方法

`<meta property="og:title">` を追加するか、メタコンポーネントの `openGraph.title` を設定します：

```svelte
<svelte:head>
  <meta property="og:title" content="Page title" />
</svelte:head>
```
