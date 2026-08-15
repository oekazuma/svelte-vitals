---
title: performance/font-preload-crossorigin · フォント preload に crossorigin がない
description: crossorigin を指定しないと、preload したフォントは使われません。
---

**重大度:** warning

## チェック内容

すべての `<link rel="preload" as="font">` には `crossorigin` 属性が必要です。`crossorigin` のないフォント preload を検出します。

## なぜ重要か

`crossorigin` のないフォント preload は実際の（CORS）フォントリクエストと一致しないため、preload したファイルは使われず、フォントが二重にダウンロードされます。

## 修正方法

フォントの preload に `crossorigin` を追加します：

```html
<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin />
```

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'performance/font-preload-crossorigin': 'off'
  }
};
```
