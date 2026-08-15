---
title: a11y/doctype · Doctype
description: src/app.html の先頭は <!doctype html> で始めましょう。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

`src/app.html` が `<!doctype html>` で始まっているか（その前にコメントがあっても構いません）。プロジェクトスコープ: `src/app.html` を一度読んで判定します。

## なぜ重要か

doctype がないとブラウザは互換モード（quirks mode）でレンダリングし、CSS とアクセシビリティツリーの挙動が崩れます。

## 修正方法

`src/app.html` の先頭行に `<!doctype html>` を追加します：

```html
<!doctype html>
```

## 無効化

意図的な場合はルールを無効化してください:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/doctype': 'off'
  }
};
```
