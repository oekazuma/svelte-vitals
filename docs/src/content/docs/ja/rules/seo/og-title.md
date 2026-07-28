---
title: seo/og-title · Open Graph タイトル
description: <meta property="og:title"> タグはどのルートにも必要です。
---

**重大度:** warning

## チェック内容

すべてのルートに `<meta property="og:title">` タグが必要です（直接指定でも、レイアウトチェーン経由の継承でも構いません）。Open Graph タイトルのメタタグがないルートを検出します。

## なぜ重要か

`og:title` は、ページがソーシャルプラットフォームでシェアされたときに表示される見出しを決めます。ドキュメントの `<title>` とは別に指定できます。

## 修正方法

`<meta property="og:title">` を追加するか、メタコンポーネントの `openGraph.title` を設定します：

```svelte
<svelte:head>
  <meta property="og:title" content="Page title" />
</svelte:head>
```
