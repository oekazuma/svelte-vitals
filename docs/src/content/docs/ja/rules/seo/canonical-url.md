---
title: seo/canonical-url · Canonical URL
description: すべてのルートに <link rel="canonical"> タグが必要です。
---

**重大度:** warning

## チェック内容

すべてのルートには、直接指定またはレイアウトチェーンからの継承で `<link rel="canonical">` タグが必要です。canonical リンクのないルートを検出します。

## なぜ重要か

canonical URL は、どの URL が正規かを検索エンジンに伝えます。これにより、クエリ文字列や末尾スラッシュの有無だけが違う URL に評価が分散する、重複コンテンツの問題を防げます。

## 修正方法

`<svelte:head>` 内に `<link rel="canonical">` を追加するか、メタコンポーネントの canonical プロップを設定します：

```svelte
<svelte:head>
  <link rel="canonical" href="https://example.com/this-page" />
</svelte:head>
```
