---
title: seo/charset · 文字エンコーディング
description: 文字エンコーディングは <meta charset> で宣言します。
---

**重大度:** warning

## チェック内容

`<meta charset>` 宣言のないレンダリング済みページを検出します。SvelteKit では charset タグは `src/app.html` にあるため、本ルールはレンダリング解析（vite プラグイン）でのみ動作します。静的（CLI）解析では何も出力しません。

## なぜ重要か

文字エンコーディングが宣言されていないとブラウザは推測するしかなく、文字化けを起こすことがあります。`<meta charset="utf-8">` は標準的で曖昧さのない宣言であり、`<head>` の先頭に置くべきです。

## 修正方法

```html
<!-- src/app.html -->
<head>
  <meta charset="utf-8" />
  %sveltekit.head%
</head>
```
