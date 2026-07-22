---
title: seo/hreflang · hreflang の妥当性
description: hreflang の alternate は有効なコードを使い、x-default を宣言すべきです。
---

**重大度:** warning

## チェック内容

`<link rel="alternate" hreflang="…">` の alternate を検証します。本ルールはオプトインで、hreflang alternate のないページは検出しません。alternate が存在する場合、次を検出します。

- 不正な `hreflang` 値（`x-default` でも、`en`、`en-US`、`zh-Hant`、`es-419` のような整形式の BCP-47 コードでもないもの）
- alternate が 2 つ以上あるのに `x-default` がない場合

## なぜ重要か

hreflang コードが不正だったり `x-default` が欠けていたりすると国際ターゲティングが機能せず、検索エンジンが誤った言語版を表示したり、アノテーション自体を無視したりします。

## 修正方法

```svelte
<svelte:head>
  <link rel="alternate" hreflang="en" href="https://example.com/en/" />
  <link rel="alternate" hreflang="de" href="https://example.com/de/" />
  <link rel="alternate" hreflang="x-default" href="https://example.com/" />
</svelte:head>
```
