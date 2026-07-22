---
title: seo/description-presence · ディスクリプションの存在
description: すべてのルートに <meta name="description"> が必要です。
---

**重大度:** critical

## チェック内容

すべてのルートには、直接指定またはレイアウトチェーンからの継承で `<meta name="description">` タグが必要です。ディスクリプションのメタタグがない、または空のルートを検出します。

## なぜ重要か

メタディスクリプションは、検索エンジンがタイトルの下に表示するスニペットです。設定していないと検索エンジンがページ本文から自動生成しますが、質の低いスニペットになりがちです。

## 修正方法

`<svelte:head>` 内に `<meta name="description">` を追加するか、メタコンポーネントのディスクリプションを設定します：

```svelte
<svelte:head>
  <meta name="description" content="A concise page summary." />
</svelte:head>
```
