---
title: PERF004 · フォント preload に crossorigin がない
description: フォントの preload は crossorigin を指定しないと使われません。
---

**重大度:** warning

## チェック内容

すべての `<link rel="preload" as="font">` は `crossorigin` 属性を含む必要があります。これがないフォント preload は検出されます。

## なぜ重要か

`crossorigin` のないフォント preload は実際の（CORS）フォントリクエストと一致しないため、preload したファイルは使われず、フォントが二重にダウンロードされます。

## 修正方法

フォントの preload に `crossorigin` を追加します：

```html
<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin />
```
