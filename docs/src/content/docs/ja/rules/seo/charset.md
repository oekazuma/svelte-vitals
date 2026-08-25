---
title: seo/charset · 文字エンコーディング
description: 文字エンコーディングは <meta charset> で宣言します。
---

**重大度:** warning

## チェック内容

`<meta charset>` 宣言のないレンダリング済みページを検出します。

## なぜ重要か

文字エンコーディングが宣言されていないとブラウザは推測するしかなく、文字化けを起こすことがあります。`<meta charset="utf-8">` は標準的で曖昧さのない宣言であり、`<head>` の先頭に置くべきです。

## 修正方法

```html src/app.html
<head>
  <meta charset="utf-8" />
  %sveltekit.head%
</head>
```

## モードによる違い

**レンダリング解析のみ**（Vite プラグインのビルド、ダッシュボードで訪問したルート）。このタグは `src/app.html` にあり、ソース解析（CLI、ダッシュボードの静的ベースライン）はそれを解決しないため、ソース解析ではこのルールは何も報告しません。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/charset': 'off'
  }
};
```
