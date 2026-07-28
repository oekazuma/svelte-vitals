---
title: seo/html-lang · <html lang>
description: app.html の <html> に lang 属性を設定しましょう。
---

**重大度:** warning

## チェック内容

`src/app.html` の `<html>` 要素には空でない `lang` 属性が必要です。`lang` 属性がない、または空の場合に検出します。

## なぜ重要か

`<html lang>` 属性は、ページの言語を検索エンジンやスクリーンリーダー、翻訳ツールに伝えます。

## 修正方法

`src/app.html` で `<html lang="...">` を設定します：

```html
<html lang="en"></html>
```
