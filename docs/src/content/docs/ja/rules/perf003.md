---
title: PERF003 · preload に as がない
description: すべての <link rel="preload"> は as 属性を指定すべきです。
---

**重大度:** warning

## チェック内容

すべての `<link rel="preload">` は、リソース種別を示す `as` 属性（`style`、`script`、`font`、`image` など）を持つ必要があります。`as` のない preload は検出されます。

## なぜ重要か

`as` 属性のない `<link rel="preload">` はブラウザに無視される（または二重にフェッチされる）ため、preload が無駄になります。

## 修正方法

リソース種別に合った `as` 属性を追加します：

```html
<link rel="preload" href="/app.css" as="style" />
```
