---
title: seo/duplicate-description · 説明文の重複
description: meta description はルートごとに違う内容にしましょう。
---

**重大度:** warning

## チェック内容

静的な `<meta name="description">` の内容が（トリムと空白圧縮の後で）同一のルートが 2 つ以上あると検出します。動的な説明文や存在しない説明文は検査しません。

## なぜ重要か

meta description が重複していると、ページごとの要約を検索エンジンに伝えられません。その結果、検索エンジンに無視されたり書き換えられたりします。

## 修正方法

```svelte
<svelte:head>
  <meta name="description" content="このルート固有の説明文。" />
</svelte:head>
```
