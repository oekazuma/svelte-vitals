---
title: seo/html-lang · <html lang>
description: app.html の <html> に lang 属性を設定しましょう。
---

**重大度:** warning

## チェック内容

`src/app.html` の `<html>` 要素には空でない `lang` 属性を設定すべきです。`lang` 属性がない、または空の場合に検出します。

## なぜ重要か

`<html lang>` 属性は、スクリーンリーダーにページの読み上げ方を、ブラウザに翻訳を提案するかどうかを、その他の支援技術にコンテンツの扱い方を伝えます。Google は `lang` をランキングには使用しないと表明しています。

## 修正方法

`src/app.html` で `<html lang="...">` を設定します：

```text
<html lang="en">
```

## 無効化

意図したとおりであれば、ルールを無効化してください:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'seo/html-lang': 'off'
  }
};
```
