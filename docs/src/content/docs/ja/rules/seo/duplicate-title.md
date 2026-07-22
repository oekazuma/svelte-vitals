---
title: seo/duplicate-title · タイトルの重複
description: 各ルートは一意の <title> を持つべきです。
---

**重大度:** warning

## チェック内容

静的な `<title>` のテキストが（トリムと空白圧縮の後で）同一のルートが 2 つ以上あると検出します。動的なタイトルや存在しないタイトルは検査しません。

## なぜ重要か

ページ間でタイトルが重複すると検索結果で互いに競合し、各ページの関連性シグナルが弱まります。

## 修正方法

```svelte
<svelte:head>
  <title>チーム紹介 — Acme</title>
</svelte:head>
```
